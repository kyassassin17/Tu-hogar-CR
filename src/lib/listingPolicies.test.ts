import initialMigration from '../../supabase/migrations/20260914000000_create_listings.sql?raw'
import moderationMigration from '../../supabase/migrations/20260915000000_harden_listing_moderation.sql?raw'
import photosMigration from '../../supabase/migrations/20260915010000_listing_photos.sql?raw'
import selfPublishingMigration from '../../supabase/migrations/20260916000000_self_publishing.sql?raw'
import promotionsMigration from '../../supabase/migrations/20260917000000_listing_promotions.sql?raw'
import adminMigration from '../../supabase/migrations/20260918000000_admin_panel.sql?raw'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ownerId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const archivedId = '33333333-3333-4333-8333-333333333333'
const publicId = '44444444-4444-4444-8444-444444444444'
const adminId = '55555555-5555-4555-8555-555555555555'
const promotionId = '66666666-6666-4666-8666-666666666666'
const contactColumns = "'San Antonio', 'Ana Rodríguez', '+506 88888888', 'ana@example.com', 9.9836, -84.1867"
let database: PGlite

beforeAll(async () => {
  database = new PGlite()
  await database.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${ownerId}', 'ana@example.com'), ('${otherId}', 'otro@example.com'), ('${adminId}', 'keylorcascante8@gmail.com');
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
  await database.exec(promotionsMigration)
  await database.exec(`insert into public.listing_promotions (id, listing_id, owner_id, plan, days, amount_crc, sinpe_phone, sinpe_reference)
    values ('${promotionId}', '${publicId}', '${ownerId}', 'plus', 30, 28137, '+506 88887777', 'SINPE-1001');`)
  await database.exec(adminMigration)
}, 30000)

afterAll(async () => { await database?.close() })

async function asUser(role: 'anon' | 'authenticated', userId: string, query: string) {
  return (await asUserAll(role, userId, [query]))[0]
}

