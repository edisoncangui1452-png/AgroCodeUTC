import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, CloudRain, CloudSun, Database, Droplets, MapPinned, Plus, Snowflake, Sprout, Thermometer } from 'lucide-react'
import { api, errorMessage } from '../api'
import { useAuth } from '../App'
import ParcelMap from '../components/ParcelMap'
import { LunarCalendar } from '../components/LunarCalendar'
import { translated, usePreferences } from '../preferences'
import { Empty, Heading, ParcelSelect, useParcels } from './shared'

function displayValue(value, unit, language) {
  return value === null || value === undefined ? translated(language, 'Sin datos', 'No data') : `${Number(value).toLocaleString(language === 'en' ? 'en-US' : 'es-EC', { maximumFractionDigits: 1 })}${unit}`
}

function Metric({ icon: Icon, label, value, note }) {
  return <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
    <div className="flex items-center gap-2 text-xs font-semibold text-muted"><Icon size={16} className="shrink-0 text-leaf" /> {label}</div>
    <div className={`mt-3 font-display font-extrabold tracking-tight ${value === 'Sin datos' ? 'text-base text-muted' : 'text-2xl'}`}>{value}</div>
    <div className="mt-1 text-[11px] text-muted">{note}</div>
  </div>
}

function LunarCalendarAccess() {
  const [open, setOpen] = useState(false)
  const { language } = usePreferences()
  return <>
    <button type="button" className="button button-outline" onClick={() => setOpen(true)} aria-haspopup="dialog">
      <CalendarDays size={18} aria-hidden="true" /> {translated(language, 'Calendario lunar', 'Lunar calendar')}
    </button>
    <LunarCalendar open={open} language={language} onClose={() => setOpen(false)} />
  </>
}

