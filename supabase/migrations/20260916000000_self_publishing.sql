begin;

alter table public.listings
  add column district text,
  add column contact_name text,
  add column contact_phone text,
  add column contact_email text;

update public.listings set district = canton where district is null;

update public.listings set
  latitude = coalesce(latitude, case province
    when 'San José' then 9.932 when 'Alajuela' then 10.016 when 'Cartago' then 9.864
    when 'Heredia' then 10.002 when 'Guanacaste' then 10.633 when 'Puntarenas' then 9.977
    when 'Limón' then 9.99 end),
  longitude = coalesce(longitude, case province
    when 'San José' then -84.084 when 'Alajuela' then -84.211 when 'Cartago' then -83.919
    when 'Heredia' then -84.117 when 'Guanacaste' then -85.438 when 'Puntarenas' then -84.834
    when 'Limón' then -83.036 end)
where latitude is null or longitude is null;

-- Listings created before self-publishing have no contact details, so they stay archived until their owner republishes them.
update public.listings set status = 'archived'
where contact_name is null or contact_phone is null or contact_email is null;

alter table public.listings
  drop constraint listings_status_check,
  add constraint listings_status_check check (status in ('published', 'archived')),
  alter column status set default 'published',
  add constraint listings_district_check check (district is null or char_length(trim(district)) between 2 and 60),
  add constraint listings_contact_name_check check (contact_name is null or char_length(trim(contact_name)) between 3 and 80),
  add constraint listings_contact_phone_check check (contact_phone is null or contact_phone ~ '^\+506 [2-8][0-9]{7}$'),
  add constraint listings_contact_email_check check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$')),
  add constraint listings_published_details_check check (
    status <> 'published' or (
      district is not null and contact_name is not null and contact_phone is not null
      and contact_email is not null and latitude is not null and longitude is not null
    )
  );

drop policy "Authenticated users can create their listings" on public.listings;
create policy "Authenticated users can publish their listings"
  on public.listings for insert to authenticated
  with check ((select auth.uid()) = owner_id and status = 'published');

drop policy "Owners can update their listings" on public.listings;
create policy "Owners can update their listings"
  on public.listings for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id and status in ('published', 'archived'));

commit;