async function asUserAll(role: 'anon' | 'authenticated', userId: string, queries: string[]) {
  await database.exec('begin')
  try {
    await database.exec(`set local role ${role}`)
    await database.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
    const results = []
    for (const query of queries) results.push(await database.query(query))
    return results
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

const columns = 'listing_id, owner_id, plan, days, amount_crc, sinpe_phone, sinpe_reference'
const request = (listing: string, owner: string, reference: string, amount = 28137) =>
  `insert into public.listing_promotions (${columns}) values ('${listing}', '${owner}', 'plus', 30, ${amount}, '+506 88887777', '${reference}') returning id`

describe('SINPE promotion payments', () => {
  it('keeps payment records private to their owner and the administrators', async () => {
    await expect(asUser('anon', '', 'select id from public.listing_promotions')).rejects.toThrow(/permission denied/)
    expect((await asUser('authenticated', otherId, 'select id from public.listing_promotions')).rows).toEqual([])
    expect((await asUser('authenticated', ownerId, 'select id from public.listing_promotions')).rows).toEqual([{ id: promotionId }])
    expect((await asUser('authenticated', adminId, 'select id from public.listing_promotions')).rows).toEqual([{ id: promotionId }])
  })
  it('accepts pending requests only for a published listing of the paying owner', async () => {
    await expect(asUser('authenticated', ownerId, request(archivedId, ownerId, 'SINPE-1002'))).rejects.toThrow(/row-level security/)
    await expect(asUser('authenticated', otherId, request(publicId, otherId, 'SINPE-1003'))).rejects.toThrow(/row-level security/)
    await expect(asUser('authenticated', ownerId, request(publicId, ownerId, 'SINPE-1001'))).rejects.toThrow(/duplicate key/)
    await expect(asUser('authenticated', ownerId, `insert into public.listing_promotions (${columns}, status) values ('${publicId}', '${ownerId}', 'plus', 30, 28137, '+506 88887777', 'SINPE-1004', 'active')`)).rejects.toThrow()
  })
  it('rejects receipts that are not a usable SINPE confirmation', async () => {
    await expect(asUserAll('authenticated', ownerId, [
      `delete from public.listing_promotions where id = '${promotionId}'`,
      request(publicId, ownerId, 'bad ref'),
    ])).rejects.toThrow(/sinpe_reference_check/)
  })
  it('never lets a seller activate a promotion or set the promoted window', async () => {
    expect((await asUser('authenticated', ownerId, `update public.listing_promotions set status = 'active' where id = '${promotionId}' returning status`)).rows).toEqual([])
    expect((await asUser('authenticated', ownerId, `update public.listings set promoted_until = now() + interval '30 days' where id = '${publicId}' returning promoted_until`)).rows).toEqual([{ promoted_until: null }])
    await expect(asUser('authenticated', ownerId, `update public.listing_promotions set days = 60 where id = '${promotionId}'`)).rejects.toThrow(/permission denied/)
  })
  it('promotes the listing when an administrator verifies the payment', async () => {
    const [review, listing] = await asUserAll('authenticated', adminId, [
      `update public.listing_promotions set status = 'active' where id = '${promotionId}' returning status, reviewed_by, expires_at > now() as running`,
      `select promoted_until > now() as promoted from public.listings where id = '${publicId}'`,
    ])
    expect(review.rows).toEqual([{ status: 'active', reviewed_by: adminId, running: true }])
    expect(listing.rows).toEqual([{ promoted: true }])
  })
  it('lets an administrator reject a payment and review every listing', async () => {
    expect((await asUser('authenticated', adminId, `update public.listing_promotions set status = 'rejected', review_note = 'No aparece el SINPE.' where id = '${promotionId}' returning status, reviewed_at is not null as reviewed`)).rows)
      .toEqual([{ status: 'rejected', reviewed: true }])
    expect((await asUser('authenticated', adminId, 'select id from public.listings order by id')).rows).toEqual([{ id: archivedId }, { id: publicId }])
  })
  it('lets sellers cancel a pending request but not another seller request', async () => {
    expect((await asUser('authenticated', otherId, `delete from public.listing_promotions where id = '${promotionId}' returning id`)).rows).toEqual([])
    expect((await asUser('authenticated', ownerId, `delete from public.listing_promotions where id = '${promotionId}' returning id`)).rows).toEqual([{ id: promotionId }])
  })
})

describe('administrator panel', () => {
  it('grants administrator rights only to the configured email', async () => {
    expect((await database.query('select user_id from public.admins')).rows).toEqual([{ user_id: adminId }])
    expect((await asUser('authenticated', adminId, 'select public.is_admin() as admin')).rows).toEqual([{ admin: true }])
    expect((await asUser('authenticated', ownerId, 'select public.is_admin() as admin')).rows).toEqual([{ admin: false }])
    expect((await asUser('anon', '', 'select public.is_admin() as admin')).rows).toEqual([{ admin: false }])
    await expect(asUser('authenticated', ownerId, `insert into public.admins (user_id) values ('${ownerId}')`)).rejects.toThrow(/permission denied/)
    await expect(asUser('authenticated', ownerId, 'select email from public.admin_emails')).rejects.toThrow(/permission denied/)
  })
  it('follows the email when an account is created or changed later', async () => {
    const lateId = '77777777-7777-4777-8777-777777777777'
    await database.exec('begin')
    try {
      await database.exec(`insert into auth.users values ('${lateId}', 'KeylorCascante8@Gmail.com ')`)
      expect((await database.query(`select count(*)::int as total from public.admins where user_id = '${lateId}'`)).rows).toEqual([{ total: 1 }])
      await database.exec(`update auth.users set email = 'otra@example.com' where id = '${lateId}'`)
      expect((await database.query(`select count(*)::int as total from public.admins where user_id = '${lateId}'`)).rows).toEqual([{ total: 0 }])
    } finally {
      await database.exec('rollback')
    }
  })
  it('publishes active plans and hides the rest from sellers', async () => {
    expect((await asUser('anon', '', 'select id from public.promotion_plans order by sort_order')).rows)
      .toEqual([{ id: 'essential' }, { id: 'plus' }, { id: 'premium' }])
    const [, hidden] = await asUserAll('authenticated', adminId, [
      "update public.promotion_plans set active = false where id = 'premium'",
      'select id from public.promotion_plans order by sort_order',
    ])
    expect(hidden.rows).toHaveLength(3)
    expect((await asUser('authenticated', ownerId, "update public.promotion_plans set price_crc = 500 where id = 'plus' returning id")).rows).toEqual([])
    await expect(asUser('authenticated', ownerId, "insert into public.promotion_plans (id, name, description, price_crc, days) values ('gratis', 'Gratis', 'Sin costo.', 500, 1)"))
      .rejects.toThrow(/row-level security/)
  })
  it('lets the administrator create, price, and retire plans', async () => {
    const [created, updated] = await asUserAll('authenticated', adminId, [
      "insert into public.promotion_plans (id, name, description, price_crc, days, features, sort_order) values ('destacado-30', 'Destacado', 'Un mes en primer plano.', 19900, 30, array['30 días destacado'], 4) returning id",
      "update public.promotion_plans set price_crc = 29900 where id = 'plus' returning price_crc",
    ])
    expect(created.rows).toEqual([{ id: 'destacado-30' }])
    expect(updated.rows).toEqual([{ price_crc: 29900 }])
    await expect(asUser('authenticated', adminId, "insert into public.promotion_plans (id, name, description, price_crc, days) values ('X', 'Malo', 'Identificador inválido.', 9900, 7)")).rejects.toThrow(/promotion_plans_id_check/)
    await expect(asUser('authenticated', adminId, "insert into public.promotion_plans (id, name, description, price_crc, days) values ('barato', 'Barato', 'Muy barato.', 10, 7)")).rejects.toThrow(/price_crc_check/)
    await expect(asUser('authenticated', adminId, "delete from public.promotion_plans where id = 'plus'")).rejects.toThrow(/foreign key|violates/)
  })
  it('charges the plan price stored in the database, not the one sent by the browser', async () => {
    const [, result] = await asUserAll('authenticated', ownerId, [
      `delete from public.listing_promotions where id = '${promotionId}'`,
      `insert into public.listing_promotions (listing_id, owner_id, plan, days, amount_crc, sinpe_phone, sinpe_reference)
       values ('${publicId}', '${ownerId}', 'premium', 1, 5, '+506 88887777', 'SINPE-2001') returning days, amount_crc`,
    ])
    expect(result.rows).toEqual([{ days: 60, amount_crc: 45087 }])
    await expect(asUserAll('authenticated', ownerId, [
      `delete from public.listing_promotions where id = '${promotionId}'`,
      `insert into public.listing_promotions (listing_id, owner_id, plan, days, amount_crc, sinpe_phone, sinpe_reference)
       values ('${publicId}', '${ownerId}', 'inexistente', 30, 28137, '+506 88887777', 'SINPE-2002')`,
    ])).rejects.toThrow(/promotion plan/)
  })
  it('lets the administrator archive, republish, and delete any listing', async () => {
    expect((await asUser('authenticated', adminId, `update public.listings set status = 'archived' where id = '${publicId}' returning status`)).rows).toEqual([{ status: 'archived' }])
    expect((await asUser('authenticated', adminId, `update public.listings set status = 'published' where id = '${archivedId}' returning status`)).rows).toEqual([{ status: 'published' }])
    expect((await asUser('authenticated', adminId, `delete from public.listings where id = '${publicId}' returning id`)).rows).toEqual([{ id: publicId }])
    expect((await asUser('authenticated', otherId, `delete from public.listings where id = '${publicId}' returning id`)).rows).toEqual([])
  })
  it('lets the administrator remove photos only after the listing is gone', async () => {
    expect((await asUser('authenticated', adminId, 'select name from storage.objects')).rows).toHaveLength(3)
    expect((await asUser('authenticated', adminId, `delete from storage.objects where name = '${ownerId}/${publicId}.jpg' returning name`)).rows).toEqual([])
    const [, removed] = await asUserAll('authenticated', adminId, [
      `delete from public.listings where id = '${publicId}'`,
      `delete from storage.objects where name = '${ownerId}/${publicId}.jpg' returning name`,
    ])
    expect(removed.rows).toEqual([{ name: `${ownerId}/${publicId}.jpg` }])
  })
})