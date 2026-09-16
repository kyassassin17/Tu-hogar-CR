begin;

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;

grant execute on function public.is_admin() to anon, authenticated;

alter table public.listings add column promoted_until timestamptz;

create index listings_promoted_idx on public.listings (promoted_until desc) where promoted_until is not null;

create table public.listing_promotions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('essential', 'plus', 'premium')),
  days smallint not null,
  amount_crc integer not null,
  sinpe_phone text not null check (sinpe_phone ~ '^\+506 [5-8][0-9]{7}$'),
  sinpe_reference text not null check (sinpe_reference ~ '^[A-Z0-9-]{4,40}$'),
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  review_note text check (review_note is null or char_length(trim(review_note)) between 1 and 300),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_promotions_plan_price_check check (
    (plan = 'essential' and days = 7 and amount_crc = 11187)
    or (plan = 'plus' and days = 30 and amount_crc = 28137)
    or (plan = 'premium' and days = 60 and amount_crc = 45087)
  ),
  constraint listing_promotions_window_check check (
    (status = 'active') = (starts_at is not null and expires_at is not null)
    and (expires_at is null or expires_at > starts_at)
  ),
  constraint listing_promotions_review_check check (status = 'pending' or reviewed_at is not null)
);

-- One open request per listing, and every SINPE confirmation can only be claimed once.
create unique index listing_promotions_pending_listing_idx
  on public.listing_promotions (listing_id) where status = 'pending';
create unique index listing_promotions_reference_idx
  on public.listing_promotions (sinpe_reference);
create index listing_promotions_owner_idx
  on public.listing_promotions (owner_id, created_at desc);
create index listing_promotions_review_queue_idx
  on public.listing_promotions (created_at) where status = 'pending';

create trigger listing_promotions_set_updated_at
before update on public.listing_promotions
for each row execute function public.set_updated_at();

create function public.apply_promotion_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    new.reviewed_by = coalesce((select auth.uid()), new.reviewed_by);
    new.reviewed_at = now();
    new.starts_at = now();
    new.expires_at = now() + make_interval(days => new.days);
    perform set_config('app.promotion_review', 'on', true);
    update public.listings
      set promoted_until = greatest(coalesce(promoted_until, new.expires_at), new.expires_at)
      where id = new.listing_id;
    perform set_config('app.promotion_review', 'off', true);
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    new.reviewed_by = coalesce((select auth.uid()), new.reviewed_by);
    new.reviewed_at = now();
  end if;
  return new;
end;
$$;

create trigger listing_promotions_review
before update on public.listing_promotions
for each row execute function public.apply_promotion_review();

-- Promotions are only granted by a verified payment review, never by the seller writing the listing.
create function public.guard_listing_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.promotion_review', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.promoted_until = null;
  else
    new.promoted_until = old.promoted_until;
  end if;
  return new;
end;
$$;

create trigger listings_guard_promotion
before insert or update on public.listings
for each row execute function public.guard_listing_promotion();

alter table public.listing_promotions enable row level security;

create policy "Owners and admins read promotions"
  on public.listing_promotions for select to authenticated
  using ((select auth.uid()) = owner_id or public.is_admin());

create policy "Owners request promotions"
  on public.listing_promotions for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and status = 'pending'
    and starts_at is null and expires_at is null
    and reviewed_by is null and reviewed_at is null and review_note is null
    and exists (
      select 1 from public.listings
      where listings.id = listing_id
        and listings.owner_id = (select auth.uid())
        and listings.status = 'published'
    )
  );

create policy "Owners cancel pending promotions"
  on public.listing_promotions for delete to authenticated
  using ((select auth.uid()) = owner_id and status = 'pending');

create policy "Admins verify payments"
  on public.listing_promotions for update to authenticated
  using (public.is_admin())
  with check (public.is_admin() and status in ('active', 'rejected'));

create policy "Admins read every listing"
  on public.listings for select to authenticated
  using (public.is_admin());

revoke all on public.listing_promotions from anon, authenticated;
grant select, insert, delete on public.listing_promotions to authenticated;
grant update (status, review_note) on public.listing_promotions to authenticated;

commit;
