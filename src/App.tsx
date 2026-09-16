import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Bath,
  BedDouble,
  Bell,
  Building2,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Heart,
  House,
  Images,
  LayoutGrid,
  Leaf,
  LocateFixed,
  LogOut,
  Mail,
  Map as MapIcon,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Trash2,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { User } from '@supabase/supabase-js'
import Account from './Account'
import Admin from './Admin'
import Promotions from './Promotions'
import ListingPhotoPicker from './ListingPhotoPicker'
import { demoMode, requireSupabase, supabase } from './lib/supabase'
import { createListing, fetchPublishedListings } from './lib/listings'
import { defaultPromotionPlans, isAdmin as checkAdmin } from './lib/promotions'
import { cantonsOf, locationCoordinates, provinces as costaRicaProvinces } from './lib/costaRica'
import 'leaflet/dist/leaflet.css'
import {
  amenityOptions,
  exchangeRate,
  filterProperties,
  formatPrice,
  imageUrl,
  initialFilters,
  properties,
  type Currency,
  type Filters,
  type Operation,
  type Property,
} from './marketplace'
import './App.css'

type ModalName =
  'filters' | 'saved' | 'publish' | 'promote' | 'account' | 'searches' | 'admin' | null
type Promotion = { propertyId: string; plan: string; expires: string }
type SavedSearch = { id: string; filters: Filters }
type Profile = { name: string; email: string }

function useLocalState<Value>(key: string, fallback: Value) {
  const [value, setValue] = useState<Value>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback
    } catch {
      return fallback
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      return
    }
  }, [key, value])
  return [value, setValue] as const
}

function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const reference = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    reference.current?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])
  return (
    <dialog
      ref={reference}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      aria-label={title}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Cerrar"
          title="Cerrar"
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  )
}

function MapBounds({
  listings,
  reset,
}: {
  listings: Property[]
  reset: number
}) {
  const map = useMap()
  const coordinatesKey = JSON.stringify(
    listings.map((property) => property.coordinates),
  )
  useEffect(() => {
    const coordinates: [number, number][] = JSON.parse(coordinatesKey)
    const container = map.getContainer()
    const fitProperties = () => {
      if (!container.clientWidth || !container.clientHeight) return
      map.invalidateSize()
      if (coordinates.length)
        map.fitBounds(L.latLngBounds(coordinates), {
          padding: [55, 65],
          maxZoom: 13,
          animate: false,
        })
    }
    const observer = new ResizeObserver(fitProperties)
    observer.observe(container)
    fitProperties()
    return () => observer.disconnect()
  }, [map, coordinatesKey, reset])
  return null
}

