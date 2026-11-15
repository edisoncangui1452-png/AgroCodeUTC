import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CloudRain, CloudSun, Database, Droplets, MapPinned, Plus, Snowflake, Sprout, Thermometer } from 'lucide-react'
import { api, errorMessage } from '../api'
import { useAuth } from '../App'
import ParcelMap from '../components/ParcelMap'
import { Empty, Heading, ParcelSelect, useParcels } from './shared'
import { useLanguage } from '../i18n'

function displayValue(value, unit, locale, t) {
  return value === null || value === undefined ? t('Sin datos') : `${Number(value).toLocaleString(locale, { maximumFractionDigits: 1 })}${unit}`
}

function Metric({ icon: Icon, label, value, note }) {
  const { t } = useLanguage()
  return <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
    <div className="flex items-center gap-2 text-xs font-semibold text-muted"><Icon size={16} className="shrink-0 text-leaf" /> {label}</div>
    <div className={`mt-3 font-display font-extrabold tracking-tight ${value === t('Sin datos') ? 'text-base text-muted' : 'text-2xl'}`}>{value}</div>
    <div className="mt-1 text-[11px] text-muted">{note}</div>
  </div>
}

export function Dashboard() {
  const { t, locale } = useLanguage()
  const { user } = useAuth()
  const { parcels, loading } = useParcels()
  const storageKey = `agrocode:parcel:${user.id}`
  const [selected, setSelected] = useState(() => localStorage.getItem(storageKey) || localStorage.getItem(`agrofisica:parcel:${user.id}`) || '')
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
    ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${metrics.period}-01T12:00:00Z`))
    : null

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <Heading eyebrow={t('TU ESPACIO DE TRABAJO')} title={t('Una visión más clara de tu campo.')} description={t('Datos históricos de la parcela que elijas, en un mismo lugar.')} />
      <Link to="/parcelas" className="button button-dark"><Plus size={17} /> {t('Nueva parcela')}</Link>
    </div>
    {loading ? <p className="mt-10">{t('Cargando parcelas…')}</p> : !parcel
      ? <div className="mt-9"><Empty icon={MapPinned} title={t('Tu historia empieza con un lugar')} text={t('Dibuja tu primera parcela para explorar su clima histórico con datos de NASA.')} to="/parcelas" action={t('Crear mi parcela')} /></div>
      : <>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">{t('Indicadores de la parcela')}</h2>
          <span className="text-xs text-muted">{periodLabel ? `${periodLabel} · NASA POWER` : t('NASA POWER · último mes completo disponible')}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric icon={Thermometer} label={t('Temperatura')} value={metricsLoading ? t('Cargando…') : displayValue(metrics?.temperature_c, ' °C', locale, t)} note={t('Media del mes')} />
          <Metric icon={CloudRain} label={t('Precipitación')} value={metricsLoading ? t('Cargando…') : displayValue(metrics?.precipitation_mm, ' mm', locale, t)} note={t('Lluvia acumulada del mes')} />
          <Metric icon={Droplets} label={t('Humedad del suelo')} value={metricsLoading ? t('Cargando…') : displayValue(metrics?.soil_wetness_index_percent, ' %', locale, t)} note={t('Índice superficial NASA; no medición local')} />
          <Metric icon={Snowflake} label={t('Heladas históricas')} value={metricsLoading ? t('Cargando…') : displayValue(metrics?.observed_frost_percent, ' %', locale, t)} note={t('Días observados con mínima bajo 0 °C')} />
        </div>
        {metricsError && <p role="alert" className="notice mt-3">{t(metricsError)} <button className="ml-2 font-bold text-leaf underline" onClick={() => setRetry(retry + 1)}>{t('Reintentar')}</button></p>}
        {metrics && <p className="mt-3 text-xs leading-relaxed text-muted">{t('Estimaciones regionales para {period}; no sensores dentro de la parcela. La humedad es un índice relativo de superficie; el porcentaje de heladas describe días pasados, no predice el futuro.', { period: periodLabel })} {metrics.cached ? t('Datos en caché.') : ''}</p>}
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <section className="panel overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div><h2 className="font-display text-xl font-bold">{parcel.name}</h2><p className="mt-1 text-sm text-muted">{parcel.location || parcel.country}</p></div>
              <div className="w-full sm:w-64"><ParcelSelect parcels={parcels} value={String(parcel.id)} onChange={setSelected} /></div>
            </div>
            <div className="h-[340px]"><ParcelMap geometry={parcel.geometry} point={[parcel.latitude, parcel.longitude]} /></div>
          </section>
          <section className="panel">
            <h2 className="text-xl font-bold">{t('Explora tus opciones')}</h2>
            <p className="mt-2 text-sm text-muted">{t('Conoce qué indican los datos y qué información falta para decidir mejor.')}</p>
            <div className="mt-8 space-y-3">
              <Link to={`/clima?parcela=${parcel.id}`} className="action-row"><CloudSun size={20} /> {t('Comparar clima')} <ArrowRight size={16} className="ml-auto" /></Link>
              <Link to={`/agricultura?parcela=${parcel.id}`} className="action-row"><Sprout size={20} /> {t('Cultivos y rotaciones')} <ArrowRight size={16} className="ml-auto" /></Link>
              <Link to={`/historial?parcela=${parcel.id}`} className="action-row"><Database size={20} /> {t('Mi historial')} <ArrowRight size={16} className="ml-auto" /></Link>
            </div>
          </section>
        </div>
        <div className="mt-6">
          <h2 className="mb-4 text-xl font-bold">{t('Análisis recientes · {name}', { name: parcel.name })}</h2>
          {analyses.length ? <div className="grid gap-3 md:grid-cols-2">{analyses.map(a => <div className="panel" key={a.id}><span className="text-xs uppercase text-muted">{t(a.kind)}</span><h3 className="mt-2 font-bold">{t(a.title)}</h3><span className="text-xs text-muted">{new Date(a.created_at).toLocaleDateString(locale)}</span></div>)}</div> : <p className="text-sm text-muted">{t('Todavía no hay análisis guardados para esta parcela.')}</p>}
        </div>
      </>}
  </div>
}
