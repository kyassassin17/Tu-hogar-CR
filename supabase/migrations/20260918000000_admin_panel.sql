begin;

-- The administrator account is identified by email so it works no matter when that user signs up.
create table public.admin_emails (
  email text primary key check (email = lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$')
);

insert into public.admin_emails (email) values ('keylorcascante8@gmail.com');

alter table public.admin_emails enable row level security;
revoke all on public.admin_emails from anon, authenticated;

create function public.sync_admin_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.admin_emails where email = lower(trim(new.email))) then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  else
    delete from public.admins where user_id = new.id;
  end if;
  return new;
end;
$$;

create trigger users_sync_admin
after insert or update of email on auth.users
for each row execute function public.sync_admin_user();

insert into public.admins (user_id)
select id from auth.users where lower(trim(email)) in (select email from public.admin_emails)
on conflict do nothing;

create function public.valid_plan_features(features text[])
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(features) <= 8 and not exists (
    select 1 from unnest(features) as feature(label)
    where label is null or char_length(trim(label)) not between 3 and 80
  );
$$;

create table public.promotion_plans (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{2,29}$'),
  name text not null check (char_length(trim(name)) between 3 and 40),
  description text not null check (char_length(trim(description)) between 3 and 120),
  price_crc integer not null check (price_crc between 500 and 1000000),
  days smallint not null check (days between 1 and 365),
  features text[] not null default '{}' check (public.valid_plan_features(features)),
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.promotion_plans (id, name, description, price_crc, days, features, sort_order) values
  ('essential', 'Esencial', 'Una primera impresión que cuenta.', 9900, 7,
    array['7 días como propiedad destacada', 'Insignia en tu anuncio', 'Posición preferente en búsquedas'], 1),
  ('plus', 'Hogar Plus', 'Más tiempo. Más oportunidades.', 24900, 30,
    array['30 días como propiedad destacada', 'Todo lo del plan Esencial', 'Marcador destacado en el mapa'], 2),
  ('premium', 'Premium', 'Tu propiedad en primer plano.', 39900, 60,
    array['60 días como propiedad destacada', 'Todo lo del plan Hogar Plus', 'Mayor duración de exposición'], 3);

create trigger promotion_plans_set_updated_at
before update on public.promotion_plans
for each row execute function public.set_updated_at();

alter table public.promotion_plans enable row level security;

create policy "Active plans are public"
  on public.promotion_plans for select to anon, authenticated
  using (active or public.is_admin());

create policy "Admins manage plans"
  on public.promotion_plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.promotion_plans from anon, authenticated;
grant select on public.promotion_plans to anon;
grant select, insert, update, delete on public.promotion_plans to authenticated;

-- Plan prices are now editable, so the charged amount comes from the plan instead of a fixed constraint.
alter table public.listing_promotions
  drop constraint listing_promotions_plan_price_check,
  drop constraint listing_promotions_plan_check,
  add constraint listing_promotions_plan_fkey foreign key (plan) references public.promotion_plans(id) on update cascade on delete restrict;

create function public.apply_promotion_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_days smallint;
  plan_price integer;
begin
  select days, price_crc into plan_days, plan_price
  from public.promotion_plans where id = new.plan and active;
  if not found then
    raise exception 'Unknown or inactive promotion plan %', new.plan using errcode = 'check_violation';
  end if;
  new.days = plan_days;
  new.amount_crc = round(plan_price * 1.13);
  return new;
end;
$$;

create trigger listing_promotions_apply_plan
before insert on public.listing_promotions
for each row execute function public.apply_promotion_plan();

create policy "Admins moderate listings"
  on public.listings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin() and status in ('published', 'archived'));

create policy "Admins remove listings"
  on public.listings for delete to authenticated
  using (public.is_admin());

create policy "Admins read listing photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos' and public.is_admin());

create policy "Admins remove unreferenced listing photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and public.is_admin()
    and not exists (select 1 from public.listings where image_paths @> array[name]));

commit;
