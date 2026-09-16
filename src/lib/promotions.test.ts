import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defaultPromotionPlans,
  promotionActive,
  promotionPlan,
  promotionRequest,
  promotionTotal,
  normalizeSinpePhone,
  normalizeSinpeReference,
  sinpeAccount,
} from './promotions'
import { planDraft } from './admin'

function validForm() {
  const form = new FormData()
  form.set('listing_id', 'listing-1')
  form.set('plan', 'plus')
  form.set('sinpe_phone', '8888 8888')
  form.set('sinpe_reference', ' ab12-34 ')
  return form
}

function validPlanForm() {
  const form = new FormData()
  form.set('id', 'Destacado-30')
  form.set('name', 'Destacado')
  form.set('description', 'Un mes en primer plano.')
  form.set('price_crc', '19900')
  form.set('days', '30')
  form.set('sort_order', '2')
  form.set('features', ' 30 días destacado \n\n Insignia en tu anuncio ')
  form.set('active', 'on')
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
    expect(defaultPromotionPlans.map((plan) => promotionTotal(plan))).toEqual([11187, 28137, 45087])
    expect(promotionPlan('premium', defaultPromotionPlans).days).toBe(60)
    expect(() => promotionPlan('free', defaultPromotionPlans)).toThrow('plan')
    expect(() => promotionPlan('plus', defaultPromotionPlans.map((plan) => ({ ...plan, active: false })))).toThrow('plan')
  })

  it('requests a plan without trusting browser-supplied prices', () => {
    expect(promotionRequest(validForm(), 'seller', defaultPromotionPlans)).toEqual({
      listing_id: 'listing-1',
      owner_id: 'seller',
      plan: 'plus',
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
      expect(() => promotionRequest(form, 'seller', defaultPromotionPlans)).toThrow()
    })

  it('requires an authenticated owner', () => {
    expect(() => promotionRequest(validForm(), '', defaultPromotionPlans)).toThrow()
    expect(normalizeSinpeReference('sinpe 12345')).toBe('SINPE-12345')
  })

  it('treats only unexpired promotions as active', () => {
    expect(promotionActive(null)).toBe(false)
    expect(promotionActive(new Date(Date.now() - 1000).toISOString())).toBe(false)
    expect(promotionActive(new Date(Date.now() + 86400000).toISOString())).toBe(true)
  })
})

describe('administrator promotion plans', () => {
  it('normalizes the identifier and the benefit list', () => {
    expect(planDraft(validPlanForm())).toEqual({
      id: 'destacado-30',
      name: 'Destacado',
      description: 'Un mes en primer plano.',
      price_crc: 19900,
      days: 30,
      sort_order: 2,
      features: ['30 días destacado', 'Insignia en tu anuncio'],
      active: true,
    })
  })

  it('hides a plan when the visibility box is unchecked', () => {
    const form = validPlanForm()
    form.delete('active')
    expect(planDraft(form).active).toBe(false)
  })

  it.each([['id', 'X'], ['id', '30-dias'], ['name', 'ab'], ['description', ''], ['price_crc', '100'], ['price_crc', '19900.5'], ['days', '0'], ['days', '400'], ['sort_order', '-1']])(
    'rejects invalid %s = %s', (key, value) => {
      const form = validPlanForm()
      form.set(key, value)
      expect(() => planDraft(form)).toThrow()
    })

  it('rejects too many or malformed benefits', () => {
    const form = validPlanForm()
    form.set('features', Array.from({ length: 9 }, (_, index) => `Beneficio ${index}`).join('\n'))
    expect(() => planDraft(form)).toThrow('8 beneficios')
    form.set('features', 'ab')
    expect(() => planDraft(form)).toThrow('8 beneficios')
  })
})
