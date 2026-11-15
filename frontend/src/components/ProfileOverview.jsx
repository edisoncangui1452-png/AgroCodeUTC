import { Link } from 'react-router-dom'
import { ArrowRight, Mail, MapPinned, RefreshCcw, Sprout, UserRound } from 'lucide-react'
import { translated } from '../preferences'

export default function ProfileOverview({ firstName, email, parcels = [], parcelsState = 'loading', onRetry, language = 'es' }) {
  const t = (es, en) => translated(language, es, en)
  const initial = String(firstName || '').trim().charAt(0).toLocaleUpperCase('es') || 'A'
  return <>
    <section className="profile-banner panel mt-7" aria-labelledby="profile-summary-title">
      <div className="profile-avatar" role="img" aria-label={t(`Avatar de ${firstName || 'usuario'}, inicial ${initial}`, `Avatar of ${firstName || 'user'}, initial ${initial}`)}>{initial}</div>
      <div className="min-w-0"><p className="eyebrow">AGROCODEUTC</p><h2 id="profile-summary-title" className="mt-3 font-display text-2xl font-bold">{t('Tu espacio de trabajo', 'Your workspace')}</h2><p className="mt-1 text-muted">{t('Gestiona tus datos y consulta tus parcelas registradas.', 'Manage your details and view your registered parcels.')}</p></div>
    </section>
    <section className="profile-facts mt-5" aria-label={t('Resumen del perfil', 'Profile summary')}>
      <article className="profile-fact"><UserRound size={20} aria-hidden="true" /><span>{t('Nombre', 'Name')}</span><strong>{firstName || t('No registrado', 'Not provided')}</strong></article>
      <article className="profile-fact"><Mail size={20} aria-hidden="true" /><span>{t('Correo electrónico', 'Email address')}</span><strong>{email || t('No registrado', 'Not provided')}</strong></article>
      <article className="profile-fact"><MapPinned size={20} aria-hidden="true" /><span>{t('Mis parcelas', 'My parcels')}</span>{parcelsState === 'loading' ? <strong role="status">{t('Cargando…', 'Loading…')}</strong> : parcelsState === 'error' ? <div role="alert"><strong>{t('No se pudieron cargar.', 'Could not load.')}</strong><button type="button" className="profile-retry" onClick={onRetry}><RefreshCcw size={15} aria-hidden="true" /> {t('Reintentar', 'Retry')}</button></div> : <strong>{parcels.length}</strong>}</article>
    </section>
    {parcelsState === 'ready' && !parcels.length && <div className="profile-empty panel mt-5"><span className="profile-empty-icon"><Sprout size={28} aria-hidden="true" /></span><h2 className="mt-3 text-lg font-bold">{t('Todavía no tienes parcelas', 'You do not have any parcels yet')}</h2><p className="mt-1 text-sm text-muted">{t('Cuando registres una, aparecerá aquí en tu resumen.', 'Once you register one, it will appear here in your summary.')}</p><Link to="/parcelas" className="button button-dark mt-4">{t('Crear parcela', 'Create parcel')} <ArrowRight size={16} aria-hidden="true" /></Link></div>}
  </>
}
