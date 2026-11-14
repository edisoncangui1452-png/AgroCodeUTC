import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, MapPinned, Sprout } from 'lucide-react'
import { api, errorMessage } from '../api'
import ParcelMap from '../components/ParcelMap'
import { CropWindowCards, Empty, Heading, ParcelSelect, useParcels } from './shared'

export function AgriculturePage() {
  const { parcels } = useParcels()
  const [params, setParams] = useSearchParams()
  const id = params.get('parcela') || ''
  const parcel = parcels.find(p => String(p.id) === id)
  const [candidates, setCandidates] = useState(null)
  const [rotation, setRotation] = useState(null)
  const [strategies, setStrategies] = useState(['', '', ''])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  function choose(value) { setParams(value ? { parcela: value } : {}); setCandidates(null); setRotation(null); setMessage('') }
  async function recommend() {
    setBusy(true); setMessage('')
    try {
      const { data } = await api.post(`parcels/${id}/recommend/`)
      setCandidates(data); setMessage('Análisis exploratorio guardado en el historial de esta parcela.')
    } catch (err) { setMessage(errorMessage(err)) } finally { setBusy(false) }
  }
  async function compare() {
    setBusy(true); setMessage('')
    try {
      const { data } = await api.post(`parcels/${id}/rotations/`, {
        strategies: strategies.map((s, index) => ({
          name: `Estrategia ${'ABC'[index]}`, crops: s.split(',').map(name => name.trim()).filter(Boolean),
        })),
      })
      setRotation(data); setMessage('Comparación guardada en el historial de esta parcela.')
    } catch (err) { setMessage(errorMessage(err)) } finally { setBusy(false) }
  }
  return <div>
    <Heading eyebrow="03 / DECISIONES INFORMADAS" title="Cultivos y rotaciones" description="Explora ciclos respaldados por fichas FAO generales y compara la diversidad de tus estrategias." />
    {!parcels.length ? <div className="mt-8"><Empty icon={Sprout} title="Primero ubica tu terreno" text="Para comparar cultivos necesitamos conocer la ubicación de tu parcela." to="/parcelas" action="Crear parcela" /></div> : <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
      <div className="min-w-0 space-y-5">
        <section className="panel">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Cultivos para evaluar</h2><p className="mt-2 max-w-xl text-sm text-muted">Comparamos todos los meses de crecimiento contra registros históricos, no solo el mes de inicio. La referencia FAO no constituye asesoría local.</p></div><button disabled={!id || busy} className="button button-dark" onClick={recommend}><Sprout size={17} /> Analizar cultivos</button></div>
          {candidates && <div className="mt-6 space-y-4">{[2, 3, 6].map(duration => <CropWindowCards key={duration} candidates={candidates.candidates} duration={duration} />)}<p className="notice">{candidates.notice}</p></div>}
        </section>
        <section className="panel"><h2 className="text-xl font-bold">Comparar rotaciones</h2><p className="mt-2 text-sm text-muted">Escribe cultivos separados por comas. Se comparan familias documentadas y datos faltantes; no se estima rendimiento ni agua.</p>
          <div className="mt-5 grid gap-4 xl:grid-cols-3">{strategies.map((value, index) => <label className="field" key={index}>Estrategia {'ABC'[index]}<textarea rows="3" placeholder="Ej. papa, haba, cebada" value={value} onChange={e => setStrategies(strategies.map((s, i) => i === index ? e.target.value : s))} /></label>)}</div>
          <button className="button button-dark mt-5" disabled={!id || busy} onClick={compare}>Comparar y guardar <ArrowRight size={17} /></button>
          {rotation && <div className="mt-6 grid gap-3 xl:grid-cols-3">{rotation.strategies.map(strategy => <div className="rounded-xl bg-paper p-5" key={strategy.name}><h3 className="font-bold">{strategy.name}</h3><p className="mt-2 text-sm">{strategy.crops.join(' → ') || 'Sin cultivos'}</p><p className="mt-4 text-sm">Familias documentadas distintas: <strong>{strategy.families}</strong></p><p className="text-sm">Repeticiones de familia: <strong>{strategy.repeated_families}</strong></p>{strategy.unknown.length > 0 && <p className="mt-2 text-xs text-muted">Sin ficha FAO en esta zona demo: {strategy.unknown.join(', ')}</p>}</div>)}</div>}
        </section>
        {message && <p role="status" className="notice">{message}</p>}
      </div>
      <aside className="panel lg:sticky lg:top-28">
        <h2 className="text-lg font-bold">Parcela de referencia</h2>
        <p className="mb-4 mt-1 text-xs text-muted">Permanece visible al desplazarte por la página.</p>
        <label className="field">Elegir parcela<ParcelSelect parcels={parcels} value={id} onChange={choose} /></label>
        {parcel ? <><div className="mt-4 h-44 overflow-hidden rounded-xl border border-line"><ParcelMap geometry={parcel.geometry} point={[parcel.latitude, parcel.longitude]} /></div><h3 className="mt-4 font-bold">{parcel.name}</h3><p className="text-sm text-muted">{parcel.location || parcel.country} · {parcel.area_ha.toFixed(2)} ha</p><p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-muted">El catálogo exploratorio corresponde únicamente a un corredor geográfico aproximado de la Sierra ecuatoriana. Confirma condiciones locales con un profesional.</p></> : <p className="mt-5 flex gap-2 text-sm text-muted"><MapPinned size={18} className="shrink-0" /> Selecciona una parcela para continuar.</p>}
      </aside>
    </div>}
  </div>
}
