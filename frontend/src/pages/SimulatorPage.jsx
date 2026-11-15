import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FlaskConical, MapPinned, Sprout } from 'lucide-react'
import { api, errorMessage } from '../api'
import { cropVisuals, Empty, Heading, ParcelSelect, useParcels } from './shared'
import { fertilizerSlots, observationDays, shortCycleCrops } from './simulatorOptions'

export function SimulatorPage() {
  const { parcels, loading } = useParcels()
  const [params, setParams] = useSearchParams()
  const id = params.get('parcela') || ''
  const parcel = parcels.find(item => String(item.id) === id)
  const [catalog, setCatalog] = useState([])
  const [catalogError, setCatalogError] = useState('')
  const [crop, setCrop] = useState('')
  const [quantity, setQuantity] = useState('')
  const [area, setArea] = useState('')
  const [days, setDays] = useState(4)
  const [review, setReview] = useState(null)

  useEffect(() => {
    api.get('crops/').then(({ data }) => setCatalog(data.results || data))
      .catch(err => setCatalogError(errorMessage(err)))
  }, [])

  const crops = shortCycleCrops.map(name => catalog.find(item => item.name === name)).filter(Boolean)
  const areaNumber = Number(area)
  const areaTooLarge = parcel && area !== '' && areaNumber > Number(parcel.area_ha)

  function selectParcel(value) {
    setParams(value ? { parcela: value } : {})
    setReview(null)
    setArea('')
  }

  function submit(event) {
    event.preventDefault()
    if (!parcel || !crops.some(item => item.name === crop) || !observationDays.includes(days) ||
        !Number.isInteger(Number(quantity)) || Number(quantity) <= 0 ||
        !Number.isFinite(areaNumber) || areaNumber <= 0 || areaTooLarge) return
    setReview({ parcel: parcel.name, crop, quantity, area, days })
  }

  return <div>
    <Heading eyebrow="04 / LABORATORIO AGRÍCOLA" title="Simulador agrícola" description="Configure una observación para su parcela. En esta primera fase solo se prepara la interfaz: no se calculan resultados ni se predicen cosechas." />
    {!loading && !parcels.length ? <div className="mt-8"><Empty icon={MapPinned} title="Primero registre una parcela" text="Necesita una parcela para preparar su configuración de simulación." to="/parcelas" action="Crear parcela" /></div> : <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
      <div className="min-w-0 space-y-5">
        <section className="panel">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Sprout size={22} /> Configuración del cultivo</h2>
          <p className="mt-2 text-sm text-muted">Los cultivos provienen de fichas FAO generales. Los periodos de 4, 7 y 45 días son modalidades de observación, no tiempos de cosecha.</p>
          <form className="mt-6 space-y-5" onSubmit={submit}>
            <fieldset>
              <legend className="text-sm font-bold">Cultivo de ciclo corto</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {crops.map(item => <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${crop === item.name ? 'border-leaf bg-mint' : 'border-line bg-paper'}`}>
                  <input type="radio" name="cultivo" value={item.name} checked={crop === item.name} onChange={() => { setCrop(item.name); setReview(null) }} required />
                  <span aria-hidden="true" className="text-2xl">{cropVisuals[item.name]}</span>
                  <span><strong className="block text-sm">{item.name}</strong><span className="text-xs text-muted">Ficha general: {item.cycle_days}–{item.max_cycle_days || item.cycle_days} días</span></span>
                </label>)}
              </div>
              {catalogError && <p role="alert" className="mt-3 text-sm text-red-700">No se pudo cargar el catálogo: {catalogError}</p>}
              {!catalogError && !crops.length && <p className="mt-3 text-sm text-muted">Cargando cultivos disponibles…</p>}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field">Cantidad sembrada (semillas o plántulas)
                <input type="number" min="1" step="1" required value={quantity} onChange={event => { setQuantity(event.target.value); setReview(null) }} placeholder="Ej. 100" />
              </label>
              <label className="field">Superficie a utilizar (ha)
                <input type="number" min="0.0001" step="any" required value={area} onChange={event => { setArea(event.target.value); setReview(null) }} placeholder="Ej. 0.25" aria-describedby="sim-area-help" />
                <span id="sim-area-help" className="text-xs font-normal text-muted">No puede superar el área registrada de la parcela.</span>
                {areaTooLarge && <small role="alert">La superficie supera el área de la parcela ({parcel.area_ha} ha).</small>}
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-bold">Modalidad de observación</legend>
              <div className="mt-3 flex flex-wrap gap-3">{observationDays.map(value => <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${days === value ? 'border-leaf bg-mint' : 'border-line bg-paper'}`}>
                <input type="radio" name="modalidad" value={value} checked={days === value} onChange={() => { setDays(value); setReview(null) }} /> {value} días
              </label>)}</div>
            </fieldset>
            <button className="button button-dark" type="submit" disabled={!parcel || !crop || areaTooLarge}>Revisar configuración</button>
          </form>
          {review && <div role="status" className="notice mt-5"><strong>Configuración preparada (sin simulación)</strong><p className="mt-2">Parcela: {review.parcel} · Cultivo: {review.crop} · Cantidad sembrada: {review.quantity} · Superficie: {review.area} ha · Modalidad: {review.days} días.</p><p className="mt-2">No se ha calculado crecimiento, fertilización ni rendimiento. Esta configuración no se guarda todavía.</p></div>}
        </section>
        <section className="panel">
          <h2 className="flex items-center gap-2 text-xl font-bold"><FlaskConical size={22} /> Fertilizantes</h2>
          <p className="mt-2 text-sm text-muted">Espacio reservado para diez fertilizantes. Los productos, dosis, comparaciones y resultados se definirán en una fase posterior.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{fertilizerSlots.map(number => <div key={number} className="rounded-xl border border-line bg-paper p-4" aria-label={`Espacio para fertilizante ${number}, no disponible`}>
            <span className="text-xs font-bold text-leaf">FERTILIZANTE {String(number).padStart(2, '0')}</span>
            <p className="mt-3 text-sm font-semibold">Sin configurar</p><p className="mt-1 text-xs text-muted">Próximamente</p>
          </div>)}</div>
        </section>
      </div>
      <aside className="panel lg:sticky lg:top-28">
        <h2 className="text-lg font-bold">Parcela de referencia</h2>
        <label className="field mt-4">Elegir parcela<ParcelSelect parcels={parcels} value={id} onChange={selectParcel} /></label>
        {parcel ? <div className="mt-4 rounded-xl bg-paper p-4"><strong>{parcel.name}</strong><p className="mt-1 text-sm text-muted">{parcel.location || parcel.country} · {parcel.area_ha} ha registradas</p></div> : <p className="mt-4 text-sm text-muted">Seleccione una parcela para revisar la configuración.</p>}
        <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-muted">Este apartado no consulta el clima ni modifica sus análisis existentes. La información histórica de NASA POWER no es un pronóstico.</p>
      </aside>
    </div>}
  </div>
}
