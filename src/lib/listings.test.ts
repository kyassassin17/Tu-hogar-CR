import { describe, expect, it } from 'vitest'
import { listingDraft, listingToProperty, type ListingRow } from './listings'

function validForm() {
  const form = new FormData()
  Object.entries({ title: 'Casa en Heredia', canton: 'Belén', province: 'Heredia', type: 'Casa', operation: 'buy', currency: 'CRC', price: '150000000', beds: '3', baths: '2', area: '180', image: 'https://example.com/house.jpg' })
    .forEach(([key, value]) => form.set(key, value))
  return form
}

describe('production listings', () => {
  it('creates only owner-bound drafts and preserves the seller currency', () => {
    const form = validForm()
    form.set('status', 'published')
    form.set('owner_id', 'someone-else')
    expect(listingDraft(form, 'seller')).toMatchObject({ owner_id: 'seller', status: 'draft', price: 150000000, currency: 'CRC', latitude: null, longitude: null })
  })

  it.each([['price', 'NaN'], ['price', '-1'], ['beds', '2.5'], ['baths', '0'], ['area', 'Infinity'], ['currency', 'EUR'], ['province', 'unknown'], ['title', 'tiny'], ['image', 'javascript:alert(1)'], ['image', 'http://example.com/house.jpg'], ['image', 'https://user:password@example.com/image']])('rejects invalid %s = %s', (key, value) => {
    const form = validForm()
    form.set(key, value)
    expect(() => listingDraft(form, 'seller')).toThrow()
  })

  it('requires an authenticated owner', () => {
    expect(() => listingDraft(validForm(), '')).toThrow()
  })

  it('maps database fields without adding fake photos, promotions, or ownership', () => {
    const row: ListingRow = { ...listingDraft(validForm(), 'seller'), id: 'listing', latitude: 10.01, longitude: -84.1 }
    expect(listingToProperty(row)).toMatchObject({ id: 'listing', price: 150000000, currency: 'CRC', area: 180, coordinates: [10.01, -84.1] })
    expect(listingToProperty(row).featured).toBeUndefined()
    expect(listingToProperty(row).owner).toBeUndefined()
  })

  it('uses an approximate province center when coordinates are absent', () => {
    const row: ListingRow = { ...listingDraft(validForm(), 'seller'), id: 'listing' }
    expect(listingToProperty(row).coordinates).toEqual([10.002, -84.117])
  })
})