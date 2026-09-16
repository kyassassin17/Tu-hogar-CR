import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  Check,
  Copy,
  Smartphone,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { fetchOwnedListings, type ListingRow } from './lib/listings'
import {
  createPromotionRequest,
  fetchOwnerPromotions,
  fetchPromotionPlans,
  promotionActive,
  promotionTotal,
  type PromotionPlanRow,
  type PromotionRow,
  sinpeAccount,
} from './lib/promotions'

const statusLabels = {
  pending: 'Pago en verificación',
  active: 'Promoción activa',
  rejected: 'Pago no verificado',
}
const colones = (amount: number) => `₡${amount.toLocaleString('en-US')}`
const promotionDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function Promotions({ user, loading, onSignIn }: {
  user: User | null
  loading: boolean
  onSignIn: () => void
}) {
  const [listings, setListings] = useState<ListingRow[]>([])
  const [promotions, setPromotions] = useState<PromotionRow[]>([])
  const [plans, setPlans] = useState<PromotionPlanRow[]>([])
  const [loadingData, setLoadingData] = useState(!!user)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [chosenPlan, setChosenPlan] = useState('')
  const [chosenListing, setChosenListing] = useState('')
  const [refresh, setRefresh] = useState(0)
  const account = sinpeAccount()
  const plan = plans.find((option) => option.id === chosenPlan) ?? plans[0]
  const total = plan ? promotionTotal(plan) : 0
  const listingId = listings.some((listing) => listing.id === chosenListing)
    ? chosenListing
    : listings[0]?.id ?? ''

  const load = useCallback(async (owner: string) => {
    const [owned, requests, planRows] = await Promise.all([
      fetchOwnedListings(owner),
      fetchOwnerPromotions(owner),
      fetchPromotionPlans(),
    ])
    return {
      listings: owned.filter((listing) => listing.status === 'published'),
      promotions: requests,
      plans: planRows,
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    load(user.id).then((state) => {
      if (!active) return
      setListings(state.listings)
      setPromotions(state.promotions)
      setPlans(state.plans)
    }).catch(() => {
      if (active) setError('No se pudieron cargar tus promociones. Intenta de nuevo.')
    }).finally(() => {
      if (active) setLoadingData(false)
    })
    return () => { active = false }
  }, [user, refresh, load])

  const pendingListing = promotions.some(
    (promotion) => promotion.status === 'pending' && promotion.listing_id === listingId,
  )
  const paymentNote = listingId ? `HOGARCR-${listingId.slice(0, 8).toUpperCase()}` : ''

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !user) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await createPromotionRequest(new FormData(event.currentTarget), user.id, plans)
      setMessage('Registramos tu pago. Verificaremos el SINPE Móvil y activaremos la promoción.')
      setRefresh((value) => value + 1)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo registrar el pago.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p role="status">Cargando tu sesión...</p>
  if (!user) {
    return (
      <div className="form-stack">
        <p>Inicia sesión para promocionar uno de tus anuncios.</p>
        <button className="button button-primary" onClick={onSignIn}>
          <UserRound size={18} /> Iniciar sesión
        </button>
      </div>
    )
  }

  return (
    <div className="form-stack">
      {error && <p role="alert" className="field-note">{error}</p>}
      {message && <p role="status" className="field-note">{message}</p>}
      {loadingData && <p role="status">Cargando tus anuncios...</p>}

      {!loadingData && !listings.length ? (
        <p>Publica un anuncio para poder destacarlo en las búsquedas.</p>
      ) : !loadingData && !plan ? (
        <p>No hay planes de promoción disponibles en este momento.</p>
      ) : plan ? (
        <form className="form-stack" onSubmit={submitRequest}>
          <label className="promotion-property-select">
            ¿Qué propiedad quieres destacar?
            <select name="listing_id" value={listingId} required onChange={(event) => setChosenListing(event.target.value)}>
              {listings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.title} · {listing.canton}, {listing.province}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="plan" value={plan.id} />
          <div className="promotion-plans">
            {plans.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`plan-card ${option.id === plan.id ? 'plan-selected' : ''}`}
                onClick={() => setChosenPlan(option.id)}
                aria-pressed={option.id === plan.id}
              >
                <div className="plan-top">
                  <Sparkles size={23} />
                  <span className="plan-radio">{option.id === plan.id && <Check size={12} />}</span>
                </div>
                <h3>{option.name}</h3>
                <p className="plan-description">{option.description}</p>
                <div className="plan-price">
                  {colones(option.price_crc)}
                  <small> / {option.days} días</small>
                </div>
                <p className="plan-tax">+ IVA · Pago único</p>
                <ul>
                  {option.features.map((feature) => (
                    <li key={feature}><Check size={15} />{feature}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          <div className="order-summary">
            <div><span>Plan {plan.name}</span><strong>{colones(plan.price_crc)}</strong></div>
            <div><span>Duración</span><span>{plan.days} días</span></div>
            <div><span>IVA (13%)</span><span>{colones(total - plan.price_crc)}</span></div>
            <div className="order-total"><strong>Total a transferir</strong><strong>{colones(total)}</strong></div>
          </div>

          {account ? (
            <div className="sinpe-steps">
              <h3><Smartphone size={19} /> Pagá con SINPE Móvil</h3>
              <ol>
                <li>Enviá <strong>{colones(total)}</strong> por SINPE Móvil al número <strong>{account.phone}</strong> ({account.name}).</li>
                <li>Escribí en el detalle: <strong>{paymentNote || 'HOGARCR'}</strong>
                  {paymentNote && <button
                    type="button"
                    className="icon-button"
                    title="Copiar detalle"
                    aria-label="Copiar detalle del pago"
                    onClick={() => void navigator.clipboard?.writeText(paymentNote)}
                  ><Copy size={15} /></button>}
                </li>
                <li>Anotá abajo el número de comprobante del SMS del banco. Verificamos el pago y activamos la promoción.</li>
              </ol>
            </div>
          ) : (
            <p role="alert" className="field-note">
              El número SINPE Móvil de cobro no está configurado. Contacta al administrador antes de pagar.
            </p>
          )}

          <div className="form-row">
            <label>
              Teléfono desde el que pagaste
              <input name="sinpe_phone" type="tel" required maxLength={20} placeholder="8888 8888" />
            </label>
            <label>
              Número de comprobante SINPE
              <input name="sinpe_reference" required maxLength={40} placeholder="Ej. 123456789" />
            </label>
          </div>
          <p className="field-note">
            Nunca pidas ni compartas claves ni códigos de un solo uso. Solo necesitamos el comprobante del SINPE Móvil.
          </p>
          <div className="dialog-actions">
            <span className="field-note">Verificación manual. Sin renovación automática.</span>
            <button className="button button-primary" disabled={busy || !account || pendingListing || !listingId}>
              <Sparkles size={17} /> {busy ? 'Enviando...' : 'Ya pagué, verificar promoción'}
            </button>
          </div>
          {pendingListing && <p className="field-note">Ese anuncio ya tiene un pago en verificación.</p>}
        </form>
      ) : null}

      {promotions.length > 0 && (
        <section className="form-stack">
          <h3>Mis promociones</h3>
          <ul className="owner-listings">
            {promotions.map((promotion) => (
              <li key={promotion.id}>
                <div>
                  <strong>{promotion.listings?.title ?? 'Anuncio'}</strong>
                  <p>
                    <span className={`promotion-status status-${promotion.status}`}>
                      {promotion.status === 'active' && promotionActive(promotion.expires_at)
                        ? statusLabels.active
                        : promotion.status === 'active'
                          ? 'Promoción finalizada'
                          : statusLabels[promotion.status]}
                    </span>{' '}
                    {`· ${promotion.days} días · ${colones(promotion.amount_crc)}`}
                    {promotion.expires_at && ` · hasta el ${promotionDate(promotion.expires_at)}`}
                  </p>
                  {promotion.review_note && <p className="field-note">{promotion.review_note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
