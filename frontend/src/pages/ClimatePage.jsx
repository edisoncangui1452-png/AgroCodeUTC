import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapPinned, RefreshCcw, Save } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, errorMessage } from '../api'
import { CropWindowCards, Empty, Heading, monthNames, ParcelSelect, useParcels } from './shared'
import HistoricalReference from '../components/HistoricalReference'

const chartVariables = [
  ['T2M', 'Temperatura media', '°C'], ['T2M_MAX', 'Temperatura máxima', '°C'],
  ['T2M_MIN', 'Temperatura mínima', '°C'], ['PRECTOTCORR', 'Precipitación acumulada', 'mm/mes'],
  ['RH2M', 'Humedad', '%'], ['ALLSKY_SFC_SW_DWN', 'Radiación solar', 'MJ/m²/día'],
  ['WS2M', 'Velocidad del viento', 'm/s'],
]

export function ClimatePage() {
  const { parcels } = useParcels()
  const [params, setParams] = useSearchParams()
  const id = params.get('parcela') || ''
  const [result, setResult] = useState(null)
  const [variable, setVariable] = useState('T2M')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [endYear, setEndYear] = useState(new Date().getFullYear() - 1)
  function choose(idValue) {
    setParams(idValue ? { parcela: idValue } : {})
    setResult(null); setMessage('')
  }
  async function load(save = false) {
    if (!id) return
    setBusy(true); setMessage('')
    try {
      const { data } = await api[save ? 'post' : 'get'](`parcels/${id}/climate/`,
        save ? { start_year: endYear - 2, end_year: endYear } : { params: { start_year: endYear - 2, end_year: endYear } })
      setResult(data)
      if (save) setMessage('Análisis guardado en el historial de esta parcela.')
    } catch (err) { setMessage(errorMessage(err)) } finally { setBusy(false) }
  }
  const years = result ? [...new Set(result.monthly.map(row => row.year))] : []
  const chartData = monthNames.map((month, index) => ({
    month, ...Object.fromEntries(years.map(year => [year, result.monthly.find(row => row.year === year && row.month === index + 1)?.[variable]])),
  }))
  const selected = chartVariables.find(item => item[0] === variable)
  const candidates = result?.crop_windows || []

  return <div>
    <Heading eyebrow="02 / DATOS NASA" title="Historial climático" description="Compara mes a mes hasta tres años calendario completos. Son datos regionales, no sensores en tu parcela." />
    {!parcels.length ? <div className="mt-8"><Empty icon={MapPinned} title="Primero crea una parcela" text="Necesitamos una ubicación para consultar NASA POWER." to="/parcelas" action="Ir a mis parcelas" /></div> : <>
      <div className="panel mt-8 flex flex-wrap items-end gap-3">
        <label className="field flex-1">Parcela<ParcelSelect parcels={parcels} value={id} onChange={choose} /></label>
        <label className="field">Último año<input type="number" className="!w-28" min="1983" max={new Date().getFullYear() - 1} value={endYear} onChange={e => { setEndYear(Number(e.target.value)); setResult(null) }} /></label>
        <button className="button button-dark" disabled={!id || busy} onClick={() => load()}><RefreshCcw size={16} /> {busy ? 'Consultando NASA…' : 'Consultar datos'}</button>
      </div>
      {message && <p role="status" className="notice mt-4">{message}</p>}
      {id && <HistoricalReference key={id} parcelId={id} />}
      {result && <>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="stat"><span className="text-sm text-muted">Periodo comparado</span><strong>{years.join(' · ')}</strong></div>
          <div className="stat"><span className="text-sm text-muted">Fuente</span><strong className="!text-lg">NASA POWER</strong><span className="text-xs text-muted">{result.cached ? 'Desde caché' : 'Consulta reciente'}</span></div>
          <div className="stat"><span className="text-sm text-muted">Cobertura</span><strong>Datos diarios</strong><span className="text-xs text-muted">Lluvia: mes completo; otras variables: ≥80 % de días válidos</span></div>
        </div>
        <div className="panel mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Comparación mensual</h2><p className="mt-1 text-sm text-muted">{selected[1]} · {selected[2]}</p></div><select className="select !w-auto" value={variable} onChange={e => setVariable(e.target.value)}>{chartVariables.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <div className="mt-8 h-[320px] w-full"><ResponsiveContainer width="100%" height="100%">
            {variable === 'PRECTOTCORR'
              ? <BarChart data={chartData}><CartesianGrid stroke="#e3eee5" vertical={false} /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />{years.map((year, i) => <Bar key={year} dataKey={String(year)} fill={['#1b4332', '#52a576', '#a5d8b3'][i]} />)}</BarChart>
              : <LineChart data={chartData}><CartesianGrid stroke="#e3eee5" vertical={false} /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />{years.map((year, i) => <Line key={year} type="monotone" dataKey={String(year)} stroke={['#1b4332', '#52a576', '#a5d8b3'][i]} strokeWidth={3} connectNulls={false} />)}</LineChart>}
          </ResponsiveContainer></div>
        </div>
        <div className="mt-7"><div className="eyebrow">CICLOS DE CULTIVO</div><h2 className="mt-4 font-display text-2xl font-bold">Cultivos para explorar según la duración</h2>
          <p className="mb-5 mt-2 max-w-3xl text-sm leading-relaxed text-muted">Se contrasta la temperatura de <strong>todos los meses del crecimiento</strong> con tres temporadas históricas. Las fichas FAO Ecocrop son generales; no validan automáticamente un cultivo para tu localidad. La lluvia anual se informa como contexto, no como demanda de agua del ciclo.</p>
          <div className="space-y-4">{[2, 3, 6].map(duration => <CropWindowCards key={duration} candidates={candidates} duration={duration} />)}</div>
          {!candidates.length && <p className="notice mt-4">No hay candidatos con respaldo climático suficiente para esta ubicación y periodo. El catálogo exploratorio está limitado a un corredor aproximado de la Sierra ecuatoriana.</p>}
        </div>
        <button className="button button-dark mt-6" onClick={() => load(true)} disabled={busy}><Save size={17} /> Guardar este análisis</button>
        <p className="mt-4 text-xs text-muted">Fuente: {result.source}. Consultado: {new Date(result.fetched_at).toLocaleString('es')}. {result.notice}</p>
      </>}
    </>}
  </div>
}
