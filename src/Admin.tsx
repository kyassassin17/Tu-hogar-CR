import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  BadgeCheck,
  Check,
  Clock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  deletePromotionPlan,
  fetchAllListings,
  removeListing,
  savePromotionPlan,
  setListingStatus,
} from './lib/admin'
import type { ListingRow } from './lib/listings'
import {
  fetchPendingPromotions,
  fetchPromotionPlans,
  promotionTotal,
  reviewPromotion,
  type PromotionPlanRow,
  type PromotionRow,
} from './lib/promotions'

type Section = 'payments' | 'plans' | 'listings'

const colones = (amount: number) => `₡${amount.toLocaleString('en-US')}`
const day = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function Admin({ user }: { user: User }) {
  const [section, setSection] = useState<Section>('payments')
  const [queue, setQueue] = useState<PromotionRow[]>([])
  const [plans, setPlans] = useState<PromotionPlanRow[]>([])
  const [listings, setListings] = useState<ListingRow[]>([])
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<PromotionPlanRow | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([fetchPendingPromotions(), fetchPromotionPlans(true), fetchAllListings(term)])
      .then(([pending, planRows, listingRows]) => {
        if (!active) return
        setQueue(pending)
        setPlans(planRows)
        setListings(listingRows)
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : 'No se pudo cargar el panel.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [refresh, term, user.id])

  async function act(action: () => Promise<unknown>, success: string) {
    if (busy) return false
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
      setRefresh((value) => value + 1)
      return true
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo completar la operación.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (await act(() => savePromotionPlan(data), 'Plan guardado.')) {
      setEditing(null)
      setCreating(false)
    }
  }

  const planForm = (plan: PromotionPlanRow | null) => (
    <form className="form-stack admin-plan-form" onSubmit={submitPlan}>
      <div className="form-row">
        <label>
          Identificador
          <input name="id" required defaultValue={plan?.id} readOnly={!!plan} maxLength={30} placeholder="destacado-30" />
        </label>
        <label>
          Nombre
          <input name="name" required defaultValue={plan?.name} minLength={3} maxLength={40} placeholder="Hogar Plus" />
        </label>
      </div>
      <label>
        Descripción
        <input name="description" required defaultValue={plan?.description} minLength={3} maxLength={120} />
      </label>
      <div className="form-row three-columns">
        <label>
          Precio sin IVA (₡)
          <input name="price_crc" type="number" required defaultValue={plan?.price_crc} min="500" max="1000000" step="1" />
        </label>
        <label>
          Duración (días)
          <input name="days" type="number" required defaultValue={plan?.days} min="1" max="365" step="1" />
        </label>
        <label>
          Orden
          <input name="sort_order" type="number" defaultValue={plan?.sort_order ?? 0} min="0" max="100" step="1" />
        </label>
      </div>
      <label>
        Beneficios (uno por línea, máximo 8)
        <textarea name="features" rows={4} defaultValue={plan?.features.join('\n')} />
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="active" defaultChecked={plan?.active ?? true} /> Plan visible para los vendedores
      </label>
      <div className="dialog-actions">
        <button type="button" className="button button-secondary" onClick={() => { setEditing(null); setCreating(false) }}>
          Cancelar
        </button>
        <button className="button button-primary" disabled={busy}><Check size={17} /> Guardar plan</button>
      </div>
    </form>
  )

  return (
    <div className="form-stack admin-panel">
      <div className="admin-tabs" role="tablist" aria-label="Secciones del panel">
        <button role="tab" aria-selected={section === 'payments'} className={section === 'payments' ? 'selected' : ''} onClick={() => setSection('payments')}>
          Pagos ({queue.length})
        </button>
        <button role="tab" aria-selected={section === 'plans'} className={section === 'plans' ? 'selected' : ''} onClick={() => setSection('plans')}>
          Planes ({plans.length})
        </button>
        <button role="tab" aria-selected={section === 'listings'} className={section === 'listings' ? 'selected' : ''} onClick={() => setSection('listings')}>
          Anuncios ({listings.length})
        </button>
        <button className="icon-button" title="Actualizar" aria-label="Actualizar panel" disabled={busy || loading} onClick={() => setRefresh((value) => value + 1)}>
          <RefreshCw size={17} />
        </button>
      </div>

      {error && <p role="alert" className="field-note">{error}</p>}
      {message && <p role="status" className="field-note">{message}</p>}
      {loading && <p role="status">Cargando el panel...</p>}

      {section === 'payments' && (
        <section className="form-stack">
          <h3><BadgeCheck size={19} /> Pagos SINPE Móvil por verificar</h3>
          {queue.length ? queue.map((promotion) => (
            <div className="admin-payment" key={promotion.id}>
              <div>
                <strong>{promotion.listings?.title ?? promotion.listing_id}</strong>
                <p className="field-note">
                  {colones(promotion.amount_crc)} · plan {promotion.plan} · {promotion.days} días ·
                  pagado desde {promotion.sinpe_phone} · comprobante <strong>{promotion.sinpe_reference}</strong>
                </p>
                <p className="field-note">
                  <Clock size={13} /> Solicitado el {day(promotion.created_at)} · Detalle esperado:{' '}
                  HOGARCR-{promotion.listing_id.slice(0, 8).toUpperCase()} · Contacto:{' '}
                  {promotion.listings?.contact_name} {promotion.listings?.contact_phone}
                </p>
              </div>
              <label>
                Nota de la revisión
                <input
                  value={notes[promotion.id] ?? ''}
                  maxLength={300}
                  placeholder="Obligatoria si rechazas el pago"
                  onChange={(event) => setNotes((previous) => ({ ...previous, [promotion.id]: event.target.value }))}
                />
              </label>
              <div className="dialog-actions">
                <button className="button button-secondary" disabled={busy} onClick={() => void act(() => reviewPromotion(promotion.id, 'rejected', notes[promotion.id] ?? ''), 'Solicitud rechazada.')}>
                  <X size={17} /> Rechazar
                </button>
                <button className="button button-primary" disabled={busy} onClick={() => void act(() => reviewPromotion(promotion.id, 'active', notes[promotion.id] ?? ''), 'Pago verificado y promoción activada.')}>
                  <Check size={17} /> Pago recibido, activar
                </button>
              </div>
            </div>
          )) : !loading && <p className="field-note">No hay pagos pendientes de verificación.</p>}
        </section>
      )}

      {section === 'plans' && (
        <section className="form-stack">
          <h3>Planes de promoción</h3>
          {creating ? planForm(null) : (
            <button className="button button-primary" onClick={() => { setCreating(true); setEditing(null) }}>
              <Plus size={17} /> Nuevo plan
            </button>
          )}
          {plans.map((plan) => editing?.id === plan.id ? (
            <div key={plan.id}>{planForm(plan)}</div>
          ) : (
            <div className="admin-payment" key={plan.id}>
              <div>
                <strong>{plan.name}</strong> <span className={`promotion-status ${plan.active ? 'status-active' : 'status-rejected'}`}>
                  {plan.active ? 'Visible' : 'Oculto'}
                </span>
                <p className="field-note">
                  {plan.id} · {colones(plan.price_crc)} + IVA = <strong>{colones(promotionTotal(plan))}</strong> · {plan.days} días · orden {plan.sort_order}
                </p>
                <p className="field-note">{plan.description}</p>
              </div>
              <div className="dialog-actions">
                <button className="button button-secondary" disabled={busy} onClick={() => { setEditing(plan); setCreating(false) }}>
                  <Pencil size={16} /> Editar
                </button>
                <button className="icon-button" disabled={busy} title="Eliminar plan" aria-label={`Eliminar plan ${plan.name}`} onClick={() => {
                  if (window.confirm(`¿Eliminar el plan "${plan.name}"?`)) void act(() => deletePromotionPlan(plan.id), 'Plan eliminado.')
                }}><Trash2 size={17} /></button>
              </div>
            </div>
          ))}
        </section>
      )}

      {section === 'listings' && (
        <section className="form-stack">
          <h3>Anuncios publicados</h3>
          <form className="admin-search" onSubmit={(event) => { event.preventDefault(); setTerm(search) }}>
            <label>
              Buscar por título, cantón, provincia o correo
              <input value={search} maxLength={60} placeholder="Ej. Escazú" onChange={(event) => setSearch(event.target.value)} />
            </label>
            <button className="button button-secondary"><Search size={16} /> Buscar</button>
          </form>
          <ul className="owner-listings">
            {listings.map((listing) => (
              <li key={listing.id}>
                <div>
                  <strong>{listing.title}</strong>
                  <p>
                    <span className={`promotion-status ${listing.status === 'published' ? 'status-active' : ''}`}>
                      {listing.status === 'published' ? 'Publicado' : 'Archivado'}
                    </span>{' '}
                    {listing.district}, {listing.canton}, {listing.province} · {listing.contact_name} ·{' '}
                    {listing.contact_email}
                    {listing.promoted_until && ` · destacado hasta ${day(listing.promoted_until)}`}
                  </p>
                </div>
                <div className="owner-listing-actions">
                  <button className="button button-secondary" disabled={busy} onClick={() => void act(
                    () => setListingStatus(listing.id, listing.status === 'published' ? 'archived' : 'published'),
                    listing.status === 'published' ? 'Anuncio archivado.' : 'Anuncio republicado.',
                  )}>
                    {listing.status === 'published' ? 'Archivar' : 'Republicar'}
                  </button>
                  <button className="icon-button" disabled={busy} title="Eliminar anuncio" aria-label={`Eliminar anuncio: ${listing.title}`} onClick={() => {
                    if (window.confirm(`¿Eliminar permanentemente "${listing.title}" y sus fotos?`)) void act(() => removeListing(listing.id), 'Anuncio eliminado.')
                  }}><Trash2 size={17} /></button>
                </div>
              </li>
            ))}
          </ul>
          {!listings.length && !loading && <p className="field-note">No hay anuncios que coincidan.</p>}
        </section>
      )}
    </div>
  )
}
