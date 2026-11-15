import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { api } from '../api'
import { getCountryOptions } from '../countries'
import { translated, usePreferences } from '../preferences'

export const countryOptions = getCountryOptions('es').map(({ code, name }) => [code, name])
export const countryNames = Object.fromEntries(countryOptions)
export const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const soilTextures = [
  'Arenoso', 'Arenoso franco', 'Franco arenoso', 'Franco', 'Franco limoso', 'Limoso',
  'Franco arcillo-arenoso', 'Franco arcilloso', 'Franco arcillo-limoso', 'Arcillo-arenoso', 'Arcillo-limoso',
]
export const cropVisuals = {
  Papa: '🥔', Quinua: '🌾', Cebada: '🌾', Haba: '🫘', Arveja: '🫛',
  Maíz: '🌽', Trigo: '🌾', Avena: '🌾', Chocho: '🫘', Zanahoria: '🥕',
  Cebolla: '🧅', Repollo: '🥬', Remolacha: '🫜', Lechuga: '🥬', Rábano: '🫜',
}

export function useParcels() {
  const [parcels, setParcels] = useState([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    try { const { data } = await api.get('parcels/'); setParcels(data.results || data) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { reload().catch(() => setLoading(false)) }, [reload])
  return { parcels, loading, reload }
}

export function Heading({ eyebrow, title, description }) {
  return <div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1>{description && <p className="mt-3 max-w-2xl text-muted">{description}</p>}</div>
}
export function Empty({ icon: Icon, title, text, to, action }) {
  return <div className="panel flex flex-col items-center py-14 text-center"><span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-mint"><Icon size={28} /></span><h3 className="font-display text-xl font-bold">{title}</h3><p className="mt-2 max-w-md text-sm text-muted">{text}</p>{to && <Link to={to} className="button button-dark mt-6">{action} <ArrowRight size={16} /></Link>}</div>
}
export function ParcelSelect({ parcels, value, onChange }) {
  const { language } = usePreferences()
  const localizedCountryNames = Object.fromEntries(getCountryOptions(language).map(({ code, name }) => [code, name]))
  return <select className="select" value={value} onChange={e => onChange(e.target.value)} aria-label={translated(language, 'Seleccionar parcela', 'Select a parcel')}>
    <option value="">{translated(language, 'Selecciona una parcela', 'Select a parcel')}</option>{parcels.map(p => <option key={p.id} value={p.id}>{p.name} · {p.location || localizedCountryNames[p.country] || p.country}</option>)}
  </select>
}

export function CropWindowCards({ candidates = [], duration, primaryOnly = false }) {
  const { language } = usePreferences()
  const t = (es, en) => translated(language, es, en)
  const months = language === 'en'
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : monthNames
  const matching = candidates.filter(c => c.durations?.[String(duration)]?.length && (!primaryOnly || c.primary_duration === duration))
  return <section className="rounded-2xl border border-line bg-white p-5">
    <div className="flex items-center justify-between gap-3"><h3 className="font-display text-lg font-bold">{t('Ciclos de', 'Cycles of')} ~{duration} {t('meses', 'months')}</h3><span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-leaf">{matching.length} {t('candidatos', 'candidates')}</span></div>
    {matching.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{matching.map(c => <article key={c.id || c.crop} className="rounded-xl border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-2"><strong className="flex items-center gap-2 text-base"><span role="img" aria-label={t(`Ilustración de ${c.crop}`, `Illustration of ${c.crop}`)} className="text-2xl">{cropVisuals[c.crop] || '🌱'}</span>{c.crop}</strong><span className="text-xs text-muted">{c.cycle_days}–{c.max_cycle_days} {t('días', 'days')}</span></div>
      <p className="mt-1 text-xs text-muted">{c.family} · {t(c.regional_validated ? 'Ficha regional' : 'Referencia FAO general', c.regional_validated ? 'Regional profile' : 'General FAO reference')}</p>
      {primaryOnly && <p className="mt-1 text-xs text-muted">{t('Categoría principal', 'Primary category')}: ~{duration} {t('meses', 'months')}. {t('Rango documentado', 'Documented range')}: {c.cycle_days}–{c.max_cycle_days || c.cycle_days} {t('días', 'days')}.</p>}
      {primaryOnly && Object.keys(c.durations).length > 1 && <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">{t('Ver otras duraciones compatibles', 'View other compatible durations')}</summary><p className="mt-1">{Object.keys(c.durations).filter(n => Number(n) !== duration).map(n => `~${n} ${t('meses', 'months')} (${t('inicios', 'starts')}: ${c.durations[n].map(w => months[w.start_month - 1]).join(', ')})`).join(' · ')}</p><p>{t('La ficha no distingue variedades ni tipos de cosecha; la duración puede variar según manejo y localidad.', 'The profile does not distinguish varieties or harvest types; duration may vary by management and location.')}</p></details>}
      <p className="mt-3 text-sm"><strong>{t('Inicio orientativo', 'Indicative start')}:</strong> {c.durations[String(duration)].map(w => months[w.start_month - 1]).join(', ')}</p>
      <p className="mt-2 text-xs text-muted">{t('Se evaluó cada mes del ciclo; al menos 2 temporadas históricas compatibles por inicio.', 'Every month in the cycle was assessed; at least 2 compatible historical seasons per start month.')}</p>
      <p className="mt-2 text-xs text-muted">{t('Para iniciar en', 'For a start in')} {months[c.durations[String(duration)][0].start_month - 1]}, {t('lluvia histórica del ciclo', 'historical rainfall over the cycle')}: {Math.min(...c.durations[String(duration)][0].observed_rain_mm).toFixed(0)}–{Math.max(...c.durations[String(duration)][0].observed_rain_mm).toFixed(0)} mm.</p>
      <p className="mt-2 text-xs text-muted">{c.rain_context}</p>
      {c.rain_status === 'compatibilidad_parcial' && <p className="mt-2 text-xs font-semibold text-leaf">{t('Compatibilidad parcial: la lluvia anual no coincidió en todos los años con el rango de la ficha FAO. No se ha verificado el agua disponible durante el cultivo.', 'Partial compatibility: annual rainfall did not match the FAO profile range in every year. Water availability during the crop cycle has not been verified.')}</p>}
      {c.rain_status === 'sin_datos' && <p className="mt-2 text-xs text-muted">{t('Sin comparación anual suficiente: no se ha verificado el agua disponible durante el cultivo.', 'Not enough annual data for comparison: water availability during the crop cycle has not been verified.')}</p>}
      {c.source && <a className="mt-3 inline-block text-xs font-bold text-leaf underline" href={c.source} target="_blank" rel="noreferrer">{t('Ver ficha FAO', 'View FAO profile')} ↗</a>}
    </article>)}</div> : <p className="mt-4 text-sm text-muted">{t('No hay ciclos de esta duración con respaldo climático suficiente para esta parcela y periodo.', 'No cycles of this duration have sufficient climate support for this parcel and period.')}</p>}
  </section>
}
