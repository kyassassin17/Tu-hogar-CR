begin;

alter table public.listings add column image_paths text[] not null default '{}';

create function public.valid_listing_image_paths(paths text[], owner_id uuid)
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(paths) <= 8 and not exists (
    select 1 from unnest(paths) as photo(path)
    where path is null or split_part(path, '/', 1) <> owner_id::text
      or path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png)$'
  );
$$;

alter table public.listings
  add constraint listings_image_paths_check check (public.valid_listing_image_paths(image_paths, owner_id)),
  drop constraint listings_published_image_check,
  add constraint listings_published_image_check check (status <> 'published' or image_url is not null or cardinality(image_paths) > 0);

create index listings_image_paths_idx on public.listings using gin (image_paths);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners upload listing photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png)$');

create policy "Read owner or published listing photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'listing-photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.listings where status = 'published' and image_paths @> array[name])
  ));

create policy "Owners remove unreferenced listing photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.listings where image_paths @> array[name]));

commit;