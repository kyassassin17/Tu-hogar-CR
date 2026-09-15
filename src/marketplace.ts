export type Currency = 'USD' | 'CRC'
export type Operation = 'buy' | 'rent'
export type Property = {
  id: string
  title: string
  location: string
  province: string
  type: 'Casa' | 'Apartamento'
  operation: Operation
  price: number
  currency?: Currency
  beds: number
  baths: number
  area: number
  image: string
  coordinates: [number, number]
  featured?: boolean
  tag?: string
  amenities: string[]
  owner?: boolean
}

export const exchangeRate = 510
export const imageUrl = (photo: string, width = 900) =>
  `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=85`

export const properties: Property[] = [
  {
    id: 'cr-101',
    title: 'Casa contemporánea rodeada de naturaleza',
    location: 'Escazú, San José',
    province: 'San José',
    type: 'Casa',
    operation: 'buy',
    price: 385000,
    beds: 3,
    baths: 3,
    area: 285,
    image: imageUrl('photo-1600596542815-ffad4c1539a9'),
    coordinates: [9.918, -84.145],
    featured: true,
    tag: 'EXCLUSIVA',
    amenities: [
      'Piscina',
      'Jardín',
      'Seguridad 24/7',
      'Parqueo para 2 vehículos',
    ],
    owner: true,
  },
  {
    id: 'cr-102',
    title: 'Luz, diseño y las mejores vistas de la ciudad',
    location: 'Rohrmoser, San José',
    province: 'San José',
    type: 'Apartamento',
    operation: 'buy',
    price: 189000,
    beds: 2,
    baths: 2,
    area: 94,
    image: imageUrl('photo-1600210492486-724fe5c67fb0'),
    coordinates: [9.947, -84.121],
    featured: true,
    amenities: ['Balcón', 'Gimnasio', 'Seguridad 24/7', 'Pet friendly'],
  },
  {
    id: 'cr-103',
    title: 'Tu refugio familiar en Santa Ana',
    location: 'Santa Ana, San José',
    province: 'San José',
    type: 'Casa',
    operation: 'buy',
    price: 295000,
    beds: 3,
    baths: 2,
    area: 210,
    image: imageUrl('photo-1600047509807-ba8f99d2cdde'),
    coordinates: [9.934, -84.19],
    tag: 'NUEVA',
    amenities: [
      'Jardín',
      'Terraza',
      'Pet friendly',
      'Parqueo para 2 vehículos',
    ],
  },
  {
    id: 'cr-104',
    title: 'Espacios abiertos para una vida tranquila',
    location: 'Curridabat, San José',
    province: 'San José',
    type: 'Casa',
    operation: 'buy',
    price: 245000,
    beds: 3,
    baths: 2,
    area: 185,
    image: imageUrl('photo-1600566753086-00f18fb6b3ea'),
    coordinates: [9.912, -84.033],
    amenities: ['Jardín', 'Terraza', 'Seguridad 24/7'],
  },
  {
    id: 'cr-105',
    title: 'Un apartamento con otra perspectiva',
    location: 'La Sabana, San José',
    province: 'San José',
    type: 'Apartamento',
    operation: 'buy',
    price: 165000,
    beds: 2,
    baths: 1,
    area: 78,
    image: imageUrl('photo-1600607687920-4e2a09cf159d'),
    coordinates: [9.936, -84.106],
    tag: 'NUEVA',
    amenities: ['Balcón', 'Piscina', 'Gimnasio', 'Pet friendly'],
  },
  {
    id: 'cr-106',
    title: 'Arquitectura moderna, esencia tropical',
    location: 'Moravia, San José',
    province: 'San José',
    type: 'Casa',
    operation: 'buy',
    price: 325000,
    beds: 4,
    baths: 3,
    area: 260,
    image: imageUrl('photo-1600607687939-ce8a6c25118c'),
    coordinates: [9.968, -84.048],
    amenities: ['Jardín', 'Oficina', 'Terraza', 'Parqueo para 2 vehículos'],
  },
  {
    id: 'cr-107',
    title: 'Vida junto al mar en una villa tropical',
    location: 'Tamarindo, Guanacaste',
    province: 'Guanacaste',
    type: 'Casa',
    operation: 'buy',
    price: 465000,
    beds: 3,
    baths: 3,
    area: 240,
    image: imageUrl('photo-1613490493576-7fde63acd811'),
    coordinates: [10.3, -85.835],
    featured: true,
    amenities: ['Piscina', 'Terraza', 'Jardín', 'Pet friendly'],
  },
  {
    id: 'cr-108',
    title: 'La comodidad de estar cerca de todo',
    location: 'Belén, Heredia',
    province: 'Heredia',
    type: 'Casa',
    operation: 'buy',
    price: 230000,
    beds: 3,
    baths: 2,
    area: 190,
    image: imageUrl('photo-1600047509782-20d39509f26d'),
    coordinates: [9.975, -84.178],
    amenities: ['Jardín', 'Seguridad 24/7', 'Pet friendly'],
  },
  {
    id: 'cr-201',
    title: 'Apartamento amueblado con vista a la ciudad',
    location: 'Rohrmoser, San José',
    province: 'San José',
    type: 'Apartamento',
    operation: 'rent',
    price: 1250,
    beds: 2,
    baths: 2,
    area: 90,
    image: imageUrl('photo-1600210492486-724fe5c67fb0'),
    coordinates: [9.945, -84.123],
    featured: true,
    amenities: ['Amueblado', 'Gimnasio', 'Balcón', 'Pet friendly'],
  },
  {
    id: 'cr-202',
    title: 'Casa familiar en condominio privado',
    location: 'Santa Ana, San José',
    province: 'San José',
    type: 'Casa',
    operation: 'rent',
    price: 1900,
    beds: 3,
    baths: 2,
    area: 200,
    image: imageUrl('photo-1600047509807-ba8f99d2cdde'),
    coordinates: [9.937, -84.18],
    amenities: ['Piscina', 'Jardín', 'Seguridad 24/7'],
    owner: true,
  },
  {
    id: 'cr-203',
    title: 'Un espacio propio en el corazón de Escazú',
    location: 'Escazú, San José',
    province: 'San José',
    type: 'Apartamento',
    operation: 'rent',
    price: 850,
    beds: 1,
    baths: 1,
    area: 65,
    image: imageUrl('photo-1600607687920-4e2a09cf159d'),
    coordinates: [9.923, -84.143],
    tag: 'NUEVA',
    amenities: ['Amueblado', 'Balcón', 'Pet friendly'],
  },
  {
    id: 'cr-204',
    title: 'Un hogar lleno de luz en Curridabat',
    location: 'Curridabat, San José',
    province: 'San José',
    type: 'Casa',
    operation: 'rent',
    price: 1450,
    beds: 3,
    baths: 2,
    area: 165,
    image: imageUrl('photo-1600566753086-00f18fb6b3ea'),
    coordinates: [9.919, -84.037],
    amenities: ['Jardín', 'Terraza', 'Seguridad 24/7'],
  },
]

