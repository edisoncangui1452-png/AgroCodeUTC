import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CloudSun, Database, MapPin, MapPinned, Plus, Sprout } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../App'
import ParcelMap from '../components/ParcelMap'
import { Empty, Heading, ParcelSelect, useParcels } from './shared'

export function Dashboard() {
  const { user } = useAuth()
  const { parcels, loading } = useParcels()
  const storageKey = `agrofisica:parcel:${user.id}`
  const [selected, setSelected] = useState(() => localStorage.getItem(storageKey) || '')
  const [analyses, setAnalyses] = useState([])
  const parcel = parcels.find(p => String(p.id) === String(selected)) || parcels[0]

  useEffect(() => {
    if (parcel && String(parcel.id) !== selected) setSelected(String(parcel.id))
  }, [parcel?.id, selected])
  useEffect(() => {
    if (selected) localStorage.setItem(storageKey, selected)
  }, [selected, storageKey])
  useEffect(() => {
    if (!parcel) return
    api.get('analyses/', { params: { parcel: parcel.id } })
      .then(({ data }) => setAnalyses((data.results || data).slice(0, 4)))
      .catch(() => setAnalyses([]))
  }, [parcel?.id])

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <Heading eyebrow="TU ESPACIO DE TRABAJO" title="Una visión más clara de tu campo." description="Todos los datos de tu terreno, su clima y tus decisiones en un mismo lugar." />
      <Link to="/parcelas" className="button button-dark"><Plus size={17} /> Nueva parcela</Link>
    </div>
    {loading ? <p className="mt-10">Cargando parcelas…</p> : !parcel ? <div className="mt-9"><Empty icon={MapPinned} title="Tu historia empieza con un lugar" text="Dibuja tu primera parcela para explorar su clima histórico con datos de NASA." to="/parcelas" action="Crear mi parcela" /></div> : <>
      <div className="panel mt-8 max-w-lg"><label className="field">Parcela activa<ParcelSelect parcels={parcels} value={String(parcel.id)} onChange={setSelected} /></label><p className="mt-2 text-xs text-muted">El mapa, los datos y los análisis recientes siguen esta selección.</p></div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="stat"><MapPin size={20} /><span className="mt-6 text-sm text-muted">Parcela activa</span><strong>{parcel.name}</strong><span className="text-xs text-muted">{parcel.location || parcel.country}</span></div>
        <div className="stat"><MapPinned size={20} /><span className="mt-6 text-sm text-muted">Superficie geodésica</span><strong>{parcel.area_ha.toFixed(2)} ha</strong><span className="text-xs text-muted">Calculada a partir del polígono</span></div>
        <div className="stat"><CloudSun size={20} /><span className="mt-6 text-sm text-muted">Historial climático</span><strong>3 años</strong><Link className="text-xs font-bold text-leaf underline" to={`/clima?parcela=${parcel.id}`}>Explorar datos NASA <ArrowRight className="inline" size={12} /></Link></div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="panel overflow-hidden p-0"><div className="flex items-center justify-between p-6"><h2 className="text-xl font-bold">Tu terreno</h2><Link className="text-sm font-bold text-leaf underline" to="/parcelas">Ver parcela</Link></div><div className="h-[340px]"><ParcelMap geometry={parcel.geometry} point={[parcel.latitude, parcel.longitude]} /></div></div>
        <div className="panel"><h2 className="text-xl font-bold">Explora tus opciones</h2><p className="mt-2 text-sm text-muted">Conoce qué indican los datos y qué información falta para decidir mejor.</p><div className="mt-8 space-y-3">
          <Link to={`/clima?parcela=${parcel.id}`} className="action-row"><CloudSun size={20} /> Comparar clima <ArrowRight size={16} className="ml-auto" /></Link>
          <Link to={`/agricultura?parcela=${parcel.id}`} className="action-row"><Sprout size={20} /> Cultivos y rotaciones <ArrowRight size={16} className="ml-auto" /></Link>
          <Link to={`/historial?parcela=${parcel.id}`} className="action-row"><Database size={20} /> Mi historial <ArrowRight size={16} className="ml-auto" /></Link>
        </div></div>
      </div>
      <div className="mt-6"><h2 className="mb-4 text-xl font-bold">Análisis recientes · {parcel.name}</h2>{analyses.length ? <div className="grid gap-3 md:grid-cols-2">{analyses.map(a => <div className="panel" key={a.id}><span className="text-xs uppercase text-muted">{a.kind}</span><h3 className="mt-2 font-bold">{a.title}</h3><span className="text-xs text-muted">{new Date(a.created_at).toLocaleDateString('es')}</span></div>)}</div> : <p className="text-sm text-muted">Todavía no hay análisis guardados para esta parcela.</p>}</div>
    </>}
  </div>
}
