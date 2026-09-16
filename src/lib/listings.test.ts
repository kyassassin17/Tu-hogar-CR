import { afterEach, describe, expect, it, vi } from 'vitest'
import { createListing, deleteListing, fetchPublishedListings, listingDraft, listingToProperty, type ListingRow } from './listings'
import * as backend from './supabase'
import { amenityOptions, filterProperties, initialFilters } from '../marketplace'
import { maxPhotoBytes, validateListingPhotos } from './listingPhotos'

function validForm() {
  const form = new FormData()
  Object.entries({ title: 'Casa en Heredia', canton: 'Belén', district: 'San Antonio', province: 'Heredia', type: 'Casa', operation: 'buy', currency: 'CRC', price: '150000000', beds: '3', baths: '2', area: '180', image: 'https://example.com/house.jpg', contact_name: 'Ana Rodríguez', contact_phone: '8888 8888', contact_email: 'ana@example.com' })
    .forEach(([key, value]) => form.set(key, value))
  return form
}

afterEach(() => vi.restoreAllMocks())

function mockBackend() {
  const storage = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    createSignedUrls: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  const query = {
    insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'listing' }, error: null }),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  const client = { from: vi.fn().mockReturnValue(query), storage: { from: vi.fn().mockReturnValue(storage) } }
  vi.spyOn(backend, 'requireSupabase').mockReturnValue(client as unknown as ReturnType<typeof backend.requireSupabase>)
  return { storage, query, client }
}

function photoForm() {
  const form = validForm()
  form.delete('image')
  form.append('photos', new File([new Uint8Array([255, 216, 255, 224])], 'house.jpg', { type: 'image/jpeg' }))
  return form
}

describe('photo storage workflows', () => {
  it('uploads to a unique owner path before publishing', async () => {
    const { query, storage } = mockBackend()
    await createListing(photoForm(), 'seller')
    const path = storage.upload.mock.calls[0][0]
    expect(path).toMatch(/^seller\/[0-9a-f-]+\.jpg$/)
    expect(storage.upload.mock.calls[0][2]).toEqual({ contentType: 'image/jpeg', upsert: false })
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ image_paths: [path], image_url: null, status: 'published' }))
    expect(storage.remove).not.toHaveBeenCalled()
  })
  it('cleans up uploaded photos when saving the listing fails', async () => {
    const { query, storage } = mockBackend()
    query.single.mockResolvedValue({ data: null, error: new Error('Database unavailable') })
    await expect(createListing(photoForm(), 'seller')).rejects.toThrow('Database unavailable')
    expect(storage.remove).toHaveBeenCalledWith([storage.upload.mock.calls[0][0]])
  })
  it('cleans up partial uploads without creating a listing', async () => {
    const { query, storage } = mockBackend()
    storage.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('Offline') })
    const form = photoForm()
    form.append('photos', form.get('photos')!)
    await expect(createListing(form, 'seller')).rejects.toThrow('subir la foto')
    expect(query.insert).not.toHaveBeenCalled()
    expect(storage.remove).toHaveBeenCalledWith([storage.upload.mock.calls[0][0]])
  })
  it('validates files before any upload', async () => {
    const { storage } = mockBackend()
    const form = photoForm()
    form.set('photos', new File(['fake'], 'fake.jpg', { type: 'image/jpeg' }))
    await expect(createListing(form, 'seller')).rejects.toThrow('contenido')
    expect(storage.upload).not.toHaveBeenCalled()
  })
  it('resolves uploaded images into signed gallery URLs', async () => {
    const { query, storage } = mockBackend()
    query.limit.mockResolvedValue({ data: [{ ...listingDraft(photoForm(), 'seller'), id: 'listing', image_paths: ['seller/photo.jpg'] }], error: null })
    storage.createSignedUrls.mockResolvedValue({ data: [{ path: 'seller/photo.jpg', signedUrl: 'https://example.com/signed.jpg' }], error: null })
    expect(await fetchPublishedListings()).toEqual([expect.objectContaining({ image: 'https://example.com/signed.jpg', images: ['https://example.com/signed.jpg'] })])
    expect(storage.createSignedUrls).toHaveBeenCalledWith(['seller/photo.jpg'], 3600)
  })
  it('removes photos after deleting the owner listing', async () => {
    const { query, storage } = mockBackend()
    query.single.mockResolvedValue({ data: { id: 'listing', image_paths: ['seller/photo.jpg'] }, error: null })
    await deleteListing('listing', 'seller')
    expect(query.eq).toHaveBeenCalledWith('owner_id', 'seller')
    expect(storage.remove).toHaveBeenCalledWith(['seller/photo.jpg'])
  })
})