function PropertyMap({
  listings,
  currency,
  onSelect,
  activeId,
}: {
  listings: Property[]
  currency: Currency
  onSelect: (property: Property) => void
  activeId: string | null
}) {
  const [reset, setReset] = useState(0)
  return (
    <div className="map-panel">
      <MapContainer
        center={[9.94, -84.115]}
        zoom={12}
        zoomControl={false}
        scrollWheelZoom
        className="property-map"
        aria-label="Mapa de propiedades en Costa Rica"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds listings={listings} reset={reset} />
        <MapControls />
        {listings.map((property) => (
          <Marker
            key={property.id}
            position={property.coordinates}
            title={`${property.location}: ${formatPrice(property.price, currency, false, property.currency)}`}
            eventHandlers={{ click: () => onSelect(property) }}
            icon={L.divIcon({
              className: 'price-marker-container',
              html: `<span class="price-marker ${property.featured ? 'promoted-marker' : ''} ${activeId === property.id ? 'active-marker' : ''}">${property.featured ? '<span class="marker-star">★</span>' : ''}${formatPrice(property.price, currency, true, property.currency)}</span>`,
              iconSize: [95, 38],
              iconAnchor: [47, 38],
            })}
          >
            <Tooltip direction="top" offset={[0, -36]}>
              {property.type} en {property.location}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
      <div className="map-location">
        <span className="live-dot" />
        {listings.length} propiedades en esta búsqueda
      </div>
      <button
        className="map-reset icon-button"
        onClick={() => setReset((value) => value + 1)}
        title="Centrar propiedades"
        aria-label="Centrar propiedades"
      >
        <LocateFixed size={20} />
      </button>
      <div className="map-legend">
        <span className="legend-dot" /> En venta o alquiler{' '}
        <span className="legend-dot featured-dot" /> Destacada
      </div>
      <div className="map-notice">Ubicaciones aproximadas</div>
    </div>
  )
}

function MapControls() {
  const map = useMap()
  return (
    <div className="map-zoom leaflet-top leaflet-right">
      <button
        onClick={() => map.zoomIn()}
        aria-label="Acercar mapa"
        title="Acercar mapa"
      >
        <Plus size={20} />
      </button>
      <button
        onClick={() => map.zoomOut()}
        aria-label="Alejar mapa"
        title="Alejar mapa"
      >
        <span className="minus-symbol" />
      </button>
    </div>
  )
}

function PropertyCard({
  property,
  currency,
  saved,
  onSave,
  onSelect,
  onHover,
}: {
  property: Property
  currency: Currency
  saved: boolean
  onSave: () => void
  onSelect: () => void
  onHover?: (id: string | null) => void
}) {
  return (
    <article
      className="property-card"
      onMouseEnter={() => onHover?.(property.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <button
        className="property-open"
        onClick={onSelect}
        aria-label={`Ver ${property.title}`}
      >
        <div className="property-image">
          <img src={property.image} alt={property.title} loading="lazy" />
          <div className="property-badges">
            {property.featured && (
              <span className="badge badge-featured">
                <Sparkles size={11} /> DESTACADA
              </span>
            )}
            {property.tag && (
              <span
                className={`badge ${property.tag === 'NUEVA' ? 'badge-new' : 'badge-exclusive'}`}
              >
                {property.tag}
              </span>
            )}
          </div>
          <span className="image-count">
            <Images size={13} /> {property.images?.length || (demoMode ? 3 : 1)}
          </span>
          <span className="image-location">
            <MapPin size={13} />
            {property.location.split(',')[0]}
          </span>
        </div>
        <div className="property-body">
          <div className="property-status">
            <span />
            {property.type} en{' '}
            {property.operation === 'buy' ? 'venta' : 'alquiler'}
          </div>
          <h3>
            {formatPrice(property.price, currency, false, property.currency)}
            {property.operation === 'rent' && <small> / mes</small>}
          </h3>
          <p className="property-address">{property.location}</p>
          <div className="property-facts">
            <span>
              <BedDouble size={16} />
              <strong>{property.beds}</strong> hab.
            </span>
            <span>
              <Bath size={16} />
              <strong>{property.baths}</strong> baños
            </span>
            <span>
              <Square size={14} />
              <strong>{property.area}</strong> m²
            </span>
          </div>
        </div>
      </button>
      <button
        className={`favorite-button ${saved ? 'is-saved' : ''}`}
        onClick={onSave}
        aria-label={`${saved ? 'Quitar de' : 'Agregar a'} favoritos: ${property.location}`}
        title={saved ? 'Quitar de favoritos' : 'Guardar propiedad'}
      >
        <Heart size={19} fill={saved ? 'currentColor' : 'none'} />
      </button>
    </article>
  )
}

const planIcons = { essential: Zap, plus: Sparkles, premium: Star }
const plans = defaultPromotionPlans.map((plan) => ({
  ...plan,
  price: plan.price_crc,
  icon: planIcons[plan.id as keyof typeof planIcons] ?? Sparkles,
}))

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [admin, setAdmin] = useState(false)
  const [authLoading, setAuthLoading] = useState(!demoMode && !!supabase)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const [remoteProperties, setRemoteProperties] = useState<Property[]>([])
  const [listingsLoading, setListingsLoading] = useState(!demoMode)
  const [listingsError, setListingsError] = useState('')
  const [listingsRefresh, setListingsRefresh] = useState(0)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [publishProvince, setPublishProvince] = useState(costaRicaProvinces[0])
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [searchText, setSearchText] = useState(initialFilters.query)
  const [saved, setSaved] = useLocalState<string[]>('hogar-cr-favorites', [])
  const [customProperties, setCustomProperties] = useLocalState<Property[]>(
    'hogar-cr-listings',
    [],
  )
  const [promotions, setPromotions] = useLocalState<Promotion[]>(
    'hogar-cr-promotions',
    [],
  )
  const [savedSearches, setSavedSearches] = useLocalState<SavedSearch[]>(
    'hogar-cr-searches',
    [],
  )
  const [profile, setProfile] = useLocalState<Profile | null>(
    'hogar-cr-profile',
    null,
  )
  const [modal, setModalState] = useState<ModalName>(null)
  const [selected, setSelected] = useState<Property | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<'split' | 'list' | 'map'>('split')
  const [toast, setToast] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [planId, setPlanId] = useState('plus')
  const [promotionProperty, setPromotionProperty] = useState('cr-101')
  const [checkout, setCheckout] = useState(false)
  const [promotionComplete, setPromotionComplete] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [contactSent, setContactSent] = useState(false)
  const [filterError, setFilterError] = useState('')
  function setModal(next: ModalName) {
    if (next !== 'publish') {
      setPhotos([])
      setPublishError('')
    } else {
      setPublishProvince(costaRicaProvinces[0])
    }
    setModalState(next)
  }
  const allProperties = demoMode ? [...customProperties, ...properties].map(
    (property) => ({
      ...property,
      featured:
        property.featured ||
        promotions.some(
          (promotion) =>
            promotion.propertyId === property.id &&
            Date.parse(promotion.expires) > Date.now(),
        ),
    }),
  ) : remoteProperties
  const listings = filterProperties(allProperties, filters)
  const favorites = allProperties.filter((property) =>
    saved.includes(property.id),
  )
  const owned = allProperties.filter((property) => property.owner)
  const selectedPlan = plans.find((plan) => plan.id === planId)!
  const filterCount =
    Number(!!filters.type) +
    Number(!!filters.minPrice || !!filters.maxPrice) +
    Number(filters.beds > 0) +
    (filters.amenities?.length ?? Number(!!filters.amenity))

  useEffect(() => {
    if (demoMode || !supabase) return
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      setUser(session?.user ?? null)
      setAdmin(false)
      setAuthLoading(false)
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setListingsLoading(true)
        setListingsError('')
        setListingsRefresh((value) => value + 1)
      }
    })
    supabase.auth.getSession().catch(() => {
      if (active) {
        setAuthLoading(false)
        setToast('No se pudo restaurar tu sesión. Inicia sesión de nuevo.')
      }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (demoMode) return
    let active = true
    fetchPublishedListings().then((rows) => {
      if (active) setRemoteProperties(rows)
    }).catch(() => {
      if (active) setListingsError('No se pudieron cargar las propiedades. Intenta de nuevo.')
    }).finally(() => {
      if (active) setListingsLoading(false)
    })
    return () => { active = false }
  }, [listingsRefresh, user?.id])

  useEffect(() => {
    if (demoMode || !user) return
    let active = true
    checkAdmin().then((isAdministrator) => {
      if (active) setAdmin(isAdministrator)
    })
    return () => { active = false }
  }, [user])

  function reloadListings() {
    setListingsLoading(true)
    setListingsError('')
    setListingsRefresh((value) => value + 1)
  }

  useEffect(() => {
    if (demoMode) return
    const refreshPhotos = () => setListingsRefresh((value) => value + 1)
    const timer = window.setInterval(refreshPhotos, 50 * 60 * 1000)
    window.addEventListener('focus', refreshPhotos)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshPhotos)
    }
  }, [])

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError('')
    try {
      let message = demoMode ? 'Perfil local cerrado.' : 'Sesión cerrada.'
      if (demoMode) setProfile(null)
      else {
        const { error } = await requireSupabase().auth.signOut({ scope: 'local' })
        if (error) {
          const { data, error: sessionError } = await requireSupabase().auth.getSession()
          if (sessionError || data.session) throw error
          message = 'Sesión cerrada en este navegador. No se pudo confirmar la revocación en el servidor.'
        }
        setUser(null)
        setAdmin(false)
      }
      setModal(null)
      setMobileNav(false)
      setPublishError('')
      setToast(message)
    } catch {
      setSignOutError('No se pudo cerrar sesión. Revisa tu conexión e intenta de nuevo.')
      setToast('No se pudo cerrar sesión. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setSigningOut(false)
    }
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4200)
    return () => clearTimeout(timer)
  }, [toast])

  function toggleSaved(id: string) {
    setSaved((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id],
    )
  }
  function changeOperation(operation: Operation) {
    setFilters((previous) => ({
      ...previous,
      operation,
      minPrice: '',
      maxPrice: '',
    }))
    setMobileNav(false)
  }
  function changeCurrency(currency: Currency) {
    if (currency === filters.currency) return
    const conversion = currency === 'CRC' ? exchangeRate : 1 / exchangeRate
    setFilters((previous) => ({
      ...previous,
      currency,
      minPrice: previous.minPrice
        ? String(Math.round(Number(previous.minPrice) * conversion))
        : '',
      maxPrice: previous.maxPrice
        ? String(Math.round(Number(previous.maxPrice) * conversion))
        : '',
    }))
  }
  function openProperty(property: Property) {
    setSelected(property)
    setModal(null)
    setPhotoIndex(0)
    setContactSent(false)
  }
  function openPromote() {
    setModal('promote')
    setCheckout(false)
    setPromotionComplete(false)
    setMobileNav(false)
  }
  function resetFilters() {
    setFilters({
      ...initialFilters,
      query: '',
      operation: filters.operation,
      currency: filters.currency,
    })
    setSearchText('')
  }
  function saveSearch() {
    if (
      savedSearches.some(
        (search) => JSON.stringify(search.filters) === JSON.stringify(filters),
      )
    ) {
      setToast('Esta búsqueda ya está guardada.')
      return
    }
    setSavedSearches((previous) => [
      ...previous,
      { id: crypto.randomUUID(), filters },
    ])
    setToast('Búsqueda guardada. Encuéntrala en tu perfil.')
  }
  async function publishProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (publishing) return
    const data = new FormData(event.currentTarget)
    photos.forEach((photo) => data.append('photos', photo))
    if (!demoMode) {
      if (!user || publishing) return
      setPublishing(true)
      setPublishError('')
      try {
        await createListing(data, user.id)
        setModal(null)
        reloadListings()
        setToast('Anuncio publicado. Ya está visible para todos.')
      } catch (error) {
        setPublishError(error instanceof Error ? error.message : 'No se pudo guardar el anuncio. Intenta de nuevo.')
      } finally {
        setPublishing(false)
      }
      return
    }
    setPublishing(true)
    setPublishError('')
    try {
    const images = await Promise.all(photos.map((photo) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('No se pudo leer la foto.'))
      reader.readAsDataURL(photo)
    })))
    if (data.get('image')) images.push(String(data.get('image')))
    const province = String(data.get('province'))
    const canton = String(data.get('canton'))
    const district = String(data.get('district'))
    const newProperty: Property = {
      id: `cr-${Date.now()}`,
      title: String(data.get('title')),
      location: `${district}, ${canton}, ${province}`,
      province,
      canton,
      district,
      contact: {
        name: String(data.get('contact_name')),
        phone: String(data.get('contact_phone')),
        email: String(data.get('contact_email')),
      },
      type: data.get('type') as Property['type'],
      operation: data.get('operation') as Operation,
      price: Number(data.get('price')),
      currency: data.get('currency') as Currency,
      beds: Number(data.get('beds')),
      baths: Number(data.get('baths')),
      area: Number(data.get('area')),
      image:
        images[0] ||
        imageUrl('photo-1600596542815-ffad4c1539a9'),
      images: images.length ? images : undefined,
      coordinates: locationCoordinates(province, canton)!,
      amenities: data.getAll('amenities').map(String),
      tag: 'NUEVA',
      owner: true,
    }
    try {
      localStorage.setItem('hogar-cr-listings', JSON.stringify([newProperty, ...customProperties]))
    } catch {
      throw new Error('No hay espacio en este navegador para estas fotos. Usa fotos más pequeñas en la demo.')
    }
    setCustomProperties((previous) => [newProperty, ...previous])
    setFilters({
      ...initialFilters,
      query: province,
      operation: newProperty.operation,
      currency: filters.currency,
    })
    setSearchText(province)
    setPromotionProperty(newProperty.id)
    setModal(null)
    setToast('Propiedad publicada en esta demo local.')
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'No se pudo guardar el anuncio.')
    } finally {
      setPublishing(false)
    }
  }
  function completePromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!demoMode) return
    setPromotions((previous) => [
      ...previous.filter(
        (promotion) => promotion.propertyId !== promotionProperty,
      ),
      {
        propertyId: promotionProperty,
        plan: selectedPlan.name,
        expires: new Date(
          Date.now() + selectedPlan.days * 86400000,
        ).toISOString(),
      },
    ])
    setPromotionComplete(true)
  }
  const selectedImages = allProperties.find((property) => property.id === selected?.id)?.images ?? selected?.images
  const gallery = selected
    ? selectedImages?.length ? selectedImages : demoMode ? [
        selected.image,
        imageUrl('photo-1600607687920-4e2a09cf159d'),
        imageUrl('photo-1600210492486-724fe5c67fb0'),
      ] : [selected.image]
    : []

  return (
    <>
      <header className="site-header">
        <a
          href={import.meta.env.BASE_URL}
          className="brand"
          aria-label="Encuentra tu Hogar-CR, inicio"
        >
          <span className="brand-icon">
            <House size={29} strokeWidth={2.2} />
            <span />
          </span>
          <span className="brand-name">
            Encuentra tu{' '}
            <strong>
              Hogar<span className="brand-country">-CR</span>
            </strong>
          </span>
        </a>
        <nav
          className={`main-nav ${mobileNav ? 'nav-open' : ''}`}
          aria-label="Navegación principal"
        >
          <button
            className={filters.operation === 'buy' ? 'nav-active' : ''}
            onClick={() => changeOperation('buy')}
          >
            Comprar
          </button>
          <button
            className={filters.operation === 'rent' ? 'nav-active' : ''}
            onClick={() => changeOperation('rent')}
          >
            Alquilar
          </button>
          <button
            onClick={() => {
              setModal('publish')
              setMobileNav(false)
            }}
          >
            Vender
          </button>
          <button className="promote-nav" onClick={openPromote}>
            <Sparkles size={15} /> Promocionar
          </button>
          {admin && (
            <button
              onClick={() => {
                setModal('admin')
                setMobileNav(false)
              }}
            >
              <ShieldCheck size={15} /> Panel
            </button>
          )}
        </nav>
        <div className="header-actions">
          <button
            className="saved-nav"
            onClick={() => setModal('saved')}
            aria-label={`Guardados (${saved.length})`}
            title="Propiedades guardadas"
          >
            <Heart size={18} />
            <span>Guardados</span>
            {saved.length > 0 && (
              <span className="saved-count">{saved.length}</span>
            )}
          </button>
          <span className="header-divider" />
          <button
            className="profile-button"
            onClick={() => setModal('account')}
            aria-label="Mi perfil"
            title="Mi perfil"
          >
            {demoMode && profile ? (
              profile.name.charAt(0).toUpperCase()
            ) : (
              <UserRound size={18} />
            )}
          </button>
          {(demoMode ? !!profile : !!user) && <button
            className="icon-button"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            disabled={signingOut || publishing}
            onClick={() => void signOut()}
          ><LogOut size={18} /></button>}
          <button
            className="button button-primary publish-button"
            onClick={() => setModal('publish')}
          >
            <Plus size={17} /> Publicar propiedad
          </button>
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="Abrir menú"
            aria-expanded={mobileNav}
          >
            <Menu size={22} />
          </button>
        </div>
      </header>
      <main>
        <section className="search-section" aria-label="Buscar propiedades">
          <div className="search-heading">
            <div>
              <div className="eyebrow">
                <span className="costa-rica-flag" /> HECHO PARA VIVIR EN COSTA
                RICA
              </div>
              <h1>
                Vende, compra o alquila en Costa Rica<span>.</span>
              </h1>
              <p>Encuentra ese lugar que se siente como vos.</p>
            </div>
            <div className="local-note">
              <span className="local-note-icon">
                <Leaf size={23} />
              </span>
              <div>
                De aquí, para vos.<small>Hogares en las 7 provincias</small>
              </div>
            </div>
          </div>
          <div className="search-bar">
            <div className="operation-tabs" aria-label="Tipo de operación">
              <button
                className={filters.operation === 'buy' ? 'selected' : ''}
                onClick={() => changeOperation('buy')}
              >
                Comprar
              </button>
              <button
                className={filters.operation === 'rent' ? 'selected' : ''}
                onClick={() => changeOperation('rent')}
              >
                Alquilar
              </button>
            </div>
            <form
              className="location-search"
              onSubmit={(event) => {
                event.preventDefault()
                setFilters((previous) => ({
                  ...previous,
                  query: searchText.trim(),
                }))
              }}
            >
              <MapPin size={19} />
              <input
                aria-label="Buscar ubicación"
                placeholder="Provincia, cantón o zona"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
              {searchText && (
                <button
                  type="button"
                  className="clear-search"
                  aria-label="Borrar ubicación"
                  onClick={() => {
                    setSearchText('')
                    setFilters((previous) => ({ ...previous, query: '' }))
                  }}
                >
                  <X size={15} />
                </button>
              )}
              <button
                className="search-submit"
                aria-label="Buscar propiedades"
                title="Buscar propiedades"
              >
                <Search size={20} />
              </button>
            </form>
            <div className="filter-select">
              <select
                aria-label="Tipo de propiedad"
                value={filters.type}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    type: event.target.value,
                  }))
                }
              >
                <option value="">Tipo de propiedad</option>
                <option>Casa</option>
                <option>Apartamento</option>
              </select>
              <ChevronDown size={15} />
            </div>
            <button
              className={`filter-button price-filter ${filters.minPrice || filters.maxPrice ? 'filter-active' : ''}`}
              onClick={() => setModal('filters')}
            >
              Precio <ChevronDown size={15} />
            </button>
            <button
              className="filter-button rooms-filter"
              onClick={() => setModal('filters')}
            >
              {filters.beds ? `${filters.beds}+ habitaciones` : 'Habitaciones'}
              <ChevronDown size={15} />
            </button>
            <button
              className={`filter-button all-filters ${filterCount ? 'filter-active' : ''}`}
              onClick={() => setModal('filters')}
              aria-label="Filtros"
            >
              <SlidersHorizontal size={17} />
              <span>Filtros</span>
              {filterCount > 0 && (
                <span className="filter-number">{filterCount}</span>
              )}
            </button>
          </div>
        </section>
        <section
          className={`marketplace view-${view}`}
          aria-label="Resultados de propiedades"
        >
          <div className="results-panel">
            <div className="breadcrumb">
              <span>Costa Rica</span>
              <ChevronRight size={12} />
              <span>{filters.query || 'Todas las provincias'}</span>
              <ChevronRight size={12} />
              <span>
                {filters.operation === 'buy' ? 'En venta' : 'En alquiler'}
              </span>
            </div>
            <div className="results-heading">
              <div>
                <h2>
                  {filters.operation === 'buy'
                    ? 'Un hogar para llamar tuyo'
                    : 'Tu próximo lugar para vivir'}
                </h2>
                <p>
                  <strong>{listings.length} propiedades</strong>{' '}
                  {filters.query ? `en ${filters.query}` : 'en Costa Rica'}
                </p>
              </div>
              <button
                className="save-search"
                onClick={saveSearch}
                aria-label="Guardar búsqueda"
              >
                <Bell size={16} />
                <span>Guardar búsqueda</span>
              </button>
            </div>
            <div className="results-toolbar">
              <label className="sort-select">
                <ArrowDownUp size={14} />
                <select
                  aria-label="Ordenar propiedades"
                  value={filters.sort}
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      sort: event.target.value,
                    }))
                  }
                >
                  <option value="recommended">Recomendados</option>
                  <option value="price-asc">Menor precio</option>
                  <option value="price-desc">Mayor precio</option>
                  <option value="newest">Más recientes</option>
                </select>
                <ChevronDown size={13} />
              </label>
              <div className="results-options">
                <div className="currency-toggle" aria-label="Moneda">
                  <button
                    className={filters.currency === 'USD' ? 'selected' : ''}
                    onClick={() => changeCurrency('USD')}
                  >
                    USD
                  </button>
                  <button
                    className={filters.currency === 'CRC' ? 'selected' : ''}
                    onClick={() => changeCurrency('CRC')}
                  >
                    CRC
                  </button>
                </div>
                <div className="view-toggle" aria-label="Vista de resultados">
                  <button
                    className={view === 'list' ? 'selected' : ''}
                    onClick={() => setView('list')}
                    title="Ver lista"
                    aria-label="Ver lista"
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    className={view !== 'list' ? 'selected' : ''}
                    onClick={() => setView(view === 'map' ? 'split' : 'map')}
                    title="Ver mapa"
                    aria-label="Ver mapa"
                  >
                    <MapIcon size={16} />
                    <span>Mapa</span>
                  </button>
                </div>
              </div>
            </div>
            {listingsLoading && !demoMode && <p role="status">Cargando propiedades...</p>}
            {listingsError && <div role="alert" className="empty-state">
              <p>{listingsError}</p>
              <button className="button button-secondary" onClick={reloadListings}>Reintentar</button>
            </div>}
            <div className="property-grid">
              {listings.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  currency={filters.currency}
                  saved={saved.includes(property.id)}
                  onSave={() => toggleSaved(property.id)}
                  onSelect={() => openProperty(property)}
                  onHover={setActiveId}
                />
              ))}
            </div>
            {!listings.length && (demoMode || (!listingsLoading && !listingsError)) && (
              <div className="empty-state">
                <Search size={36} />
                <h3>Tu hogar puede estar un poco más allá</h3>
                <p>No encontramos propiedades con estos filtros.</p>
                <button
                  className="button button-primary"
                  onClick={resetFilters}
                >
                  Ver todas las propiedades
                </button>
              </div>
            )}
            <div className="owner-banner">
              <div className="owner-banner-icon">
                <House size={24} />
                <Sparkles size={14} />
              </div>
              <div>
                <h3>Tu propiedad merece ser vista.</h3>
                <p>Dale un lugar destacado y conecta con su próximo dueño.</p>
              </div>
              <button onClick={openPromote}>
                Destacar propiedad <ArrowRight size={17} />
              </button>
            </div>
            <div className="results-bottom">
              <ShieldCheck size={14} />
              <span>Un nuevo comienzo, con toda la información.</span>
              <span className="demo-label">{demoMode ? 'Propiedades de demostración' : 'Conversión de referencia: ₡510/USD'}</span>
            </div>
            <footer className="site-footer">
              <span>© {new Date().getFullYear()} Encuentra tu Hogar-CR</span>
              <button onClick={() => setModal('account')}>Mi cuenta</button>
              <button onClick={() => setModal('account')}>Para propietarios</button>
              <span className="footer-pura-vida">
                Pura vida. Puro hogar. <Leaf size={12} />
              </span>
            </footer>
          </div>
          {view !== 'list' && (
            <PropertyMap
              listings={listings}
              currency={filters.currency}
              onSelect={openProperty}
              activeId={activeId}
            />
          )}
        </section>
        <button
          className="mobile-map-button button button-dark"
          onClick={() => setView(view === 'map' ? 'split' : 'map')}
        >
          {view === 'map' ? <LayoutGrid size={18} /> : <MapIcon size={18} />}
          {view === 'map' ? 'Ver propiedades' : 'Explorar mapa'}
        </button>
      </main>

      {modal === 'filters' && (
        <Dialog
          title="Encuentra tu espacio ideal"
          onClose={() => {
            setModal(null)
            setFilterError('')
          }}
        >
          <form
            className="dialog-content form-stack"
            onChange={() => setFilterError('')}
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const minimum = Number(data.get('minPrice'))
              const maximum = Number(data.get('maxPrice'))
              if (maximum && minimum > maximum) {
                setFilterError('El precio máximo debe ser mayor al mínimo.')
                return
              }
              setFilterError('')
              setFilters((previous) => ({
                ...previous,
                minPrice: String(data.get('minPrice')),
                maxPrice: String(data.get('maxPrice')),
                beds: Number(data.get('beds')),
                type: String(data.get('type')),
                amenity: '',
                amenities: data.getAll('amenities').map(String),
              }))
              setModal(null)
            }}
          >
            {filterError && (
              <p role="alert" className="form-error">
                {filterError}
              </p>
            )}
            <div className="field-label">Tipo de propiedad</div>
            <div className="radio-options">
              <label>
                <input
                  type="radio"
                  name="type"
                  value=""
                  defaultChecked={!filters.type}
                />
                <Building2 size={19} /> Todas
              </label>
              <label>
                <input
                  type="radio"
                  name="type"
                  value="Casa"
                  defaultChecked={filters.type === 'Casa'}
                />
                <House size={19} /> Casa
              </label>
              <label>
                <input
                  type="radio"
                  name="type"
                  value="Apartamento"
                  defaultChecked={filters.type === 'Apartamento'}
                />
                <Building2 size={19} /> Apartamento
              </label>
            </div>
            <div>
              <div className="field-label">
                Rango de precio ({filters.currency})
                {filters.operation === 'rent' ? ' por mes' : ''}
              </div>
              <div className="form-row">
                <label>
                  Desde
                  <input
                    name="minPrice"
                    type="number"
                    min="0"
                    placeholder="Sin mínimo"
                    defaultValue={filters.minPrice}
                  />
                </label>
                <label>
                  Hasta
                  <input
                    name="maxPrice"
                    type="number"
                    min="0"
                    placeholder="Sin máximo"
                    defaultValue={filters.maxPrice}
                  />
                </label>
              </div>
              {filters.currency === 'CRC' && (
                <p className="field-note">
                  Conversión de referencia: $1 = ₡510. No es una cotización en
                  tiempo real.
                </p>
              )}
            </div>
            <label>
              Habitaciones
              <select name="beds" defaultValue={filters.beds}>
                <option value="0">Cualquier cantidad</option>
                {[1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {count}+ habitaciones
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="amenity-fieldset">
              <legend className="field-label">Comodidades</legend>
              <div className="checkbox-grid">
                {amenityOptions.map((amenity) => (
                  <label key={amenity}>
                    <input type="checkbox" name="amenities" value={amenity} defaultChecked={(filters.amenities ?? [filters.amenity]).includes(amenity)} />
                    {amenity}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="dialog-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  resetFilters()
                  setModal(null)
                }}
              >
                Limpiar filtros
              </button>
              <button className="button button-primary">
                <Search size={17} /> Ver propiedades
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {modal === 'saved' && (
        <Dialog
          title="Tus lugares favoritos"
          onClose={() => setModal(null)}
          wide
        >
          <div className="dialog-content">
            <p className="dialog-subtitle">
              Esos hogares que te hacen imaginar un nuevo comienzo.
            </p>
            {favorites.length ? (
              <div className="property-grid">
                {favorites.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    currency={filters.currency}
                    saved
                    onSave={() => toggleSaved(property.id)}
                    onSelect={() => openProperty(property)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Heart size={38} />
                <h3>El próximo podría ser el indicado</h3>
                <p>Aún no tienes propiedades guardadas.</p>
                <button
                  className="button button-primary"
                  onClick={() => setModal(null)}
                >
                  Explorar propiedades <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {modal === 'account' && !demoMode && (
        <Dialog title="Mi cuenta" onClose={() => { setModal(null); reloadListings() }}>
          <div className="dialog-content">
            <Account key={user?.id || 'signed-out'} user={user} loading={authLoading} signingOut={signingOut} signOutError={signOutError} onPublish={() => { setPublishError(''); setModal('publish') }} onSignOut={signOut} />
          </div>
        </Dialog>
      )}

      {modal === 'account' && demoMode && (
        <Dialog
          title={profile ? `Hola, ${profile.name}` : 'Tu hogar empieza contigo'}
          onClose={() => setModal(null)}
        >
          <div className="dialog-content">
            {profile ? (
              <div className="form-stack">
                <div className="profile-summary">
                  <span className="profile-avatar">
                    {profile.name.charAt(0)}
                  </span>
                  <div>
                    <strong>{profile.name}</strong>
                    <p>{profile.email}</p>
                  </div>
                </div>
                <button
                  className="account-link"
                  onClick={() => setModal('saved')}
                >
                  <Heart size={19} /> Mis favoritos <span>{saved.length}</span>
                  <ChevronRight size={17} />
                </button>
                <button
                  className="account-link"
                  onClick={() => setModal('searches')}
                >
                  <Bell size={19} /> Mis búsquedas{' '}
                  <span>{savedSearches.length}</span>
                  <ChevronRight size={17} />
                </button>
                <button className="account-link" onClick={openPromote}>
                  <Sparkles size={19} /> Promocionar una propiedad{' '}
                  <ChevronRight size={17} />
                </button>
                <button
                  className="button button-secondary"
                  disabled={signingOut}
                  onClick={() => void signOut()}
                >
                  <LogOut size={18} /> Cerrar sesión
                </button>
                <p className="field-note">
                  Perfil de demostración guardado en este navegador. No es una
                  cuenta autenticada.
                </p>
              </div>
            ) : (
              <form
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault()
                  const data = new FormData(event.currentTarget)
                  setProfile({
                    name: String(data.get('name')),
                    email: String(data.get('email')),
                  })
                  setToast('Tu perfil local está listo.')
                }}
              >
                <p className="dialog-subtitle">
                  Tus favoritos, tus búsquedas y tu próximo capítulo.
                </p>
                <label>
                  Nombre
                  <input
                    name="name"
                    autoComplete="given-name"
                    required
                    maxLength={60}
                    placeholder="¿Cómo te llamas?"
                  />
                </label>
                <label>
                  Correo electrónico
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="vos@ejemplo.com"
                  />
                </label>
                <div className="demo-notice">
                  <ShieldCheck size={19} />
                  <p>
                    Demo local. Este perfil se guarda únicamente en tu
                    navegador; no se crea una cuenta ni se envían correos.
                  </p>
                </div>
                <button className="button button-primary">
                  Crear perfil local <ArrowRight size={17} />
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setModal('searches')}
                >
                  Ver mis búsquedas guardadas
                </button>
              </form>
            )}
          </div>
        </Dialog>
      )}

      {modal === 'searches' && (
        <Dialog title="Tus búsquedas guardadas" onClose={() => setModal(null)}>
          <div className="dialog-content form-stack">
            {savedSearches.length ? (
              savedSearches.map((search) => (
                <div className="saved-search-row" key={search.id}>
                  <button
                    onClick={() => {
                      setFilters(search.filters)
                      setSearchText(search.filters.query)
                      setModal(null)
                    }}
                  >
                    <Search size={18} />
                    <span>
                      <strong>
                        {search.filters.query || 'Toda Costa Rica'}
                      </strong>
                      <small>
                        {search.filters.operation === 'buy'
                          ? 'Comprar'
                          : 'Alquilar'}{' '}
                        · {search.filters.type || 'Todas las propiedades'}
                        {search.filters.beds
                          ? ` · ${search.filters.beds}+ hab.`
                          : ''}
                      </small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                  <button
                    className="icon-button"
                    title="Eliminar búsqueda"
                    aria-label={`Eliminar búsqueda ${search.filters.query}`}
                    onClick={() =>
                      setSavedSearches((previous) =>
                        previous.filter((item) => item.id !== search.id),
                      )
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <Bell size={36} />
                <h3>Aún no hay búsquedas guardadas</h3>
                <p>Tu próxima búsqueda puede ser el primer paso.</p>
              </div>
            )}
            <p className="field-note">
              Guardadas en este navegador. Las alertas por correo no están
              habilitadas.
            </p>
          </div>
        </Dialog>
      )}

      {modal === 'publish' && (
        <Dialog
          title="Un nuevo hogar para alguien más"
          onClose={() => { if (!publishing) setModal(null) }}
          wide
        >
          {!demoMode && !user ? <div className="dialog-content form-stack">
            <p>{authLoading ? 'Cargando tu sesión...' : 'Inicia sesión para publicar una propiedad.'}</p>
            <button className="button button-primary" disabled={authLoading} onClick={() => setModal('account')}><UserRound size={18} /> Iniciar sesión</button>
          </div> : <form
            className="dialog-content form-stack"
            onSubmit={publishProperty}
          >
            <p className="dialog-subtitle">
              Publica tu casa o apartamento. El próximo capítulo empieza aquí.
            </p>
            <div className="demo-notice">
              <House size={19} />
              <p>
                {demoMode ? 'Publicación de demostración: tu anuncio será visible solo en este navegador. Usa información de ejemplo.' : 'Todos los campos son obligatorios. Tu anuncio se publica de inmediato, sin revisión previa, con los datos de contacto que indiques.'}
              </p>
            </div>
            <label>
              Título del anuncio
              <input
                name="title"
                required
                minLength={5}
                maxLength={100}
                placeholder="Ej. Casa con jardín en Santa Ana"
              />
            </label>
            <div className="form-row">
              <label>
                Quiero
                <select name="operation" defaultValue="buy">
                  <option value="buy">Vender</option>
                  <option value="rent">Alquilar</option>
                </select>
              </label>
              <label>
                Tipo de propiedad
                <select name="type">
                  <option>Casa</option>
                  <option>Apartamento</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Provincia
                <select
                  name="province"
                  required
                  value={publishProvince}
                  onChange={(event) => setPublishProvince(event.target.value)}
                >
                  {costaRicaProvinces.map((province) => (
                    <option key={province}>{province}</option>
                  ))}
                </select>
              </label>
              <label>
                Cantón
                <select name="canton" required key={publishProvince}>
                  {cantonsOf(publishProvince).map((canton) => (
                    <option key={canton}>{canton}</option>
                  ))}
                </select>
              </label>
              <label>
                Distrito
                <input
                  name="district"
                  required
                  minLength={2}
                  maxLength={60}
                  placeholder="Ej. San Rafael"
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Precio de venta o alquiler mensual
                <input
                  name="price"
                  type="number"
                  required
                  min="1"
                  max="100000000000"
                  placeholder="250000"
                />
              </label>
              <label>
                Moneda
                <select name="currency">
                  <option value="USD">Dólares (USD)</option>
                  <option value="CRC">Colones (CRC)</option>
                </select>
              </label>
            </div>
            <div className="form-row three-columns">
              <label>
                Habitaciones
                <input
                  name="beds"
                  type="number"
                  required
                  min="0"
                  max="30"
                  defaultValue="3"
                />
              </label>
              <label>
                Baños
                <input
                  name="baths"
                  type="number"
                  required
                  min="1"
                  max="30"
                  defaultValue="2"
                />
              </label>
              <label>
                Área (m²)
                <input
                  name="area"
                  type="number"
                  required
                  min="1"
                  max="100000"
                  placeholder="150"
                />
              </label>
            </div>
            <ListingPhotoPicker files={photos} disabled={publishing} onChange={setPhotos} />
            <label>
              {photos.length || demoMode ? 'URL de otra foto (opcional)' : 'URL de foto (si no adjuntas archivos)'}
              <input
                name="image"
                type="url"
                required={!demoMode && !photos.length}
                maxLength={2048}
                placeholder="https://…"
                pattern="https://.*"
              />
              <span className="field-note">
                {demoMode ? 'Usa una imagen HTTPS. Sin foto, se mostrará una imagen de referencia.' : 'Foto real de la propiedad, con permiso de publicación. Solo HTTPS.'}
              </span>
            </label>
            <div>
              <div className="field-label">Comodidades</div>
              <div className="checkbox-grid">
                {amenityOptions.map((amenity) => (
                  <label key={amenity}>
                    <input type="checkbox" name="amenities" value={amenity} />
                    {amenity}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="field-label">Datos de contacto del anuncio</div>
              <p className="field-note">
                Estos datos se publican con la propiedad para que las personas
                interesadas te contacten directamente.
              </p>
              <label>
                Nombre de contacto
                <input
                  name="contact_name"
                  required
                  minLength={3}
                  maxLength={80}
                  placeholder="Ej. Ana Rodríguez"
                />
              </label>
              <div className="form-row">
                <label>
                  Teléfono
                  <input
                    name="contact_phone"
                    type="tel"
                    required
                    maxLength={20}
                    placeholder="8888 8888"
                  />
                </label>
                <label>
                  Correo de contacto
                  <input
                    name="contact_email"
                    type="email"
                    required
                    maxLength={254}
                    placeholder="vos@ejemplo.com"
                  />
                </label>
              </div>
            </div>
            <p className="field-note">
              Los precios CRC usan una referencia de ₡510 por dólar. El mapa
              muestra el centro aproximado del cantón seleccionado.
            </p>
            <div className="dialog-actions">
              <span className="field-note">Publicación gratuita</span>
              <button className="button button-primary" disabled={publishing}>
                <Plus size={18} /> {publishing ? 'Publicando...' : demoMode ? 'Publicar en la demo' : 'Publicar anuncio'}
              </button>
            </div>
            {publishError && <p role="alert">{publishError}</p>}
          </form>}
        </Dialog>
      )}

      {modal === 'admin' && admin && user && (
        <Dialog
          title="Panel de administración"
          onClose={() => { setModal(null); reloadListings() }}
          wide
        >
          <div className="dialog-content">
            <Admin key={user.id} user={user} />
          </div>
        </Dialog>
      )}

      {modal === 'promote' && !demoMode && (
        <Dialog
          title="Dale a tu propiedad más oportunidades"
          onClose={() => { setModal(null); reloadListings() }}
          wide
        >
          <div className="dialog-content">
            <Promotions
              key={user?.id || 'signed-out'}
              user={user}
              loading={authLoading}
              onSignIn={() => setModal('account')}
            />
          </div>
        </Dialog>
      )}

      {modal === 'promote' && demoMode && (
        <Dialog
          title={
            promotionComplete
              ? 'Tu propiedad tiene un nuevo lugar'
              : checkout
                ? 'Todo listo para destacar'
                : 'Dale a tu propiedad más oportunidades'
          }
          onClose={() => setModal(null)}
          wide
        >
          <div className="dialog-content">
            {promotionComplete ? (
              <div className="success-state">
                <span className="success-icon">
                  <CheckCheck size={36} />
                </span>
                <span className="eyebrow">PROMOCIÓN DE DEMOSTRACIÓN</span>
                <h3>
                  Tu próximo contacto empieza
                  <br />
                  con una buena primera impresión.
                </h3>
                <p>
                  {selectedPlan.name} activado por {selectedPlan.days} días para{' '}
                  <strong>
                    {
                      allProperties.find(
                        (property) => property.id === promotionProperty,
                      )?.location
                    }
                  </strong>
                  .
                </p>
                <div className="demo-notice">
                  <ShieldCheck size={19} />
                  <p>
                    No se realizó ningún cargo. Esta promoción solo existe en
                    este navegador.
                  </p>
                </div>
                <button
                  className="button button-primary"
                  onClick={() => {
                    const property = allProperties.find(
                      (item) => item.id === promotionProperty,
                    )
                    if (property) {
                      setFilters({
                        ...initialFilters,
                        query: property.province,
                        operation: property.operation,
                        currency: filters.currency,
                      })
                      setSearchText(property.province)
                    }
                    setModal(null)
                  }}
                >
                  Ver mi propiedad <ArrowRight size={17} />
                </button>
              </div>
            ) : checkout ? (
              <form className="form-stack" onSubmit={completePromotion}>
                <button
                  type="button"
                  className="back-link"
                  onClick={() => setCheckout(false)}
                >
                  <ArrowLeft size={16} /> Volver a los planes
                </button>
                <div className="checkout-property">
                  <img
                    src={
                      allProperties.find(
                        (property) => property.id === promotionProperty,
                      )?.image
                    }
                    alt="Propiedad a promocionar"
                  />
                  <div>
                    <span className="eyebrow">TU PROPIEDAD</span>
                    <h3>
                      {
                        allProperties.find(
                          (property) => property.id === promotionProperty,
                        )?.title
                      }
                    </h3>
                    <p>
                      {
                        allProperties.find(
                          (property) => property.id === promotionProperty,
                        )?.location
                      }
                    </p>
                  </div>
                </div>
                <div className="order-summary">
                  <div>
                    <span>Plan {selectedPlan.name}</span>
                    <strong>
                      ₡{selectedPlan.price.toLocaleString('en-US')}
                    </strong>
                  </div>
                  <div>
                    <span>Duración</span>
                    <span>{selectedPlan.days} días</span>
                  </div>
                  <div>
                    <span>IVA (13%)</span>
                    <span>
                      ₡
                      {Math.round(selectedPlan.price * 0.13).toLocaleString(
                        'en-US',
                      )}
                    </span>
                  </div>
                  <div className="order-total">
                    <strong>Total</strong>
                    <strong>
                      ₡
                      {Math.round(selectedPlan.price * 1.13).toLocaleString(
                        'en-US',
                      )}
                    </strong>
                  </div>
                </div>
                <div className="demo-notice">
                  <ShieldCheck size={22} />
                  <p>
                    <strong>Checkout de demostración</strong>
                    <br />
                    No ingreses datos bancarios. No se procesarán pagos ni se
                    realizará ningún cargo.
                  </p>
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" required /> Entiendo que esta es una
                  promoción local de prueba.
                </label>
                <button className="button button-primary">
                  <Sparkles size={17} /> Activar promoción de prueba
                </button>
              </form>
            ) : (
              <>
                <div className="promotion-intro">
                  <span className="promotion-emblem">
                    <Sparkles size={27} />
                  </span>
                  <p>
                    El hogar ideal para alguien.
                    <br />
                    <strong>La visibilidad ideal para vos.</strong>
                  </p>
                </div>
                <label className="promotion-property-select">
                  ¿Qué propiedad quieres destacar?
                  <select
                    value={promotionProperty}
                    onChange={(event) =>
                      setPromotionProperty(event.target.value)
                    }
                  >
                    {owned.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.location} · {property.type} ·{' '}
                        {property.operation === 'buy' ? 'Venta' : 'Alquiler'}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="promotion-plans">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      className={`plan-card ${plan.id === planId ? 'plan-selected' : ''}`}
                      onClick={() => setPlanId(plan.id)}
                      aria-pressed={plan.id === planId}
                    >
                      {plan.id === 'plus' && (
                        <span className="popular-plan">EL FAVORITO</span>
                      )}
                      <div className="plan-top">
                        <plan.icon size={23} />
                        <span className="plan-radio">
                          {plan.id === planId && <Check size={12} />}
                        </span>
                      </div>
                      <h3>{plan.name}</h3>
                      <p className="plan-description">{plan.description}</p>
                      <div className="plan-price">
                        ₡{plan.price.toLocaleString('en-US')}
                        <small> / {plan.days} días</small>
                      </div>
                      <p className="plan-tax">+ IVA · Pago único</p>
                      <ul>
                        {plan.features.map((feature) => (
                          <li key={feature}>
                            <Check size={15} />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
                <div className="promotion-bottom">
                  <span>
                    <ShieldCheck size={16} /> Sin suscripciones. Sin renovación
                    automática.
                  </span>
                  <button
                    className="button button-primary"
                    onClick={() => setCheckout(true)}
                  >
                    Continuar con {selectedPlan.name} <ArrowRight size={17} />
                  </button>
                </div>
                <p className="field-note promotion-disclaimer">
                  Demo: los planes y precios son ilustrativos. No hay pagos
                  reales ni garantías de contactos. Los anuncios destacados
                  conservan los filtros de búsqueda.
                </p>
              </>
            )}
          </div>
        </Dialog>
      )}

      {selected && (
        <Dialog
          title="Un lugar para tu próximo capítulo"
          onClose={() => setSelected(null)}
          wide
        >
          <div className="detail-gallery">
            <img
              src={gallery[photoIndex]}
              alt={`${selected.title}, foto ${photoIndex + 1}`}
            />
            {gallery.length > 1 && <button
              className="gallery-prev icon-button"
              onClick={() =>
                setPhotoIndex(
                  (photoIndex + gallery.length - 1) % gallery.length,
                )
              }
              aria-label="Foto anterior"
              title="Foto anterior"
            >
              <ChevronLeft size={22} />
            </button>}
            {gallery.length > 1 && <button
              className="gallery-next icon-button"
              onClick={() => setPhotoIndex((photoIndex + 1) % gallery.length)}
              aria-label="Siguiente foto"
              title="Siguiente foto"
            >
              <ChevronRight size={22} />
            </button>}
            <span className="gallery-count">
              <Images size={14} /> {photoIndex + 1} / {gallery.length} · {demoMode && !selectedImages?.length ? 'Fotos de referencia' : 'Fotos de la propiedad'}
            </span>
          </div>
          <div className="dialog-content detail-content">
            <div className="detail-main">
              <div className="detail-price-row">
                <div>
                  <span className="property-status">
                    <span />
                    {selected.type} en{' '}
                    {selected.operation === 'buy' ? 'venta' : 'alquiler'}
                  </span>
                  <h2>
                    {formatPrice(
                      selected.price,
                      filters.currency,
                      false,
                      selected.currency,
                    )}
                    {selected.operation === 'rent' && <small> / mes</small>}
                  </h2>
                </div>
                <button
                  className={`detail-save icon-button ${saved.includes(selected.id) ? 'is-saved' : ''}`}
                  onClick={() => toggleSaved(selected.id)}
                  aria-label="Guardar esta propiedad"
                  title="Guardar esta propiedad"
                >
                  <Heart
                    size={22}
                    fill={saved.includes(selected.id) ? 'currentColor' : 'none'}
                  />
                </button>
              </div>
              <h3 className="detail-title">{selected.title}</h3>
              <p className="detail-location">
                <MapPin size={16} />
                {selected.location}, Costa Rica
              </p>
              <div className="detail-facts">
                <span>
                  <BedDouble size={23} />
                  <strong>{selected.beds}</strong> habitaciones
                </span>
                <span>
                  <Bath size={23} />
                  <strong>{selected.baths}</strong> baños
                </span>
                <span>
                  <Square size={21} />
                  <strong>{selected.area} m²</strong> de construcción
                </span>
              </div>
              {demoMode && <><h3>Un espacio para vivir a tu manera</h3>
              <p className="detail-description">
                Descubre esta {selected.type.toLowerCase()} en{' '}
                {selected.location.split(',')[0]}, con espacios amplios y luz
                natural. Sus {selected.area} m² ofrecen el espacio para
                disfrutar de cada día, cerca de los servicios y de todo lo que
                importa.
              </p></>}
              <h3>Lo que hace especial este hogar</h3>
              <div className="amenities-list">
                {selected.amenities.map((amenity) => (
                  <span key={amenity}>
                    <CircleCheck size={16} />
                    {amenity}
                  </span>
                ))}
              </div>
              <p className="field-note">
                {demoMode ? 'Anuncio y fotografías de demostración. Ubicación aproximada. ' : 'Información proporcionada por el anunciante. Ubicación aproximada. '}
                {filters.currency !== (selected.currency || 'USD') &&
                  'Tipo de cambio de referencia: ₡510 por dólar.'}
              </p>
            </div>
            {selected.contact ? <aside className="contact-panel">
              <div className="agent-heading">
                <span className="agent-avatar">
                  <UserRound size={22} />
                </span>
                <div>
                  <strong>{selected.contact.name}</strong>
                  <span>
                    <ShieldCheck size={13} /> Persona anunciante
                  </span>
                </div>
              </div>
              <h3>Contacta directamente</h3>
              <a className="button button-primary" href={`tel:${selected.contact.phone.replace(/\s/g, '')}`}>
                <Phone size={17} /> {selected.contact.phone}
              </a>
              <a className="button button-secondary" href={`mailto:${encodeURIComponent(selected.contact.email)}`}>
                <Mail size={17} /> {selected.contact.email}
              </a>
              <p className="field-note">
                Datos de contacto publicados por quien anuncia la propiedad.
                Hogar-CR no intermedia ni verifica la negociación.
              </p>
            </aside> : demoMode ? <aside className="contact-panel">
              <div className="agent-heading">
                <span className="agent-avatar">
                  <UserRound size={22} />
                </span>
                <div>
                  <strong>Equipo Hogar-CR</strong>
                  <span>
                    <ShieldCheck size={13} /> Asesor de demostración
                  </span>
                </div>
              </div>
              {contactSent ? (
                <div className="contact-success">
                  <CircleCheck size={30} />
                  <h3>Consulta de prueba completada</h3>
                  <p>
                    Esta es una demo. No se ha enviado tu mensaje a un asesor.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setContactSent(false)}
                  >
                    Enviar otra consulta
                  </button>
                </div>
              ) : (
                <form
                  className="form-stack contact-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    setContactSent(true)
                  }}
                >
                  <h3>¿Te imaginas viviendo aquí?</h3>
                  <label>
                    Tu nombre
                    <input
                      required
                      name="name"
                      placeholder="Nombre"
                      defaultValue={profile?.name}
                    />
                  </label>
                  <label>
                    Correo electrónico
                    <input
                      required
                      name="email"
                      type="email"
                      placeholder="vos@ejemplo.com"
                      defaultValue={profile?.email}
                    />
                  </label>
                  <label>
                    Mensaje
                    <textarea
                      required
                      name="message"
                      rows={3}
                      defaultValue="Hola, me interesa esta propiedad. Me gustaría recibir más información."
                    />
                  </label>
                  <button className="button button-primary">
                    <MessageCircle size={17} /> Consultar propiedad
                  </button>
                  <p className="field-note">
                    Formulario de prueba. No se enviará información.
                  </p>
                </form>
              )}
            </aside> : <aside className="contact-panel"><h3>Contacto</h3><p>Este anuncio no tiene datos de contacto publicados.</p></aside>}
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={19} />
          {toast}
          <button onClick={() => setToast('')} aria-label="Cerrar notificación">
            <X size={16} />
          </button>
        </div>
      )}
    </>
  )
}

export default App
