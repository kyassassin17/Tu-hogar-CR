import { photoBucket } from './listingPhotos'
import type { ListingRow, ListingStatus } from './listings'
import { requireSupabase } from './supabase'
import type { PromotionPlanRow } from './promotions'

export type PlanDraft = {
  id: string
  name: string
  description: string
  price_crc: number
  days: number
  features: string[]
  sort_order: number
  active: boolean
}

export function planDraft(data: FormData): PlanDraft {
  const text = (key: string) => String(data.get(key) || '').trim()
  const id = text('id').toLowerCase()
  const name = text('name')
  const description = text('description')
  const price = Number(text('price_crc'))
  const days = Number(text('days'))
  const sortOrder = Number(text('sort_order') || '0')
  const features = text('features').split('\n').map((line) => line.trim()).filter(Boolean)
  if (!/^[a-z][a-z0-9-]{2,29}$/.test(id)) {
    throw new Error('El identificador del plan usa minúsculas, números y guiones, de 3 a 30 caracteres.')
  }
  if (name.length < 3 || name.length > 40) throw new Error('El nombre del plan debe tener entre 3 y 40 caracteres.')
  if (description.length < 3 || description.length > 120) throw new Error('La descripción debe tener entre 3 y 120 caracteres.')
  if (!Number.isInteger(price) || price < 500 || price > 1000000) {
    throw new Error('El precio debe ser un monto entero en colones entre 500 y 1.000.000.')
  }
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('La duración debe ser de 1 a 365 días.')
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100) throw new Error('El orden debe ser un número de 0 a 100.')
  if (features.length > 8 || features.some((feature) => feature.length < 3 || feature.length > 80)) {
    throw new Error('Agrega hasta 8 beneficios de 3 a 80 caracteres cada uno.')
  }
  return { id, name, description, price_crc: price, days, features, sort_order: sortOrder, active: data.get('active') !== null }
}

export async function savePromotionPlan(data: FormData) {
  const { data: row, error } = await requireSupabase()
    .from('promotion_plans').upsert(planDraft(data)).select().single()
  if (error) throw new Error('No se pudo guardar el plan. Revisa los datos e intenta de nuevo.')
  return row as PromotionPlanRow
}

export async function deletePromotionPlan(id: string) {
  const { error } = await requireSupabase().from('promotion_plans').delete().eq('id', id)
  if (error) {
    throw new Error(error.code === '23503'
      ? 'Ese plan ya tiene pagos registrados. Desactívalo en lugar de eliminarlo.'
      : 'No se pudo eliminar el plan.')
  }
}

export async function fetchAllListings(search = '') {
  let query = requireSupabase().from('listings').select('*')
    .order('created_at', { ascending: false }).limit(200)
  // PostgREST parses commas and parentheses inside `or`, so only plain words reach the filter.
  const term = search.replace(/[^\p{L}\p{N} .@-]/gu, ' ').trim().slice(0, 60)
  if (term) query = query.or(`title.ilike.*${term}*,canton.ilike.*${term}*,province.ilike.*${term}*,contact_email.ilike.*${term}*`)
  const { data, error } = await query
  if (error) throw new Error('No se pudieron cargar los anuncios.')
  return data as ListingRow[]
}

export async function setListingStatus(id: string, status: ListingStatus) {
  const { data, error } = await requireSupabase().from('listings')
    .update({ status }).eq('id', id).select('id,status').single()
  if (error || !data) throw new Error('No se pudo cambiar el estado del anuncio.')
  return data as { id: string; status: ListingStatus }
}

export async function removeListing(id: string) {
  const { data, error } = await requireSupabase().from('listings')
    .delete().eq('id', id).select('id,image_paths').single()
  if (error || !data) throw new Error('No se pudo eliminar el anuncio.')
  if (data.image_paths?.length) {
    const { error: photoError } = await requireSupabase().storage.from(photoBucket).remove(data.image_paths)
    if (photoError) throw new Error('Anuncio eliminado, pero quedaron fotos almacenadas. Elimínalas desde Supabase.')
  }
}