describe('production listings', () => {
  it('accepts JPEG and PNG files without an external URL', async () => {
    const files = [new File([new Uint8Array([255, 216, 255, 224])], 'house.JPEG', { type: 'image/jpeg' }), new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'garden.png', { type: 'image/png' })]
    await expect(validateListingPhotos(files)).resolves.toBeUndefined()
    const form = validForm()
    form.delete('image')
    files.forEach((file) => form.append('photos', file))
    expect(listingDraft(form, 'seller').image_url).toBeNull()
    expect(listingToProperty({ ...listingDraft(form, 'seller'), id: 'photo-home' }, ['https://example.com/signed.jpg']).images).toEqual(['https://example.com/signed.jpg'])
  })

  it('rejects unsupported, empty, oversized, disguised, and excess photos', async () => {
    await expect(validateListingPhotos([new File(['gif'], 'house.gif', { type: 'image/gif' })])).rejects.toThrow('JPEG o PNG')
    await expect(validateListingPhotos([new File([], 'house.jpg', { type: 'image/jpeg' })])).rejects.toThrow('5 MB')
    await expect(validateListingPhotos([new File([new Uint8Array(maxPhotoBytes + 1)], 'house.jpg', { type: 'image/jpeg' })])).rejects.toThrow('5 MB')
    await expect(validateListingPhotos([new File(['not a photo'], 'house.png', { type: 'image/png' })])).rejects.toThrow('contenido')
    const photo = new File([new Uint8Array([255, 216, 255])], 'house.jpg', { type: 'image/jpeg' })
    await expect(validateListingPhotos(Array.from({ length: 9 }, () => photo))).rejects.toThrow('8 fotos')
  })
  it('round-trips every amenity and requires all selected filters', () => {
    const form = validForm()
    amenityOptions.forEach((amenity) => form.append('amenities', amenity))
    const property = listingToProperty({ ...listingDraft(form, 'seller'), id: 'garage-home' })
    expect(property.amenities).toHaveLength(30)
    expect(filterProperties([property], { ...initialFilters, query: '', amenities: ['Garaje', 'Piscina'] })).toEqual([property])
    expect(filterProperties([{ ...property, amenities: ['Piscina'] }], { ...initialFilters, query: '', amenities: ['Garaje', 'Piscina'] })).toEqual([])
    expect(filterProperties([property], { ...initialFilters, query: '', amenity: 'Garaje' })).toEqual([property])
    form.append('amenities', 'Unknown')
    expect(() => listingDraft(form, 'seller')).toThrow('comodidades')
  })
  it('publishes owner-bound listings with contact details and canton coordinates', () => {
    const form = validForm()
    form.set('status', 'archived')
    form.set('owner_id', 'someone-else')
    expect(listingDraft(form, 'seller')).toMatchObject({
      owner_id: 'seller', status: 'published', price: 150000000, currency: 'CRC',
      district: 'San Antonio', latitude: 9.9836, longitude: -84.1867,
      contact_name: 'Ana Rodríguez', contact_phone: '+506 88888888', contact_email: 'ana@example.com',
    })
  })

  it.each([['+506 8888-8888', '+506 88888888'], ['(506) 2222 3333', '+506 22223333'], ['7010 2030', '+506 70102030']])('normalizes the contact phone %s', (input, expected) => {
    const form = validForm()
    form.set('contact_phone', input)
    expect(listingDraft(form, 'seller').contact_phone).toBe(expected)
  })

  it.each([['price', 'NaN'], ['price', '-1'], ['beds', '2.5'], ['baths', '0'], ['area', 'Infinity'], ['currency', 'EUR'], ['province', 'unknown'], ['canton', 'Belen'], ['canton', 'Escazú'], ['canton', ''], ['district', ''], ['district', 'A'], ['contact_name', 'An'], ['contact_phone', '12345'], ['contact_phone', '9888 8888'], ['contact_email', 'ana@example'], ['contact_email', ''], ['title', 'tiny'], ['image', 'javascript:alert(1)'], ['image', 'http://example.com/house.jpg'], ['image', 'https://user:password@example.com/image']])('rejects invalid %s = %s', (key, value) => {
    const form = validForm()
    form.set(key, value)
    expect(() => listingDraft(form, 'seller')).toThrow()
  })

  it('requires an authenticated owner', () => {
    expect(() => listingDraft(validForm(), '')).toThrow()
  })

  it('maps database fields without adding fake photos, promotions, or ownership', () => {
    const row: ListingRow = { ...listingDraft(validForm(), 'seller'), id: 'listing', latitude: 10.01, longitude: -84.1 }
    expect(listingToProperty(row)).toMatchObject({
      id: 'listing', price: 150000000, currency: 'CRC', area: 180, coordinates: [10.01, -84.1],
      location: 'San Antonio, Belén, Heredia',
      contact: { name: 'Ana Rodríguez', phone: '+506 88888888', email: 'ana@example.com' },
    })
    expect(listingToProperty(row).featured).toBeUndefined()
    expect(listingToProperty(row).owner).toBeUndefined()
  })

  it('uses an approximate canton center when coordinates are absent', () => {
    const row: ListingRow = { ...listingDraft(validForm(), 'seller'), id: 'listing', latitude: null, longitude: null }
    expect(listingToProperty(row).coordinates).toEqual([9.9836, -84.1867])
  })
})