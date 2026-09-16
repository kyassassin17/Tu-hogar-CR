import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  promotionActive,
  promotionPlan,
  promotionPlans,
  promotionRequest,
  promotionTotal,
  normalizeSinpePhone,
  normalizeSinpeReference,
  sinpeAccount,
} from './promotions'

function validForm() {
  const form = new FormData()
  form.set('listing_id', 'listing-1')
  form.set('plan', 'plus')
  form.set('sinpe_phone', '8888 8888')
  form.set('sinpe_reference', ' ab12-34 ')
  return form
}

describe('SINPE Móvil promotions', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each(['8714-3820', '87143820', '+506 8714 3820', '(506) 87143820'])('accepts the configured collection number %s', (configured) => {
    vi.stubEnv('VITE_SINPE_PHONE', configured)
    vi.stubEnv('VITE_SINPE_NAME', 'Encuentra tu hogar ltda.')
    expect(sinpeAccount()).toEqual({ phone: '+506 87143820', name: 'Encuentra tu hogar ltda.' })
  })

  it.each([['', 'Hogar'], ['2222 3333', 'Hogar'], ['87143820', '']])('disables promotions for phone %s and name %s', (phone, name) => {
    vi.stubEnv('VITE_SINPE_PHONE', phone)
    vi.stubEnv('VITE_SINPE_NAME', name)
    expect(sinpeAccount()).toBeNull()
  })
  it('charges the plan price plus 13% IVA', () => {
    expect(promotionPlans.map((plan) => promotionTotal(plan))).toEqual([11187, 28137, 45087])
    expect(promotionPlan('premium').days).toBe(60)
    expect(() => promotionPlan('free')).toThrow('plan')
  })

  it('builds a pending request with the paid amount and normalized payment data', () => {
    expect(promotionRequest(validForm(), 'seller')).toEqual({
      listing_id: 'listing-1',
      owner_id: 'seller',
      plan: 'plus',
      days: 30,
      amount_crc: 28137,
      sinpe_phone: '+506 88888888',
      sinpe_reference: 'AB12-34',
      status: 'pending',
    })
  })

  it.each([['+506 8888-8888', '+506 88888888'], ['(506) 7010 2030', '+506 70102030'], ['50688887777', '+506 88887777']])(
    'normalizes the paying phone %s', (input, expected) => {
      expect(normalizeSinpePhone(input)).toBe(expected)
    })

  it.each([['listing_id', ''], ['plan', 'gold'], ['sinpe_phone', '2222 3333'], ['sinpe_phone', '8888'], ['sinpe_reference', 'ab'], ['sinpe_reference', 'abc*123']])(
    'rejects invalid %s = %s', (key, value) => {
      const form = validForm()
      form.set(key, value)
      expect(() => promotionRequest(form, 'seller')).toThrow()
    })

  it('requires an authenticated owner', () => {
    expect(() => promotionRequest(validForm(), '')).toThrow()
    expect(normalizeSinpeReference('sinpe 12345')).toBe('SINPE-12345')
  })

  it('treats only unexpired promotions as active', () => {
    expect(promotionActive(null)).toBe(false)
    expect(promotionActive(new Date(Date.now() - 1000).toISOString())).toBe(false)
    expect(promotionActive(new Date(Date.now() + 86400000).toISOString())).toBe(true)
  })
})
