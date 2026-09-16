import initialMigration from '../../supabase/migrations/20260914000000_create_listings.sql?raw'
import moderationMigration from '../../supabase/migrations/20260915000000_harden_listing_moderation.sql?raw'
import photosMigration from '../../supabase/migrations/20260915010000_listing_photos.sql?raw'
import selfPublishingMigration from '../../supabase/migrations/20260916000000_self_publishing.sql?raw'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ownerId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const archivedId = '33333333-3333-4333-8333-333333333333'
const publicId = '44444444-4444-4444-8444-444444444444'
const contactColumns = "'San Antonio', 'Ana Rodríguez', '+506 88888888', 'ana@example.com', 9.9836, -84.1867"
let database: PGlite

beforeAll(async () => {
  database = new PGlite()
  await database.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${ownerId}'), ('${otherId}');
  `)
  await database.exec(initialMigration.replace('create extension if not exists "pgcrypto";', ''))
  await database.exec(moderationMigration)
  await database.exec(`
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (bucket_id text references storage.buckets(id), name text, primary key (bucket_id, name));
    create function storage.foldername(path text) returns text[] language sql immutable as
      $$ select (string_to_array(path, '/'))[1:array_length(string_to_array(path, '/'), 1) - 1] $$;
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select on storage.objects to anon;
    grant select, insert, update, delete on storage.objects to authenticated;
  `)
  await database.exec(photosMigration)
  await database.exec(selfPublishingMigration)
  await database.exec(`insert into public.listings (id, owner_id, title, province, canton, property_type, operation, price, currency, beds, baths, area_m2, image_url, status, district, contact_name, contact_phone, contact_email, latitude, longitude) values
    ('${archivedId}', '${ownerId}', 'Archived home', 'Heredia', 'Belén', 'Casa', 'buy', 150000000, 'CRC', 3, 2, 180, 'https://example.com/house.jpg', 'archived', ${contactColumns}),
    ('${publicId}', '${ownerId}', 'Public home', 'Heredia', 'Belén', 'Casa', 'buy', 150000000, 'CRC', 3, 2, 180, 'https://example.com/house.jpg', 'published', ${contactColumns});
    update public.listings set image_url = null, image_paths = array[owner_id::text || '/' || id::text || '.jpg'];
    insert into storage.objects values ('listing-photos', '${ownerId}/${archivedId}.jpg'), ('listing-photos', '${ownerId}/${publicId}.jpg'), ('listing-photos', '${ownerId}/${otherId}.png');`)
}, 30000)

afterAll(async () => { await database?.close() })

async function asUser(role: 'anon' | 'authenticated', userId: string, query: string) {
  await database.exec('begin')
  try {
    await database.exec(`set local role ${role}`)
    await database.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
    return await database.query(query)
  } finally {
    await database.exec('rollback')
  }
}

describe('listing row-level security', () => {
  it('restricts the private bucket to JPEG/PNG and 5 MB', async () => {
    expect((await database.query('select public, file_size_limit, allowed_mime_types from storage.buckets')).rows).toEqual([
      { public: false, file_size_limit: 5242880, allowed_mime_types: ['image/jpeg', 'image/png'] },
    ])
  })
  it('keeps archived photos private while allowing published photo access', async () => {
    expect((await asUser('anon', '', 'select name from storage.objects')).rows).toEqual([{ name: `${ownerId}/${publicId}.jpg` }])
    expect((await asUser('authenticated', otherId, 'select name from storage.objects')).rows).toHaveLength(1)
    expect((await asUser('authenticated', ownerId, 'select name from storage.objects')).rows).toHaveLength(3)
  })
  it('allows uploads only inside the authenticated owner folder', async () => {
    expect((await asUser('authenticated', otherId, `insert into storage.objects values ('listing-photos', '${otherId}/${archivedId}.jpg') returning name`)).rows).toHaveLength(1)
    await expect(asUser('authenticated', otherId, `insert into storage.objects values ('listing-photos', '${ownerId}/${ownerId}.jpg')`)).rejects.toThrow(/row-level security/)
    await expect(asUser('authenticated', ownerId, `insert into storage.objects values ('listing-photos', '${ownerId}/${ownerId}.svg')`)).rejects.toThrow(/row-level security/)
    await expect(asUser('anon', '', `insert into storage.objects values ('listing-photos', '${ownerId}/${ownerId}.jpg')`)).rejects.toThrow(/permission denied/)
  })
  it('prevents photo replacement and deletion while referenced by listings', async () => {
    expect((await asUser('authenticated', ownerId, `update storage.objects set name = '${ownerId}/${ownerId}.jpg' returning name`)).rows).toEqual([])
    expect((await asUser('authenticated', ownerId, `delete from storage.objects where name = '${ownerId}/${publicId}.jpg' returning name`)).rows).toEqual([])
    expect((await asUser('authenticated', ownerId, `delete from storage.objects where name = '${ownerId}/${archivedId}.jpg' returning name`)).rows).toEqual([])
    expect((await asUser('authenticated', otherId, 'delete from storage.objects returning name')).rows).toEqual([])
    expect((await asUser('authenticated', ownerId, `delete from storage.objects where name = '${ownerId}/${otherId}.png' returning name`)).rows).toHaveLength(1)
  })
  it('rejects photo paths belonging to another owner', async () => {
    await expect(asUser('authenticated', ownerId, `update public.listings set image_paths = array['${otherId}/${archivedId}.jpg'] where id = '${archivedId}'`)).rejects.toThrow(/listings_image_paths_check/)
  })
  it('shows only published listings to anonymous visitors', async () => {
    const result = await asUser('anon', '', 'select id from public.listings')
    expect(result.rows).toEqual([{ id: publicId }])
  })
  it('shows owner archived listings only to their authenticated owner', async () => {
    expect((await asUser('authenticated', ownerId, 'select id from public.listings')).rows).toHaveLength(2)
    expect((await asUser('authenticated', otherId, 'select id from public.listings')).rows).toEqual([{ id: publicId }])
  })
  it('prevents anonymous writes', async () => {
    await expect(asUser('anon', '', `delete from public.listings where id = '${publicId}'`)).rejects.toThrow(/permission denied/)
  })
  it('prevents another seller from changing or deleting an owner listing', async () => {
    expect((await asUser('authenticated', otherId, `update public.listings set title = 'Changed home' where id = '${archivedId}' returning id`)).rows).toEqual([])
    expect((await asUser('authenticated', otherId, `delete from public.listings where id = '${publicId}' returning id`)).rows).toEqual([])
  })
  it('lets owners publish, edit, and archive their listings without approval', async () => {
    expect((await asUser('authenticated', ownerId, `update public.listings set status = 'published' where id = '${archivedId}' returning status`)).rows).toEqual([{ status: 'published' }])
    expect((await asUser('authenticated', ownerId, `update public.listings set title = 'Edited home' where id = '${publicId}' returning title`)).rows).toEqual([{ title: 'Edited home' }])
    expect((await asUser('authenticated', ownerId, `update public.listings set status = 'archived' where id = '${publicId}' returning status`)).rows).toEqual([{ status: 'archived' }])
  })
  it('rejects moderation states and ownership reassignment', async () => {
    await expect(asUser('authenticated', ownerId, `update public.listings set status = 'pending_review' where id = '${publicId}'`)).rejects.toThrow(/row-level security/)
    await expect(asUser('authenticated', ownerId, `update public.listings set owner_id = '${otherId}' where id = '${publicId}'`)).rejects.toThrow(/row-level security/)
  })
  it('requires contact details and a located address on published listings', async () => {
    await expect(asUser('authenticated', ownerId, `update public.listings set contact_phone = null where id = '${publicId}'`)).rejects.toThrow(/listings_published_details_check/)
    await expect(asUser('authenticated', ownerId, `update public.listings set district = null where id = '${publicId}'`)).rejects.toThrow(/listings_published_details_check/)
    await expect(asUser('authenticated', ownerId, `update public.listings set contact_phone = '88888888' where id = '${publicId}'`)).rejects.toThrow(/listings_contact_phone_check/)
    await expect(asUser('authenticated', ownerId, `update public.listings set contact_email = 'ana@example' where id = '${publicId}'`)).rejects.toThrow(/listings_contact_email_check/)
  })
  it('allows owners to delete their own listings', async () => {
    expect((await asUser('authenticated', ownerId, `delete from public.listings where id = '${publicId}' returning id`)).rows).toEqual([{ id: publicId }])
  })
  it.each([[ownerId, 'published', true], [otherId, 'published', false], [ownerId, 'archived', false]])('checks insert ownership and status (%s, %s)', async (insertOwner, status, allowed) => {
    const result = asUser('authenticated', ownerId, `insert into public.listings (owner_id, title, province, canton, property_type, operation, price, currency, beds, baths, area_m2, image_url, status, district, contact_name, contact_phone, contact_email, latitude, longitude) values ('${insertOwner}', 'New house', 'Heredia', 'Belén', 'Casa', 'buy', 100, 'USD', 2, 1, 100, 'https://example.com/house.jpg', '${status}', ${contactColumns}) returning id`)
    if (allowed) expect((await result).rows).toHaveLength(1)
    else await expect(result).rejects.toThrow()
  })
})