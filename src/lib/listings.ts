import { amenityOptions, type Property } from '../marketplace'
import { cantonsByProvince, locationCoordinates, provinceCoordinates } from './costaRica'
import { promotionActive } from './promotions'
import { requireSupabase } from './supabase'
import { photoBucket, selectedPhotos, validateListingPhotos } from './listingPhotos'

export { provinceCoordinates }

export type ListingStatus = 'published' | 'archived'
export type ListingRow = {
  id: string
  owner_id: string
  title: string
  province: string
  canton: string
  district: string
  property_type: Property['type']
  operation: Property['operation']
  price: number
  currency: 'USD' | 'CRC'
  beds: number
  baths: number
  area_m2: number
  image_url: string | null
  image_paths?: string[]
  latitude: number | null
  longitude: number | null
  amenities: string[]
  contact_name: string
  contact_phone: string
  contact_email: string
  status: ListingStatus
  promoted_until?: string | null
}

export function listingToProperty(row: ListingRow, photos: string[] = []): Property {
  const images = [...photos, ...(row.image_url ? [row.image_url] : [])]
  return {
    id: row.id,
    title: row.title,
    location: [row.district, row.canton, row.province].filter(Boolean).join(', '),
    province: row.province,
    canton: row.canton,
    district: row.district,
    type: row.property_type,
    operation: row.operation,
    price: Number(row.price),
    currency: row.currency,
    beds: row.beds,
    baths: row.baths,
    area: Number(row.area_m2),
    image: images[0] || '',
    images,
    coordinates: row.latitude !== null && row.longitude !== null
      ? [Number(row.latitude), Number(row.longitude)]
      : locationCoordinates(row.province, row.canton) ?? provinceCoordinates['San José'],
    amenities: row.amenities,
    featured: promotionActive(row.promoted_until),
    contact: { name: row.contact_name, phone: row.contact_phone, email: row.contact_email },
  }
}

export function normalizePhone(value: string) {
  const digits = value.replace(/[\s()-]/g, '').replace(/^\+?506/, '')
  if (!/^[2-8]\d{7}$/.test(digits)) throw new Error('Agrega un teléfono de Costa Rica de 8 dígitos.')
  return `+506 ${digits}`
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
  const province = text('province')
  const canton = text('canton')
  const district = text('district')
  const propertyType = text('type')
  const operation = text('operation')
  const currency = text('currency')
  const amenities = [...new Set(data.getAll('amenities').map(String))]
  if (amenities.some((amenity) => !amenityOptions.includes(amenity))) {
    throw new Error('Selecciona comodidades de la lista.')
  }
  if (!ownerId || title.length < 5 || title.length > 100
    || !['Casa', 'Apartamento'].includes(propertyType) || !['buy', 'rent'].includes(operation) || !['USD', 'CRC'].includes(currency)) {
    throw new Error('Revisa el título y el tipo de anuncio.')
  }
  if (!Object.hasOwn(cantonsByProvince, province) || !Object.hasOwn(cantonsByProvince[province], canton)
    || district.length < 2 || district.length > 60) {
    throw new Error('Selecciona la provincia y el cantón, e indica el distrito de la propiedad.')
  }
  const contactName = text('contact_name')
  const contactEmail = text('contact_email')
  if (contactName.length < 3 || contactName.length > 80) {
    throw new Error('Agrega el nombre de contacto del anuncio.')
  }
  if (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) {
    throw new Error('Agrega un correo de contacto válido.')
  }
  const contactPhone = normalizePhone(text('contact_phone'))
  let image: URL | undefined
  if (text('image') || !selectedPhotos(data).length) {
    try {
      image = new URL(text('image'))
    } catch {
      throw new Error('Agrega fotos JPEG/PNG o una URL HTTPS de la propiedad.')
    }
    if (image.protocol !== 'https:' || image.username || image.password || image.href.length > 2048) {
      throw new Error('Agrega una URL HTTPS de una foto real de la propiedad.')
    }
  }
  const [latitude, longitude] = locationCoordinates(province, canton)!
  return {
    owner_id: ownerId,
    title,
    province,
    canton,
    district,
    property_type: propertyType as Property['type'],
    operation: operation as Property['operation'],
    currency: currency as 'USD' | 'CRC',
    price: number('price', 1, 100000000000),
    beds: number('beds', 0, 30, true),
    baths: number('baths', 1, 30, true),
    area_m2: number('area', 1, 100000),
    image_url: image?.href ?? null,
    latitude,
    longitude,
    amenities,
    contact_name: contactName,
    contact_phone: contactPhone,
    contact_email: contactEmail,
    status: 'published' as const,
  }
}

export async function fetchPublishedListings() {
  const { data, error } = await requireSupabase().from('listings').select('*')
    .eq('status', 'published').order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  const rows = data as ListingRow[]
  const paths = [...new Set(rows.flatMap((row) => row.image_paths ?? []))]
  const urls = new Map<string, string>()
  if (paths.length) {
    const { data: photos, error: photoError } = await requireSupabase().storage.from(photoBucket).createSignedUrls(paths, 3600)
    if (photoError) throw photoError
    for (const photo of photos ?? []) {
      if (photo.error || !photo.path || !photo.signedUrl) throw new Error('No se pudieron cargar las fotos.')
      urls.set(photo.path, photo.signedUrl)
    }
  }
  return rows.map((row) => listingToProperty(row, (row.image_paths ?? []).map((path) => urls.get(path)!).filter(Boolean)))
}

export async function fetchOwnedListings(ownerId: string) {
  const { data, error } = await requireSupabase().from('listings').select('*')
    .eq('owner_id', ownerId).order('created_at', { ascending: false })
  if (error) throw error
  return data as ListingRow[]
}

export async function createListing(data: FormData, ownerId: string) {
  const draft = listingDraft(data, ownerId)
  const files = selectedPhotos(data)
  await validateListingPhotos(files)
  const client = requireSupabase()
  const storage = client.storage.from(photoBucket)
  const paths: string[] = []
  try {
    for (const file of files) {
      const path = `${ownerId}/${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`
      const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw new Error('No se pudo subir la foto. Revisa tu conexión y la configuración de almacenamiento.')
      paths.push(path)
    }
    const { data: row, error } = await client.from('listings')
      .insert({ ...draft, image_paths: paths }).select().single()
    if (error) throw error
    return row as ListingRow
  } catch (error) {
    if (paths.length) {
      const { error: cleanupError } = await storage.remove(paths)
      if (cleanupError) throw new Error('No se guardó el anuncio y quedaron fotos sin asociar. Contacta al administrador.')
    }
    throw error
  }
}

export async function deleteListing(id: string, ownerId: string) {
  const { data, error } = await requireSupabase().from('listings')
    .delete().eq('id', id).eq('owner_id', ownerId).select('id,image_paths').single()
  if (error || !data) throw error || new Error('No se pudo eliminar el anuncio.')
  if (data.image_paths?.length) {
    const { error: photoError } = await requireSupabase().storage.from(photoBucket).remove(data.image_paths)
    if (photoError) throw new Error('Anuncio eliminado, pero no se pudieron eliminar sus fotos. Contacta al administrador.')
  }
}