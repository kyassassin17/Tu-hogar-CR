import type { Property } from '../marketplace'
import { requireSupabase } from './supabase'

export const provinceCoordinates: Record<string, [number, number]> = {
  'San José': [9.932, -84.084],
  Heredia: [10.002, -84.117],
  Alajuela: [10.016, -84.211],
  Cartago: [9.864, -83.919],
  Guanacaste: [10.633, -85.438],
  Puntarenas: [9.977, -84.834],
  Limón: [9.99, -83.036],
}

export type ListingStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived'
export type ListingRow = {
  id: string
  owner_id: string
  title: string
  province: string
  canton: string
  property_type: Property['type']
  operation: Property['operation']
  price: number
  currency: 'USD' | 'CRC'
  beds: number
  baths: number
  area_m2: number
  image_url: string | null
  latitude: number | null
  longitude: number | null
  amenities: string[]
  status: ListingStatus
}

export function listingToProperty(row: ListingRow): Property {
  return {
    id: row.id,
    title: row.title,
    location: `${row.canton}, ${row.province}`,
    province: row.province,
    type: row.property_type,
    operation: row.operation,
    price: Number(row.price),
    currency: row.currency,
    beds: row.beds,
    baths: row.baths,
    area: Number(row.area_m2),
    image: row.image_url || '',
    coordinates: row.latitude !== null && row.longitude !== null
      ? [Number(row.latitude), Number(row.longitude)]
      : provinceCoordinates[row.province] || provinceCoordinates['San José'],
    amenities: row.amenities,
  }
}

export function listingDraft(data: FormData, ownerId: string) {
  const text = (key: string) => String(data.get(key) || '').trim()
  const number = (key: string, minimum: number, maximum: number, integer = false) => {
    const value = Number(text(key))
    if (!text(key) || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
      throw new Error('Revisa los valores numéricos del anuncio.')
    }
    return value
  }
  const title = text('title')
  const canton = text('canton')
  const province = text('province')
  const propertyType = text('type')
  const operation = text('operation')
  const currency = text('currency')
  if (!ownerId || title.length < 5 || title.length > 100 || !canton || canton.length > 60 || !Object.hasOwn(provinceCoordinates, province)
    || !['Casa', 'Apartamento'].includes(propertyType) || !['buy', 'rent'].includes(operation) || !['USD', 'CRC'].includes(currency)) {
    throw new Error('Revisa el título, la ubicación y el tipo de anuncio.')
  }
  let image: URL
  try {
    image = new URL(text('image'))
  } catch {
    throw new Error('Agrega una URL HTTPS de una foto real de la propiedad.')
  }
  if (image.protocol !== 'https:' || image.username || image.password || image.href.length > 2048) {
    throw new Error('Agrega una URL HTTPS de una foto real de la propiedad.')
  }
  return {
    owner_id: ownerId,
    title,
    canton,
    province,
    property_type: propertyType as Property['type'],
    operation: operation as Property['operation'],
    currency: currency as 'USD' | 'CRC',
    price: number('price', 1, 100000000000),
    beds: number('beds', 0, 30, true),
    baths: number('baths', 1, 30, true),
    area_m2: number('area', 1, 100000),
    image_url: image.href,
    latitude: null,
    longitude: null,
    amenities: data.getAll('amenities').map(String),
    status: 'draft' as const,
  }
}

export async function fetchPublishedListings() {
  const { data, error } = await requireSupabase().from('listings').select('*')
    .eq('status', 'published').order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  return (data as ListingRow[]).map(listingToProperty)
}

export async function fetchOwnedListings(ownerId: string) {
  const { data, error } = await requireSupabase().from('listings').select('*')
    .eq('owner_id', ownerId).order('created_at', { ascending: false })
  if (error) throw error
  return data as ListingRow[]
}

export async function createListing(data: FormData, ownerId: string) {
  const { data: row, error } = await requireSupabase().from('listings')
    .insert(listingDraft(data, ownerId)).select().single()
  if (error) throw error
  return row as ListingRow
}

export async function submitListing(id: string, ownerId: string) {
  const { data, error } = await requireSupabase().from('listings')
    .update({ status: 'pending_review' }).eq('id', id).eq('owner_id', ownerId)
    .in('status', ['draft', 'rejected']).select('id').single()
  if (error || !data) throw error || new Error('No se pudo enviar el anuncio.')
}

export async function deleteListing(id: string, ownerId: string) {
  const { data, error } = await requireSupabase().from('listings')
    .delete().eq('id', id).eq('owner_id', ownerId).select('id').single()
  if (error || !data) throw error || new Error('No se pudo eliminar el anuncio.')
}