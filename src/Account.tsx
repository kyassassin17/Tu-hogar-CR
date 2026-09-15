import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, LogOut, Mail, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { deleteListing, fetchOwnedListings, submitListing, type ListingRow } from './lib/listings'
import { requireSupabase, supabase } from './lib/supabase'

const statusLabels = {
  draft: 'Borrador',
  pending_review: 'En revisión',
  published: 'Publicado',
  rejected: 'Rechazado',
  archived: 'Archivado',
}

export default function Account({ user, loading, signingOut, signOutError, onPublish, onSignOut }: {
  user: User | null
  loading: boolean
  signingOut: boolean
  signOutError: string
  onPublish: () => void
  onSignOut: () => Promise<void>
}) {
  const [listings, setListings] = useState<ListingRow[]>([])
  const [busy, setBusy] = useState(false)
  const [loadingListings, setLoadingListings] = useState(!!user)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    fetchOwnedListings(user.id).then((rows) => {
      if (active) setListings(rows)
    }).catch(() => {
      if (active) setError('No se pudieron cargar tus anuncios. Intenta de nuevo.')
    }).finally(() => {
      if (active) setLoadingListings(false)
    })
    return () => { active = false }
  }, [user, refresh])

  useEffect(() => {
    if (!emailSent) return
    const timer = setTimeout(() => setEmailSent(false), 60000)
    return () => clearTimeout(timer)
  }, [emailSent])

  function reloadListings() {
    setLoadingListings(true)
    setError('')
    setRefresh((value) => value + 1)
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || emailSent) return
    const email = String(new FormData(event.currentTarget).get('email') || '').trim()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: authError } = await requireSupabase().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href },
      })
      if (authError) throw authError
      setMessage('Revisa tu correo para confirmar tu cuenta e iniciar sesión. El enlace es de un solo uso.')
      setEmailSent(true)
    } catch {
      setError('No se pudo enviar el enlace. Revisa tu correo e intenta de nuevo más tarde.')
    } finally {
      setBusy(false)
    }
  }

  async function act(action: () => Promise<unknown>, success: string) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
      reloadListings()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo completar la operación. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p role="status">Cargando tu sesión...</p>
  if (!supabase) return <p role="alert">El servicio no está configurado. Contacta al administrador.</p>

  return (
    <div className="form-stack">
      {error && <p role="alert" className="field-note">{error}</p>}
      {signOutError && <p role="alert" className="field-note">{signOutError}</p>}
      {message && <p role="status" className="field-note">{message}</p>}
      {user ? <>
        <p className="account-email">{user.email}</p>
        <div className="dialog-actions">
          <button className="button button-primary" onClick={onPublish}><Plus size={18} /> Nuevo anuncio</button>
          <button className="icon-button" title="Actualizar anuncios" aria-label="Actualizar anuncios" disabled={busy || loadingListings} onClick={reloadListings}><RefreshCw size={18} /></button>
        </div>
        <h3>Mis anuncios</h3>
        {loadingListings ? <p role="status">Cargando anuncios...</p> : listings.length ? (
          <ul className="owner-listings">
            {listings.map((listing) => <li key={listing.id}>
              <div><strong>{listing.title}</strong><p>{statusLabels[listing.status]}</p></div>
              <div className="owner-listing-actions">
                {['draft', 'rejected'].includes(listing.status) && <button className="icon-button" disabled={busy} title="Enviar a revisión" aria-label={`Enviar a revisión: ${listing.title}`} onClick={() => void act(() => submitListing(listing.id, user.id), 'Anuncio enviado a revisión.')}><Send size={18} /></button>}
                <button className="icon-button" disabled={busy} title="Eliminar anuncio" aria-label={`Eliminar anuncio: ${listing.title}`} onClick={() => {
                  if (window.confirm(`¿Eliminar permanentemente "${listing.title}"?`)) void act(() => deleteListing(listing.id, user.id), 'Anuncio eliminado.')
                }}><Trash2 size={18} /></button>
              </div>
            </li>)}
          </ul>
        ) : <p>Aún no tienes anuncios.</p>}
        <button className="button button-secondary" disabled={busy || signingOut} onClick={() => void onSignOut()}><LogOut size={18} /> {signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}</button>
      </> : <form className="form-stack" onSubmit={signIn}>
        <label>Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="vos@ejemplo.com" /></label>
        <button className="button button-primary" disabled={busy || emailSent}><Mail size={18} /> {busy ? 'Enviando...' : emailSent ? 'Enlace enviado' : 'Recibir enlace de acceso'}<ArrowRight size={17} /></button>
      </form>}
    </div>
  )
}