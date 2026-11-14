import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import countries from 'i18n-iso-countries'
import es from 'i18n-iso-countries/langs/es.json'
import { api } from '../api'

countries.registerLocale(es)
export const countryNames = countries.getNames('es', { select: 'official' })
export const countryOptions = Object.entries(countryNames).sort((a, b) => a[1].localeCompare(b[1], 'es'))
export const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const soilTextures = [
  'Arenoso', 'Arenoso franco', 'Franco arenoso', 'Franco', 'Franco limoso', 'Limoso',
  'Franco arcillo-arenoso', 'Franco arcilloso', 'Franco arcillo-limoso', 'Arcillo-arenoso', 'Arcillo-limoso',
]

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
  return <select className="select" value={value} onChange={e => onChange(e.target.value)} aria-label="Seleccionar parcela">
    <option value="">Selecciona una parcela</option>{parcels.map(p => <option key={p.id} value={p.id}>{p.name} · {p.location || countryNames[p.country] || p.country}</option>)}
  </select>
}

export function CropWindowCards({ candidates = [], duration }) {
  const matching = candidates.filter(c => c.durations?.[String(duration)]?.length)
  return <section className="rounded-2xl border border-line bg-white p-5">
    <div className="flex items-center justify-between gap-3"><h3 className="font-display text-lg font-bold">Ciclos de ~{duration} meses</h3><span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-leaf">{matching.length} candidatos</span></div>
    {matching.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{matching.map(c => <article key={c.crop} className="rounded-xl border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-2"><strong className="text-base">{c.crop}</strong><span className="text-xs text-muted">{c.cycle_days}–{c.max_cycle_days} días</span></div>
      <p className="mt-1 text-xs text-muted">{c.family} · {c.regional_validated ? 'Ficha regional' : 'Referencia FAO general'}</p>
      <p className="mt-3 text-sm"><strong>Inicio orientativo:</strong> {c.durations[String(duration)].map(w => monthNames[w.start_month - 1]).join(', ')}</p>
      <p className="mt-2 text-xs text-muted">Se evaluó cada mes del ciclo; al menos 2 temporadas históricas compatibles por inicio.</p>
      <p className="mt-2 text-xs text-muted">Para iniciar en {monthNames[c.durations[String(duration)][0].start_month - 1]}, lluvia histórica del ciclo: {Math.min(...c.durations[String(duration)][0].observed_rain_mm).toFixed(0)}–{Math.max(...c.durations[String(duration)][0].observed_rain_mm).toFixed(0)} mm.</p>
      <p className="mt-2 text-xs text-muted">{c.rain_context}</p>
      {c.rain_optimal_years === 0 && <p className="mt-2 text-xs font-semibold text-leaf">Atención: ningún año completo coincidió con la lluvia anual óptima de la ficha FAO.</p>}
      {c.source && <a className="mt-3 inline-block text-xs font-bold text-leaf underline" href={c.source} target="_blank" rel="noreferrer">Ver ficha FAO ↗</a>}
    </article>)}</div> : <p className="mt-4 text-sm text-muted">No hay ciclos de esta duración con respaldo climático suficiente para esta parcela y periodo.</p>}
  </section>
}
