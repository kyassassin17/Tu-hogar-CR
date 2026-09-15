create extension if not exists "pgcrypto";

create type listing_operation as enum ('buy', 'rent');
create type listing_property_type as enum ('Casa', 'Apartamento');
create type listing_currency as enum ('USD', 'CRC');

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 5 and 100),
  province text not null,
  canton text not null,
  property_type listing_property_type not null,
  operation listing_operation not null,
  price numeric(14, 2) not null check (price > 0),
  currency listing_currency not null,
  beds smallint not null check (beds between 0 and 30),
  baths smallint not null check (baths between 1 and 30),
  area_m2 numeric(10, 2) not null check (area_m2 > 0),
  image_url text,
  latitude numeric(8, 5),
  longitude numeric(8, 5),
  amenities text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'rejected', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_published_created_idx
  on public.listings (created_at desc)
  where status = 'published';

alter table public.listings enable row level security;

create policy "Published listings are public"
  on public.listings for select
  using (status = 'published' or (select auth.uid()) = owner_id);

create policy "Authenticated users can create their listings"
  on public.listings for insert to authenticated
  with check ((select auth.uid()) = owner_id and status = 'draft');

create policy "Owners can update their listings"
  on public.listings for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their listings"
  on public.listings for delete to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();