export type Filters = {
  query: string
  operation: Operation
  type: string
  minPrice: string
  maxPrice: string
  beds: number
  amenity: string
  currency: Currency
  sort: string
}

export const initialFilters: Filters = {
  query: 'San José',
  operation: 'buy',
  type: '',
  minPrice: '',
  maxPrice: '',
  beds: 0,
  amenity: '',
  currency: 'USD',
  sort: 'recommended',
}

export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function filterProperties(listings: Property[], filters: Filters) {
  return listings
    .filter((property) => {
      const price = convertPrice(
        property.price,
        property.currency ?? 'USD',
        filters.currency,
      )
      return (
        property.operation === filters.operation &&
        normalize(`${property.location} ${property.title} Costa Rica`).includes(
          normalize(filters.query),
        ) &&
        (!filters.type || property.type === filters.type) &&
        (!filters.minPrice || price >= Number(filters.minPrice)) &&
        (!filters.maxPrice || price <= Number(filters.maxPrice)) &&
        property.beds >= filters.beds &&
        (!filters.amenity || property.amenities.includes(filters.amenity))
      )
    })
    .sort((first, second) =>
      filters.sort === 'price-asc'
        ? convertPrice(first.price, first.currency ?? 'USD', filters.currency) -
          convertPrice(second.price, second.currency ?? 'USD', filters.currency)
        : filters.sort === 'price-desc'
          ? convertPrice(second.price, second.currency ?? 'USD', filters.currency) -
            convertPrice(first.price, first.currency ?? 'USD', filters.currency)
          : filters.sort === 'newest'
            ? second.id.localeCompare(first.id)
            : Number(!!second.featured) - Number(!!first.featured),
    )
}

export function formatPrice(
  price: number,
  currency: Currency,
  compact = false,
  sourceCurrency: Currency = 'USD',
) {
  const amount = convertPrice(price, sourceCurrency, currency)
  if (compact && amount >= 1000000)
    return `${currency === 'CRC' ? '₡' : '$'}${Number((amount / 1000000).toFixed(1))} M`
  if (compact && amount >= 1000)
    return `${currency === 'CRC' ? '₡' : '$'}${Number((amount / 1000).toFixed(1))} mil`
  return `${currency === 'CRC' ? '₡' : '$'}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`
}

export function convertPrice(
  price: number,
  sourceCurrency: Currency,
  targetCurrency: Currency,
) {
  if (sourceCurrency === targetCurrency) return price
  return sourceCurrency === 'USD' ? price * exchangeRate : price / exchangeRate
}