export function Dashboard() {
  const { user } = useAuth()
  const { language } = usePreferences()
  const t = (es, en) => translated(language, es, en)
  const { parcels, loading } = useParcels()
  const storageKey = `agrocodeutc:parcel:${user.id}`
  const [selected, setSelected] = useState(() => localStorage.getItem(storageKey) || '')
  const [analyses, setAnalyses] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState('')
  const [retry, setRetry] = useState(0)
  const parcel = parcels.find(p => String(p.id) === String(selected)) || parcels[0]

  useEffect(() => {
    if (parcel && String(parcel.id) !== selected) setSelected(String(parcel.id))
  }, [parcel?.id, selected])
  useEffect(() => {
    if (selected) localStorage.setItem(storageKey, selected)
  }, [selected, storageKey])
  useEffect(() => {
    if (!parcel) return
    let current = true
    api.get('analyses/', { params: { parcel: parcel.id } })
      .then(({ data }) => { if (current) setAnalyses((data.results || data).slice(0, 4)) })
      .catch(() => { if (current) setAnalyses([]) })
    return () => { current = false }
  }, [parcel?.id])
  useEffect(() => {
    if (!parcel) return
    let current = true
    setMetrics(null); setMetricsError(''); setMetricsLoading(true)
    api.get(`parcels/${parcel.id}/dashboard-metrics/`)
      .then(({ data }) => { if (current) setMetrics(data) })
      .catch(err => { if (current) setMetricsError(errorMessage(err)) })
      .finally(() => { if (current) setMetricsLoading(false) })
    return () => { current = false }
  }, [parcel?.id, retry])

  const periodLabel = metrics?.period
    ? new Intl.DateTimeFormat(language === 'en' ? 'en' : 'es', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${metrics.period}-01T12:00:00Z`))
    : null

  return <div>
    <div className="mb-5 flex justify-end"><LunarCalendarAccess /></div>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <Heading eyebrow={t('TU ESPACIO DE TRABAJO', 'YOUR WORKSPACE')} title={t('Una visión más clara de tu campo.', 'A clearer view of your farm.')} description={t('Datos históricos de la parcela que elijas, en un mismo lugar.', 'Historical data for your selected parcel, all in one place.')} />
      <Link to="/parcelas" className="button button-dark"><Plus size={17} /> {t('Nueva parcela', 'New parcel')}</Link>
    </div>
    {loading ? <p className="mt-10">{t('Cargando parcelas…', 'Loading parcels…')}</p> : !parcel
      ? <div className="mt-9"><Empty icon={MapPinned} title={t('Tu historia empieza con un lugar', 'Your story starts with a place')} text={t('Dibuja tu primera parcela para explorar su clima histórico con datos de NASA.', 'Draw your first parcel to explore its historical climate using NASA data.')} to="/parcelas" action={t('Crear mi parcela', 'Create my parcel')} /></div>
      : <>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">{t('Indicadores de la parcela', 'Parcel indicators')}</h2>
          <span className="text-xs text-muted">{periodLabel ? `${periodLabel} · NASA POWER` : t('NASA POWER · último mes completo disponible', 'NASA POWER · latest complete month available')}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric icon={Thermometer} label={t('Temperatura', 'Temperature')} value={metricsLoading ? t('Cargando…', 'Loading…') : displayValue(metrics?.temperature_c, ' °C', language)} note={t('Media del mes', 'Monthly average')} />
          <Metric icon={CloudRain} label={t('Precipitación', 'Precipitation')} value={metricsLoading ? t('Cargando…', 'Loading…') : displayValue(metrics?.precipitation_mm, ' mm', language)} note={t('Lluvia acumulada del mes', 'Total rainfall for the month')} />
          <Metric icon={Droplets} label={t('Humedad del suelo', 'Soil moisture')} value={metricsLoading ? t('Cargando…', 'Loading…') : displayValue(metrics?.soil_wetness_index_percent, ' %', language)} note={t('Índice superficial NASA; no medición local', 'NASA surface index; not a local measurement')} />
          <Metric icon={Snowflake} label={t('Heladas históricas', 'Historical frost')} value={metricsLoading ? t('Cargando…', 'Loading…') : displayValue(metrics?.observed_frost_percent, ' %', language)} note={t('Días observados con mínima bajo 0 °C', 'Observed days with a minimum below 0 °C')} />
        </div>
        {metricsError && <p role="alert" className="notice mt-3">{metricsError} <button className="ml-2 font-bold text-leaf underline" onClick={() => setRetry(retry + 1)}>{t('Reintentar', 'Retry')}</button></p>}
        {metrics && <p className="mt-3 text-xs leading-relaxed text-muted">{t('Estimaciones regionales para', 'Regional estimates for')} {periodLabel}; {t('no sensores dentro de la parcela. La humedad es un índice relativo de superficie; el porcentaje de heladas describe días pasados, no predice el futuro.', 'not sensors inside the parcel. Moisture is a relative surface index; the frost percentage describes past days and does not predict the future.')} {metrics.cached ? t('Datos en caché.', 'Cached data.') : ''}</p>}
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <section className="panel overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div><h2 className="font-display text-xl font-bold">{parcel.name}</h2><p className="mt-1 text-sm text-muted">{parcel.location || parcel.country}</p></div>
              <div className="w-full sm:w-64"><ParcelSelect parcels={parcels} value={String(parcel.id)} onChange={setSelected} /></div>
            </div>
            <div className="h-[340px]"><ParcelMap geometry={parcel.geometry} point={[parcel.latitude, parcel.longitude]} /></div>
          </section>
          <section className="panel">
            <h2 className="text-xl font-bold">{t('Explora tus opciones', 'Explore your options')}</h2>
            <p className="mt-2 text-sm text-muted">{t('Conoce qué indican los datos y qué información falta para decidir mejor.', 'See what the data indicate and what information is missing to make better decisions.')}</p>
            <div className="mt-8 space-y-3">
              <Link to={`/clima?parcela=${parcel.id}`} className="action-row"><CloudSun size={20} /> {t('Comparar clima', 'Compare climate')} <ArrowRight size={16} className="ml-auto" /></Link>
              <Link to={`/agricultura?parcela=${parcel.id}`} className="action-row"><Sprout size={20} /> {t('Cultivos y rotaciones', 'Crops and rotations')} <ArrowRight size={16} className="ml-auto" /></Link>
              <Link to={`/historial?parcela=${parcel.id}`} className="action-row"><Database size={20} /> {t('Mi historial', 'My history')} <ArrowRight size={16} className="ml-auto" /></Link>
            </div>
          </section>
        </div>
        <div className="mt-6">
          <h2 className="mb-4 text-xl font-bold">{t('Análisis recientes', 'Recent analyses')} · {parcel.name}</h2>
          {analyses.length ? <div className="grid gap-3 md:grid-cols-2">{analyses.map(a => <div className="panel" key={a.id}><span className="text-xs uppercase text-muted">{a.kind}</span><h3 className="mt-2 font-bold">{a.title}</h3><span className="text-xs text-muted">{new Date(a.created_at).toLocaleDateString(language === 'en' ? 'en' : 'es')}</span></div>)}</div> : <p className="text-sm text-muted">{t('Todavía no hay análisis guardados para esta parcela.', 'There are no analyses saved for this parcel yet.')}</p>}
        </div>
      </>}
  </div>
}
