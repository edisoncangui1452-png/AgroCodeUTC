import { useEffect, useRef, useState } from 'react'
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
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState('')
  const [weatherBusy, setWeatherBusy] = useState(false)
  const requestVersion = useRef(0)

  useEffect(() => {
    requestVersion.current += 1
    setWeather(null)
    setWeatherError('')
    setWeatherBusy(false)
  }, [id])

  useEffect(() => {
    api.get('crops/').then(({ data }) => setCatalog(data.results || data))
      .catch(err => setCatalogError(errorMessage(err)))
  }, [])

  const crops = shortCycleCrops.map(name => catalog.find(item => item.name === name)).filter(Boolean)
  const areaNumber = Number(area)
  const areaTooLarge = parcel && area !== '' && areaNumber > Number(parcel.area_ha)

  function selectParcel(value) {
    requestVersion.current += 1
    setParams(value ? { parcela: value } : {})
    setReview(null)
    setArea('')
    setWeather(null)
    setWeatherError('')
    setWeatherBusy(false)
  }

  function selectDays(value) {
    requestVersion.current += 1
    setDays(value)
    setReview(null)
    setWeather(null)
    setWeatherError('')
    setWeatherBusy(false)
  }

  async function loadWeather(refresh = false) {
    const version = ++requestVersion.current
    setWeatherBusy(true)
    setWeatherError('')
    try {
      const { data } = await api.get(`parcels/${id}/simulator-weather/`, { params: { days, refresh: refresh ? 1 : 0 } })
      if (version === requestVersion.current) setWeather(data)
    } catch (error) {
      if (version === requestVersion.current) setWeatherError(errorMessage(error))
    } finally {
      if (version === requestVersion.current) setWeatherBusy(false)
    }
  }

  function submit(event) {
    event.preventDefault()
    if (!parcel || !crops.some(item => item.name === crop) || !observationDays.includes(days) ||
        !Number.isInteger(Number(quantity)) || Number(quantity) <= 0 ||
        !Number.isFinite(areaNumber) || areaNumber <= 0 || areaTooLarge) return
    setReview({ parcel: parcel.name, crop, quantity, area, days })
  }

  return <div>
    <Heading eyebrow="04 / LABORATORIO AGRÍCOLA" title="Simulador agrícola" description="Configure una observación y consulte el contexto meteorológico de su parcela. No se calculan crecimiento, fertilización ni cosechas." />
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
                <input type="radio" name="modalidad" value={value} checked={days === value} onChange={() => selectDays(value)} /> {value} días
              </label>)}</div>
            </fieldset>
            <button className="button button-dark" type="submit" disabled={!parcel || !crop || areaTooLarge}>Revisar configuración</button>
          </form>
          {review && <div role="status" className="notice mt-5"><strong>Configuración preparada (sin simulación)</strong><p className="mt-2">Parcela: {review.parcel} · Cultivo: {review.crop} · Cantidad sembrada: {review.quantity} · Superficie: {review.area} ha · Modalidad: {review.days} días.</p><p className="mt-2">No se ha calculado crecimiento, fertilización ni rendimiento. Esta configuración no se guarda todavía.</p></div>}
        </section>
        <section className="panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 className="text-xl font-bold">Contexto meteorológico</h2><p className="mt-2 text-sm text-muted">Consulta desde el servidor las coordenadas registradas de su parcela. Para 45 días se muestran semanas y escenarios, nunca fechas de cosecha.</p></div>
            <button type="button" className="button button-dark" disabled={!parcel || weatherBusy} onClick={() => loadWeather(Boolean(weather))}>{weatherBusy ? 'Consultando…' : weather ? 'Actualizar datos' : 'Consultar datos meteorológicos'}</button>
          </div>
          {weatherBusy && <p role="status" className="mt-4 text-sm text-muted">Consultando el servicio meteorológico…</p>}
          {weatherError && <p role="alert" className="notice mt-4">{weatherError}{weather && ' Los datos anteriores siguen visibles; compruebe la fecha de actualización.'}</p>}
          {weather && <div className="mt-5">
            <div className="notice">
              <strong>{weather.information_type === 'historical' ? 'Referencia histórica — NO pronóstico' : weather.information_type === 'subseasonal_forecast' ? 'Tendencias subestacionales — EC46' : 'Pronóstico meteorológico diario'} · {weather.days} días</strong>
              <p className="mt-2">Fuente: {weather.source} · Modelo: {weather.model}</p>
              <p>Última actualización: {new Date(weather.fetched_at).toLocaleString('es-EC', { timeZone: 'UTC' })} UTC · {weather.cached ? weather.stale ? `Caché anterior (${Math.floor(weather.age_seconds / 3600)} h)` : 'Desde caché' : 'Consulta nueva'}</p>
              <p>Emisión del modelo: {weather.issued_at ? new Date(weather.issued_at).toLocaleString('es-EC', { timeZone: 'UTC' }) + ' UTC' : 'no publicada en esta respuesta'}</p>
              <p className="mt-2">{weather.notice}</p>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">{weather.rows.map((row, index) => <article key={row.period_start || `month-${row.reference_month}-${index}`} className="rounded-xl border border-line bg-paper p-4">
              <h3 className="font-bold">{weather.information_type === 'historical' ? `Mes histórico: ${new Intl.DateTimeFormat('es-EC', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, row.reference_month - 1, 1)))}` : row.period_start === row.period_end ? row.period_start : `${row.period_start} al ${row.period_end}`}</h3>
              <p className="mt-1 text-xs text-muted">{weather.resolution === 'weekly' ? 'Resumen semanal del conjunto EC46; no predicción diaria exacta.' : weather.information_type === 'historical' ? 'Medianas mensuales 1983–2025; no corresponden al futuro.' : 'Pronóstico diario del modelo.'}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Temp. mínima', 'temperature_min_c'], ['Temp. media', 'temperature_mean_c'],
                  ['Temp. máxima', 'temperature_max_c'], ['Precipitación', 'precipitation_mm'],
                  ['Humedad del aire', 'relative_humidity_air_percent'], ['Radiación solar', 'solar_radiation_mj_m2'],
                  ['Humedad del suelo (modelo)', 'soil_moisture_model_percent'],
                ].map(([label, key]) => <div key={key}><dt className="text-xs text-muted">{label}</dt><dd className="font-semibold">{row.values[key] === null ? 'Sin dato' : `${row.values[key]} ${weather.units[key]}`}</dd></div>)}
              </dl>
              {row.basis && Object.values(row.basis).includes('control_run') && <p className="mt-3 text-xs text-muted">Donde faltaron miembros del conjunto se muestra la corrida base EC46; no se interpreta como media del conjunto.</p>}
              {row.uncertainty && <div className="mt-3 border-t border-line pt-3 text-xs text-muted">
                <strong>{weather.information_type === 'historical' ? 'Dispersión histórica (no pronóstico)' : 'Escenarios entre miembros (no intervalo de confianza)'}</strong>
                {Object.entries(row.uncertainty).map(([key, interval]) => <p key={key} className="mt-1">{key === 'precipitation_mm' ? 'Precipitación' : 'Temperatura media'}: {interval.min ?? interval.p10}–{interval.max ?? interval.p90} {weather.units[key]}{interval.members ? ` · ${interval.members} miembros` : ''}</p>)}
              </div>}
              {row.missing.length > 0 && <p className="mt-3 text-xs text-muted">Variables sin dato: {row.missing.map(key => ({
                temperature_min_c: 'temperatura mínima', temperature_mean_c: 'temperatura media', temperature_max_c: 'temperatura máxima',
                precipitation_mm: 'precipitación', relative_humidity_air_percent: 'humedad del aire',
                solar_radiation_mj_m2: 'radiación solar', soil_moisture_model_percent: 'humedad del suelo',
              })[key]).join(', ')}.</p>}
            </article>)}</div>
            <p className="mt-4 text-xs text-muted">La humedad relativa del aire es distinta de la humedad volumétrica del suelo estimada por el modelo. Fuente meteorológica: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">Open-Meteo</a> y ECMWF; la referencia histórica, cuando aparece, es NASA POWER.</p>
          </div>}
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
        <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-muted">El contexto meteorológico se consulta únicamente al pulsar el botón. NASA POWER histórico no es un pronóstico y EC46 no predice el clima exacto de la parcela.</p>
      </aside>
    </div>}
  </div>
}
