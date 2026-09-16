import { requireSupabase } from './supabase'

export type PromotionPlanId = 'essential' | 'plus' | 'premium'
export type PromotionPlan = {
  id: PromotionPlanId
  name: string
  price: number
  days: number
  description: string
  features: string[]
}
export type PromotionStatus = 'pending' | 'active' | 'rejected'
export type PromotionRow = {
  id: string
  listing_id: string
  owner_id: string
  plan: PromotionPlanId
  days: number
  amount_crc: number
  sinpe_phone: string
  sinpe_reference: string
  status: PromotionStatus
  review_note: string | null
  starts_at: string | null
  expires_at: string | null
  created_at: string
  listings?: { title: string; province: string; canton: string; contact_name: string; contact_phone: string } | null
}

export const promotionTaxRate = 0.13
export const promotionPlans: PromotionPlan[] = [
  {
    id: 'essential',
    name: 'Esencial',
    price: 9900,
    days: 7,
    description: 'Una primera impresión que cuenta.',
    features: [
      '7 días como propiedad destacada',
      'Insignia en tu anuncio',
      'Posición preferente en búsquedas',
    ],
  },
  {
    id: 'plus',
    name: 'Hogar Plus',
    price: 24900,
    days: 30,
    description: 'Más tiempo. Más oportunidades.',
    features: [
      '30 días como propiedad destacada',
      'Todo lo del plan Esencial',
      'Marcador destacado en el mapa',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 39900,
    days: 60,
    description: 'Tu propiedad en primer plano.',
    features: [
      '60 días como propiedad destacada',
      'Todo lo del plan Hogar Plus',
      'Mayor duración de exposición',
    ],
  },
]

export function promotionPlan(id: string) {
  const plan = promotionPlans.find((option) => option.id === id)
  if (!plan) throw new Error('Selecciona un plan de promoción válido.')
  return plan
}

export function promotionTotal(plan: PromotionPlan) {
  return Math.round(plan.price * (1 + promotionTaxRate))
}

export function promotionActive(expires: string | null | undefined) {
  return !!expires && Date.parse(expires) > Date.now()
}

/** SINPE Móvil account that receives the promotion payments. */
export function sinpeAccount() {
  const phone = String(import.meta.env.VITE_SINPE_PHONE || '').trim()
  const name = String(import.meta.env.VITE_SINPE_NAME || '').trim()
  return /^\+506 [5-8]\d{7}$/.test(phone) && name ? { phone, name } : null
}

export function normalizeSinpePhone(value: string) {
  const digits = value.replace(/[\s()-]/g, '').replace(/^\+?506/, '')
  if (!/^[5-8]\d{7}$/.test(digits)) throw new Error('Escribe el número SINPE Móvil de 8 dígitos desde el que pagaste.')
  return `+506 ${digits}`
}

export function normalizeSinpeReference(value: string) {
  const reference = value.trim().toUpperCase().replace(/\s+/g, '-')
  if (!/^[A-Z0-9-]{4,40}$/.test(reference)) {
    throw new Error('Copia el número de comprobante del SMS o del comprobante bancario.')
  }
  return reference
}

export function promotionRequest(data: FormData, ownerId: string) {
  const text = (key: string) => String(data.get(key) || '').trim()
  const listingId = text('listing_id')
  if (!ownerId || !listingId) throw new Error('Selecciona el anuncio que quieres promocionar.')
  const plan = promotionPlan(text('plan'))
  return {
    listing_id: listingId,
    owner_id: ownerId,
    plan: plan.id,
    days: plan.days,
    amount_crc: promotionTotal(plan),
    sinpe_phone: normalizeSinpePhone(text('sinpe_phone')),
    sinpe_reference: normalizeSinpeReference(text('sinpe_reference')),
    status: 'pending' as const,
  }
}

export async function createPromotionRequest(data: FormData, ownerId: string) {
  const { data: row, error } = await requireSupabase()
    .from('listing_promotions').insert(promotionRequest(data, ownerId)).select().single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('Ese comprobante ya fue registrado o el anuncio ya tiene una solicitud en revisión.')
    }
    throw new Error('No se pudo registrar tu pago. Revisa los datos e intenta de nuevo.')
  }
  return row as PromotionRow
}

export async function fetchOwnerPromotions(ownerId: string) {
  const { data, error } = await requireSupabase()
    .from('listing_promotions').select('*, listings(title, province, canton, contact_name, contact_phone)')
    .eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return data as PromotionRow[]
}

export async function fetchPendingPromotions() {
  const { data, error } = await requireSupabase()
    .from('listing_promotions').select('*, listings(title, province, canton, contact_name, contact_phone)')
    .eq('status', 'pending').order('created_at', { ascending: true }).limit(200)
  if (error) throw error
  return data as PromotionRow[]
}

export async function reviewPromotion(id: string, status: 'active' | 'rejected', note = '') {
  const review = note.trim()
  if (status === 'rejected' && !review) throw new Error('Explica por qué no se pudo verificar el pago.')
  const { data, error } = await requireSupabase().from('listing_promotions')
    .update({ status, review_note: review ? review.slice(0, 300) : null }).eq('id', id).eq('status', 'pending')
    .select().single()
  if (error || !data) throw new Error('No se pudo actualizar la promoción. Confirma que tu cuenta es administradora.')
  return data as PromotionRow
}

export async function isAdmin() {
  const { data, error } = await requireSupabase().rpc('is_admin')
  if (error) return false
  return data === true
}
