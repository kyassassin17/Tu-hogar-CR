import { describe, expect, it } from 'vitest'
import {
  exchangeRate,
  filterProperties,
  formatPrice,
  initialFilters,
  properties,
} from './marketplace'

describe('Costa Rican property search', () => {
  it('matches locations without accents and separates sales from rentals', () => {
    const results = filterProperties(properties, {
      ...initialFilters,
      query: 'san jose',
    })
    expect(results).toHaveLength(6)
    expect(results.every((property) => property.operation === 'buy')).toBe(true)
    expect(
      filterProperties(properties, { ...initialFilters, operation: 'rent' }),
    ).toHaveLength(4)
  })
  it('combines price, bedrooms, property type and amenities', () => {
    const results = filterProperties(properties, {
      ...initialFilters,
      type: 'Casa',
      beds: 3,
      maxPrice: '300000',
      amenity: 'Jardín',
    })
    expect(results.map((property) => property.id)).toEqual(['cr-103', 'cr-104'])
  })
  it('uses the displayed currency for price bounds', () => {
    const dollars = filterProperties(properties, {
      ...initialFilters,
      maxPrice: '200000',
    })
    const colones = filterProperties(properties, {
      ...initialFilters,
      maxPrice: String(200000 * exchangeRate),
      currency: 'CRC',
    })
    expect(colones).toEqual(dollars)
    expect(formatPrice(1000, 'CRC')).toBe('₡510,000')
  })
  it('sorts ascending and returns no matches for an unknown place', () => {
    const results = filterProperties(properties, {
      ...initialFilters,
      sort: 'price-asc',
    })
    expect(results[0].price).toBe(165000)
    expect(
      filterProperties(properties, { ...initialFilters, query: 'Atlantis' }),
    ).toEqual([])
  })
})
