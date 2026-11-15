import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CloudRain, CloudSun, Database, Droplets, MapPinned, Plus, Snowflake, Sprout, Thermometer } from 'lucide-react'
import { api, errorMessage } from '../api'
import { useAuth } from '../App'
import ParcelMap from '../components/ParcelMap'
import { Empty, Heading, ParcelSelect, useParcels } from './shared'

function displayValue(value, unit) {
  return value === null || value === undefined ? 'Sin datos' : `${Number(value).toLocaleString('es-EC', { maximumFractionDigits: 1 })}${unit}`
}

function Metric({ icon: Icon, label, value, note }) {
  return <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
    <div className="flex items-center gap-2 text-xs font-semibold text-muted"><Icon size={16} className="shrink-0 text-leaf" /> {label}</div>
    <div className={`mt-3 font-display font-extrabold tracking-tight ${value === 'Sin datos' ? 'text-base text-muted' : 'text-2xl'}`}>{value}</div>
    <div className="mt-1 text-[11px] text-muted">{note}</div>
  </div>
}

export function Dashboard() {
  const { user } = useAuth()
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
    ? new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${metrics.period}-01T12:00:00Z`))
    : null

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <Heading eyebrow="TU ESPACIO DE TRABAJO" title="Una visión más clara de tu campo." description="Datos históricos de la parcela que elijas, en un mismo lugar." />
      <Link to="/parcelas" className="button button-dark"><Plus size={17} /> Nueva parcela</Link>
    </div>
    {loading ? <p className="mt-10">Cargando parcelas…</p> : !parcel
      ? <div className="mt-9"><Empty icon={MapPinned} title="Tu historia empieza con un lugar" text="Dibuja tu primera parcela para explorar su clima histórico con datos de NASA." to="/parcelas" action="Crear mi parcela" /></div>
      : <>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Indicadores de la parcela</h2>
          <span className="text-xs text-muted">{periodLabel ? `${periodLabel} · NASA POWER` : 'NASA POWER · último mes completo disponible'}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric icon={Thermometer} label="Temperatura" value={metricsLoading ? 'Cargando…' : displayValue(metrics?.temperature_c, ' °C')} note="Media del mes" />
          <Metric icon={CloudRain} label="Precipitación" value={metricsLoading ? 'Cargando…' : displayValue(metrics?.precipitation_mm, ' mm')} note="Lluvia acumulada del mes" />
          <Metric icon={Droplets} label="Humedad del suelo" value={metricsLoading ? 'Cargando…' : displayValue(metrics?.soil_wetness_index_percent, ' %')} note="Índice superficial NASA; no medición local" />
          <Metric icon={Snowflake} label="Heladas históricas" value={metricsLoading ? 'Cargando…' : displayValue(metrics?.observed_frost_percent, ' %')} note="Días observados con mínima bajo 0 °C" />
        </div>
        {metricsError && <p role="alert" className="notice mt-3">{metricsError} <button className="ml-2 font-bold text-leaf underline" onClick={() => setRetry(retry + 1)}>Reintentar</button></p>}
        {metrics && <p className="mt-3 text-xs leading-relaxed text-muted">Estimaciones regionales para {periodLabel}; no sensores dentro de la parcela. La humedad es un índice relativo de superficie; el porcentaje de heladas describe días pasados, no predice el futuro. {metrics.cached ? 'Datos en caché.' : ''}</p>}
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <section className="panel overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div><h2 className="font-display text-xl font-bold">{parcel.name}</h2><p className="mt-1 text-sm text-muted">{parcel.location || parcel.country}</p></div>
              <div className="w-full sm:w-64"><ParcelSelect parcels={parcels} value={String(parcel.id)} onChange={setSelected} /></div>
            </div>
            <div className="h-[340px]"><ParcelMap geometry={parcel.geometry} point={[parcel.latitude, parcel.longitude]} /></div>
          </section>
          <section className="panel">
            <h2 className="text-xl font-bold">Explora tus opciones</h2>
            <p className="mt-2 text-sm text-muted">Conoce qué indican los datos y qué información falta para decidir mejor.</p>
            <div className="mt-8 space-y-3">
              <Link to={`/clima?parcela=${parcel.id}`} className="action-row"><CloudSun size={20} /> Comparar clima <ArrowRight size={16} className="ml-auto" /></Link>
              <Link to={`/agricultura?parcela=${parcel.id}`} className="action-row"><Sprout size={20} /> Cultivos y rotaciones <ArrowRight size={16} className="ml-auto" /></Link>
              <Link to={`/historial?parcela=${parcel.id}`} className="action-row"><Database size={20} /> Mi historial <ArrowRight size={16} className="ml-auto" /></Link>
            </div>
          </section>
        </div>
        <div className="mt-6">
          <h2 className="mb-4 text-xl font-bold">Análisis recientes · {parcel.name}</h2>
          {analyses.length ? <div className="grid gap-3 md:grid-cols-2">{analyses.map(a => <div className="panel" key={a.id}><span className="text-xs uppercase text-muted">{a.kind}</span><h3 className="mt-2 font-bold">{a.title}</h3><span className="text-xs text-muted">{new Date(a.created_at).toLocaleDateString('es')}</span></div>)}</div> : <p className="text-sm text-muted">Todavía no hay análisis guardados para esta parcela.</p>}
        </div>
      </>}
  </div>
}
