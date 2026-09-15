begin;

alter table public.listings
  add constraint listings_province_check check (province in ('San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón')),
  add constraint listings_canton_check check (char_length(trim(canton)) between 1 and 60),
  add constraint listings_image_check check (image_url is null or (image_url ~ '^https://[^[:space:]]+$' and char_length(image_url) <= 2048)),
  add constraint listings_coordinates_check check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null and latitude between 8 and 11.3 and longitude between -86 and -82.5)
  ),
  add constraint listings_published_image_check check (status <> 'published' or image_url is not null),
  add constraint listings_amenities_check check (cardinality(amenities) <= 30);

create index listings_owner_created_idx on public.listings (owner_id, created_at desc);

drop policy "Owners can update their listings" on public.listings;
create policy "Owners can update their listings"
  on public.listings for update to authenticated
  using ((select auth.uid()) = owner_id and status in ('draft', 'rejected'))
  with check ((select auth.uid()) = owner_id and status in ('draft', 'pending_review'));

revoke all on public.listings from anon, authenticated;
grant select on public.listings to anon;
grant select, insert, update, delete on public.listings to authenticated;

alter function public.set_updated_at() set search_path = '';

commit;