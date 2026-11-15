import { Link } from 'react-router-dom'
import { ArrowRight, Mail, MapPinned, RefreshCcw, Sprout, UserRound } from 'lucide-react'

export default function ProfileOverview({ firstName, email, parcels = [], parcelsState = 'loading', onRetry }) {
  const initial = String(firstName || '').trim().charAt(0).toLocaleUpperCase('es') || 'A'
  return <>
    <section className="profile-banner panel mt-7" aria-labelledby="profile-summary-title">
      <div className="profile-avatar" role="img" aria-label={`Avatar de ${firstName || 'usuario'}, inicial ${initial}`}>{initial}</div>
      <div className="min-w-0"><p className="eyebrow">AGROCODEUTC</p><h2 id="profile-summary-title" className="mt-3 font-display text-2xl font-bold">Tu espacio de trabajo</h2><p className="mt-1 text-muted">Gestiona tus datos y consulta tus parcelas registradas.</p></div>
    </section>
    <section className="profile-facts mt-5" aria-label="Resumen del perfil">
      <article className="profile-fact"><UserRound size={20} aria-hidden="true" /><span>Nombre</span><strong>{firstName || 'No registrado'}</strong></article>
      <article className="profile-fact"><Mail size={20} aria-hidden="true" /><span>Correo electrónico</span><strong>{email || 'No registrado'}</strong></article>
      <article className="profile-fact"><MapPinned size={20} aria-hidden="true" /><span>Mis parcelas</span>{parcelsState === 'loading' ? <strong role="status">Cargando…</strong> : parcelsState === 'error' ? <div role="alert"><strong>No se pudieron cargar.</strong><button type="button" className="profile-retry" onClick={onRetry}><RefreshCcw size={15} aria-hidden="true" /> Reintentar</button></div> : <strong>{parcels.length}</strong>}</article>
    </section>
    {parcelsState === 'ready' && !parcels.length && <div className="profile-empty panel mt-5"><span className="profile-empty-icon"><Sprout size={28} aria-hidden="true" /></span><h2 className="mt-3 text-lg font-bold">Todavía no tienes parcelas</h2><p className="mt-1 text-sm text-muted">Cuando registres una, aparecerá aquí en tu resumen.</p><Link to="/parcelas" className="button button-dark mt-4">Crear parcela <ArrowRight size={16} aria-hidden="true" /></Link></div>}
  </>
}
