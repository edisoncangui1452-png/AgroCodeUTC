import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FlaskConical, MapPinned, Sprout } from 'lucide-react'
import { api, errorMessage } from '../api'
import { Empty, Heading, ParcelSelect, useParcels } from './shared'
import { SimulationVisualPanel } from './PlantSimulation2D'
import {
  labelCondition, labelInformation, labelMissing, labelRisk, labelRiskStatus, labelStage,
  labelStageSource, labelWarning,
} from './simulatorLabels'
import { fertilizerSlots, observationDays, shortCycleCrops } from './simulatorOptions'
import { translated, usePreferences } from '../preferences'

export function SimulatorPage() {
  const { language } = usePreferences()
  const t = (es, en) => translated(language, es, en)
  const { parcels, loading } = useParcels()
  const [params, setParams] = useSearchParams()
  const id = params.get('parcela') || ''
  const parcel = parcels.find(item => String(item.id) === id)
  const [crop, setCrop] = useState('')
  const [quantity, setQuantity] = useState('')
  const [area, setArea] = useState('')
  const [plantedOn, setPlantedOn] = useState('')
  const [quantityType, setQuantityType] = useState('seeds')
  const [observedStage, setObservedStage] = useState('')
  const [observedSoil, setObservedSoil] = useState('')
  const [observedPlants, setObservedPlants] = useState('')
  const [observedOn, setObservedOn] = useState('')
  const [days, setDays] = useState(4)
  const [simulation, setSimulation] = useState(null)
  const [result, setResult] = useState(null)
  const [simulationError, setSimulationError] = useState('')
  const [simulationBusy, setSimulationBusy] = useState(false)
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState('')
  const [weatherBusy, setWeatherBusy] = useState(false)
  const requestVersion = useRef(0)

  useEffect(() => {
    let active = true
    requestVersion.current += 1
    setWeather(null)
    setWeatherError('')
    setWeatherBusy(false)
    setSimulation(null)
    setResult(null)
    setSimulationError('')
    if (id) api.get('simulations/', { params: { parcel: id } }).then(({ data }) => {
      if (!active) return
      const last = (data.results || data)[0]
      if (last) {
        setSimulation(last)
        setCrop(last.crop)
        setQuantity(String(last.quantity))
        setArea(String(last.area_m2))
        setDays(last.days)
        setPlantedOn(last.planted_on)
        setQuantityType(last.quantity_type)
        setObservedStage(last.observed_stage || '')
        setObservedSoil(last.observed_soil_condition || '')
        setObservedPlants(last.observed_plants == null ? '' : String(last.observed_plants))
        setObservedOn(last.observed_on || '')
      }
    }).catch(err => { if (active) setSimulationError(errorMessage(err)) })
    return () => { active = false }
  }, [id])

  const areaNumber = Number(area)
  const areaTooLarge = parcel && area !== '' && areaNumber > Number(parcel.area_ha) * 10000

  function selectParcel(value) {
    requestVersion.current += 1
    setParams(value ? { parcela: value } : {})
    setResult(null)
    setSimulation(null)
    setArea('')
    setWeather(null)
    setWeatherError('')
    setWeatherBusy(false)
  }

  function selectDays(value) {
    requestVersion.current += 1
    setDays(value)
    setResult(null)
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

  async function runEvaluation(saved, refresh = false) {
    const { data } = await api.get(`simulations/${saved.id}/evaluate/`, { params: { refresh: refresh ? 1 : 0 } })
    setResult(data)
  }

  async function submit(event) {
    event.preventDefault()
    if (!parcel || !shortCycleCrops.some(item => item.id === crop) || !observationDays.includes(days) ||
        !Number.isInteger(Number(quantity)) || Number(quantity) <= 0 ||
        !Number.isFinite(areaNumber) || areaNumber <= 0 || areaTooLarge || !plantedOn) return
    setSimulationBusy(true)
    setSimulationError('')
    try {
      const settings = { parcel: Number(id), crop, planted_on: plantedOn, quantity: Number(quantity),
        quantity_type: quantityType, area_m2: areaNumber, days }
      const same = simulation && Object.entries(settings).every(([key, value]) => simulation[key] === value)
      const saved = same ? simulation : (await api.post('simulations/', settings)).data
      setSimulation(saved)
      if (observedOn || observedStage || observedSoil || observedPlants !== '') {
        const updated = (await api.patch(`simulations/${saved.id}/`, {
          observed_on: observedOn || null, observed_stage: observedStage,
          observed_soil_condition: observedSoil, observed_plants: observedPlants === '' ? null : Number(observedPlants),
        })).data
        setSimulation(updated)
        await runEvaluation(updated)
      } else await runEvaluation(saved)
      loadWeather()
    } catch (error) { setSimulationError(errorMessage(error)) } finally { setSimulationBusy(false) }
  }

  return <div>
    <Heading eyebrow={t('04 / LABORATORIO AGRÍCOLA', '04 / AGRICULTURAL LAB')} title={t('Simulador agrícola', 'Crop simulator')} description={t('Evaluación agronómica parcial respaldada por fuentes y pronósticos. No estima altura, supervivencia ni rendimiento.', 'Partial agronomic assessment supported by sources and forecasts. It does not estimate height, survival, or yield.')} />
    {!loading && !parcels.length ? <div className="mt-8"><Empty icon={MapPinned} title={t('Primero registre una parcela', 'Register a parcel first')} text={t('Necesita una parcela para preparar su configuración de simulación.', 'You need a parcel to set up a simulation.')} to="/parcelas" action={t('Crear parcela', 'Create parcel')} /></div> : <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
      <div className="min-w-0 space-y-5">
        <section className="panel">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Sprout size={22} /> {t('Configuración del cultivo', 'Crop setup')}</h2>
          <p className="mt-2 text-sm text-muted">{t('Cinco cultivos con fichas independientes; los periodos de 4, 7 y 45 días son horizontes meteorológicos, no garantía de cosecha.', 'Five crops with independent profiles; the 4, 7, and 45 day periods are weather horizons, not a harvest guarantee.')}</p>
          <form className="mt-6 space-y-5" onSubmit={submit}>
            <fieldset>
              <legend className="text-sm font-bold">{t('Cultivo de ciclo corto', 'Short-cycle crop')}</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {shortCycleCrops.map(item => <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${crop === item.id ? 'border-leaf bg-mint' : 'border-line bg-paper'}`}>
                  <input type="radio" name="cultivo" value={item.id} checked={crop === item.id} onChange={() => { setCrop(item.id); setResult(null) }} required />
                  <span aria-hidden="true" className="text-2xl">🌱</span>
                  <span><strong className="block text-sm">{item.name}</strong><span className="text-xs text-muted">{t('Evaluación parcial por especie', 'Partial species-level assessment')}</span></span>
                </label>)}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field">{t('Fecha de siembra', 'Planting date')}
                <input type="date" required max={new Date().toISOString().slice(0, 10)} value={plantedOn} onChange={event => { setPlantedOn(event.target.value); setResult(null) }} />
              </label>
              <label className="field">{t('Tipo de cantidad', 'Quantity type')}
                <select value={quantityType} onChange={event => { setQuantityType(event.target.value); setResult(null) }}><option value="seeds">{t('Semillas sembradas', 'Seeds planted')}</option><option value="established_plants">{t('Plantas establecidas', 'Established plants')}</option></select>
              </label>
              <label className="field">{t('Cantidad inicial', 'Initial quantity')}
                <input type="number" min="1" step="1" required value={quantity} onChange={event => { setQuantity(event.target.value); setResult(null) }} placeholder="Ej. 100" />
              </label>
              <label className="field">{t('Superficie a utilizar (m²)', 'Area to use (m²)')}
                <input type="number" min="0.000001" step="any" required value={area} onChange={event => { setArea(event.target.value); setResult(null) }} placeholder="Ej. 25" aria-describedby="sim-area-help" />
                <span id="sim-area-help" className="text-xs font-normal text-muted">{t('No puede superar el área registrada de la parcela.', 'It cannot exceed the parcel’s registered area.')}</span>
                {areaTooLarge && <small role="alert">{t('La superficie supera el área de la parcela', 'The area exceeds the parcel area')} ({Number(parcel.area_ha) * 10000} m²).</small>}
              </label>
            </div>
            <fieldset className="rounded-xl border border-line p-4">
              <legend className="text-sm font-bold">{t('Observación de campo (opcional)', 'Field observation (optional)')}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field">{t('Etapa observada', 'Observed stage')}<select value={observedStage} onChange={event => setObservedStage(event.target.value)}><option value="">{t('No observada', 'Not observed')}</option>{[['siembra', 'Siembra'], ['germinacion', 'Germinación'], ['emergencia', 'Emergencia'], ['crecimiento_inicial', 'Crecimiento inicial'], ['desarrollo_vegetativo', 'Desarrollo vegetativo'], ['desarrollo_avanzado', 'Desarrollo avanzado'], ['posible_cosecha', 'Posible cosecha']].map(([value, label]) => <option key={value} value={value}>{labelStage(value, language)}</option>)}</select></label>
                <label className="field">{t('Suelo observado', 'Observed soil')}<select value={observedSoil} onChange={event => setObservedSoil(event.target.value)}><option value="">{t('No observado', 'Not observed')}</option><option value="seco">{t('Seco', 'Dry')}</option><option value="humedo">{t('Húmedo', 'Moist')}</option><option value="encharcado">{t('Encharcado', 'Waterlogged')}</option></select></label>
                <label className="field">{t('Plantas contadas', 'Plants counted')}<input type="number" min="0" step="1" value={observedPlants} onChange={event => setObservedPlants(event.target.value)} /></label>
                <label className="field">{t('Fecha de observación', 'Observation date')}<input type="date" max={new Date().toISOString().slice(0, 10)} value={observedOn} onChange={event => setObservedOn(event.target.value)} /></label>
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-bold">{t('Modalidad de observación', 'Observation interval')}</legend>
              <div className="mt-3 flex flex-wrap gap-3">{observationDays.map(value => <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${days === value ? 'border-leaf bg-mint' : 'border-line bg-paper'}`}>
                <input type="radio" name="modalidad" value={value} checked={days === value} onChange={() => selectDays(value)} /> {value} {t('días', 'days')}
              </label>)}</div>
            </fieldset>
            <button className="button button-dark" type="submit" disabled={!parcel || !crop || areaTooLarge || simulationBusy}>{simulationBusy ? t('Evaluando…', 'Evaluating…') : t('Guardar y evaluar cultivo', 'Save and evaluate crop')}</button>
          </form>
          {simulationError && <p role="alert" className="notice mt-4">{simulationError}</p>}
          {simulation && <p className="mt-3 text-xs text-muted">{t('Configuración guardada', 'Configuration saved')} #{simulation.id}; {t('fecha de siembra y observaciones se conservan al actualizar el pronóstico.', 'planting date and observations are retained when the forecast is updated.')}</p>}
          {result && <section role="status" className="notice mt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">{t('Evaluación parcial', 'Partial assessment')}: {result.crop.name}</h3><button className="button button-dark" type="button" disabled={simulationBusy} onClick={async () => { setSimulationBusy(true); setSimulationError(''); try { await runEvaluation(simulation, true); loadWeather() } catch (error) { setSimulationError(errorMessage(error)) } finally { setSimulationBusy(false) } }}>{t('Actualizar pronóstico y evaluación', 'Update forecast and assessment')}</button></div>
            <p>{t('Siembra', 'Planting')}: {result.planted_on} · {result.horizon_days} {t('días', 'days')} · {labelInformation(result.weather.information_type, language)} · {t('Última etapa registrada', 'Last recorded stage')}: {result.initial_state?.stage ? labelStage(result.initial_state.stage, language) : t('no disponible', 'not available')} ({t('no confirma los períodos futuros', 'does not confirm future periods')}).</p>
            <p>{t('Densidad', 'Density')}: {result.quantity.density_per_m2} {result.quantity.type === 'seeds' ? t('semillas', 'seeds') : t('plantas establecidas', 'established plants')}/m² · {t('Plantas observadas', 'Observed plants')}: {result.quantity.observed_plants ?? t('sin dato', 'no data')} · {t('Cosechables', 'Harvestable plants')}: {t('pendiente', 'pending')}.</p>
            {result.indicative_harvest_window && <p>{t('Referencia externa de cosecha (no confirmada localmente)', 'External harvest reference (not locally confirmed)')}: {result.indicative_harvest_window.from} {t('a', 'to')} {result.indicative_harvest_window.to}.</p>}
            <p>{result.qualitative_assessment}</p>
            <p>{t('Incertidumbre meteorológica', 'Weather uncertainty')}: {result.uncertainty.weather}. {t('Modelo agrícola', 'Crop model')}: {result.uncertainty.crop_model}</p>
            <SimulationVisualPanel result={result} />
            <div className="grid gap-2 md:grid-cols-2">{result.results.map(row => <article key={row.period_start} className="rounded-lg border border-line bg-paper p-3 text-sm"><strong>{row.period_start === row.period_end ? row.period_start : `${row.period_start} ${t('al', 'to')} ${row.period_end}`}</strong><p>{t('Etapa registrada', 'Recorded stage')}: {row.stage ? labelStage(row.stage, language) : t('no confirmada', 'unconfirmed')} · {labelStageSource(row.stage_source, language)} · {t('Edad desde siembra', 'Age since planting')}: {row.days_since_sowing.start}–{row.days_since_sowing.end} {t('días', 'days')}.</p><p>{t('Condición térmica', 'Thermal condition')}: {labelCondition(row.thermal.status, language)} · {t('Agua', 'Water')}: {labelCondition(row.water.status, language)}</p><p>{t('Humedad', 'Humidity')}: {labelCondition(row.humidity.status, language)} · {t('Radiación', 'Radiation')}: {labelCondition(row.radiation.status, language)}</p><p>{t('Advertencias', 'Warnings')}: {row.risks.map(risk => `${labelRisk(risk.code, language)} (${labelRiskStatus(risk.status, language)})`).join(', ') || t('sin alertas identificadas con los datos disponibles; no indica condiciones óptimas', 'no alerts identified from available data; this does not indicate optimal conditions')}.</p>{row.partial_sowing_period && <p>{t('Semana parcialmente anterior a la siembra; no se atribuye clima diario.', 'Week partly before planting; no daily weather is attributed to it.')}</p>}{row.meteorological_uncertainty && <p>{t('Dispersión de escenarios meteorológicos disponible; ver panel meteorológico.', 'Weather scenario spread is available; see the weather panel.')}</p>}{row.missing.length > 0 && <p>{t('Sin dato', 'No data')}: {row.missing.map(code => labelMissing(code, language)).join(', ')}</p>}</article>)}</div>
            {result.results.length === 0 && <p>{t('Solo referencia climática histórica: no se proyecta el cultivo con esos datos.', 'Historical climate reference only: the crop is not projected using these data.')}</p>}
            <ul className="list-disc pl-5 text-xs">{result.warnings.map(warning => <li key={warning}>{labelWarning(warning, language)}</li>)}</ul>
            <p className="text-xs">{t('Fuentes', 'Sources')}: {result.crop.sources.map(source => <a className="mr-3 underline" href={source} key={source} target="_blank" rel="noreferrer">{t('Ficha agronómica', 'Agronomic profile')}</a>)}</p>
          </section>}
        </section>
        <section className="panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold">{t('Contexto meteorológico', 'Weather context')}</h2><p className="mt-2 text-sm text-muted">{t('Consulta desde el servidor las coordenadas registradas de su parcela. Para 45 días se muestran semanas y escenarios, nunca fechas de cosecha.', 'The server queries the coordinates saved for your parcel. For 45 days, weekly summaries and scenarios are shown, never harvest dates.')}</p></div>
          <button type="button" className="button button-dark" disabled={!parcel || weatherBusy} onClick={() => loadWeather(Boolean(weather))}>{weatherBusy ? t('Consultando…', 'Querying…') : weather ? t('Actualizar datos', 'Refresh data') : t('Consultar datos meteorológicos', 'Get weather data')}</button>
          </div>
          {weatherBusy && <p role="status" className="mt-4 text-sm text-muted">{t('Consultando el servicio meteorológico…', 'Querying the weather service…')}</p>}
          {weatherError && <p role="alert" className="notice mt-4">{weatherError}{weather && t(' Los datos anteriores siguen visibles; compruebe la fecha de actualización.', ' Previous data remain visible; check the update date.')}</p>}
          {weather && <div className="mt-5">
            <div className="notice">
            <strong>{weather.information_type === 'historical' ? t('Referencia histórica — NO pronóstico', 'Historical reference — NOT a forecast') : weather.information_type === 'subseasonal_forecast' ? t('Tendencias subestacionales — EC46', 'Subseasonal trends — EC46') : t('Pronóstico meteorológico diario', 'Daily weather forecast')} · {weather.days} {t('días', 'days')}</strong>
            <p className="mt-2">{t('Fuente', 'Source')}: {weather.source} · {t('Modelo', 'Model')}: {weather.model}</p>
            <p>{t('Última actualización', 'Last updated')}: {new Date(weather.fetched_at).toLocaleString(language === 'en' ? 'en' : 'es-EC', { timeZone: 'UTC' })} UTC · {weather.cached ? weather.stale ? `${t('Caché anterior', 'Older cache')} (${Math.floor(weather.age_seconds / 3600)} h)` : t('Desde caché', 'From cache') : t('Consulta nueva', 'New query')}</p>
            <p>{t('Emisión del modelo', 'Model issue time')}: {weather.issued_at ? new Date(weather.issued_at).toLocaleString(language === 'en' ? 'en' : 'es-EC', { timeZone: 'UTC' }) + ' UTC' : t('no publicada en esta respuesta', 'not published in this response')}</p>
              <p className="mt-2">{weather.notice}</p>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">{weather.rows.map((row, index) => <article key={row.period_start || `month-${row.reference_month}-${index}`} className="rounded-xl border border-line bg-paper p-4">
              <h3 className="font-bold">{weather.information_type === 'historical' ? `${t('Mes histórico', 'Historical month')}: ${new Intl.DateTimeFormat(language === 'en' ? 'en' : 'es-EC', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, row.reference_month - 1, 1)))}` : row.period_start === row.period_end ? row.period_start : `${row.period_start} ${t('al', 'to')} ${row.period_end}`}</h3>
              <p className="mt-1 text-xs text-muted">{weather.resolution === 'weekly' ? t('Resumen semanal del conjunto EC46; no predicción diaria exacta.', 'Weekly summary from the EC46 ensemble; not an exact daily prediction.') : weather.information_type === 'historical' ? t('Medianas mensuales 1983–2025; no corresponden al futuro.', 'Monthly medians for 1983–2025; they do not represent the future.') : t('Pronóstico diario del modelo.', 'Daily model forecast.')}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {[
                  [t('Temp. mínima', 'Minimum temp.'), 'temperature_min_c'], [t('Temp. media', 'Mean temp.'), 'temperature_mean_c'],
                  [t('Temp. máxima', 'Maximum temp.'), 'temperature_max_c'], [t('Precipitación', 'Precipitation'), 'precipitation_mm'],
                  [t('Humedad del aire', 'Air humidity'), 'relative_humidity_air_percent'], [t('Radiación solar', 'Solar radiation'), 'solar_radiation_mj_m2'],
                  [t('Humedad del suelo (modelo)', 'Soil moisture (model)'), 'soil_moisture_model_percent'],
                ].map(([label, key]) => <div key={key}><dt className="text-xs text-muted">{label}</dt><dd className="font-semibold">{row.values[key] === null ? t('Sin dato', 'No data') : `${row.values[key]} ${weather.units[key]}`}</dd></div>)}
              </dl>
              {row.basis && Object.values(row.basis).includes('control_run') && <p className="mt-3 text-xs text-muted">{t('Donde faltaron miembros del conjunto se muestra la corrida base EC46; no se interpreta como media del conjunto.', 'Where ensemble members were missing, the EC46 control run is shown; it should not be interpreted as the ensemble mean.')}</p>}
              {row.uncertainty && <div className="mt-3 border-t border-line pt-3 text-xs text-muted">
                <strong>{weather.information_type === 'historical' ? t('Dispersión histórica (no pronóstico)', 'Historical spread (not a forecast)') : t('Escenarios entre miembros (no intervalo de confianza)', 'Member scenarios (not a confidence interval)')}</strong>
                {Object.entries(row.uncertainty).map(([key, interval]) => <p key={key} className="mt-1">{key === 'precipitation_mm' ? t('Precipitación', 'Precipitation') : t('Temperatura media', 'Mean temperature')}: {interval.min ?? interval.p10}–{interval.max ?? interval.p90} {weather.units[key]}{interval.members ? ` · ${interval.members} ${t('miembros', 'members')}` : ''}</p>)}
              </div>}
              {row.missing.length > 0 && <p className="mt-3 text-xs text-muted">{t('Variables sin dato', 'Variables without data')}: {row.missing.map(code => labelMissing(code, language)).join(', ')}.</p>}
            </article>)}</div>
            <p className="mt-4 text-xs text-muted">{t('La humedad relativa del aire es distinta de la humedad volumétrica del suelo estimada por el modelo. Fuente meteorológica:', 'Relative air humidity differs from model-estimated volumetric soil moisture. Weather source:')} <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">Open-Meteo</a> {t('y', 'and')} ECMWF; {t('la referencia histórica, cuando aparece, es', 'the historical reference, when shown, is')} NASA POWER.</p>
          </div>}
        </section>
        <section className="panel">
          <h2 className="flex items-center gap-2 text-xl font-bold"><FlaskConical size={22} /> {t('Fertilizantes', 'Fertilizers')}</h2>
          <p className="mt-2 text-sm text-muted">{t('Espacio reservado para diez fertilizantes. Los productos, dosis, comparaciones y resultados se definirán en una fase posterior.', 'Reserved space for ten fertilizers. Products, rates, comparisons, and results will be defined in a later phase.')}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{fertilizerSlots.map(number => <div key={number} className="rounded-xl border border-line bg-paper p-4" aria-label={`Espacio para fertilizante ${number}, no disponible`}>
            <span className="text-xs font-bold text-leaf">{t('FERTILIZANTE', 'FERTILIZER')} {String(number).padStart(2, '0')}</span>
            <p className="mt-3 text-sm font-semibold">{t('Sin configurar', 'Not configured')}</p><p className="mt-1 text-xs text-muted">{t('Próximamente', 'Coming soon')}</p>
          </div>)}</div>
        </section>
      </div>
      <aside className="panel lg:sticky lg:top-28">
        <h2 className="text-lg font-bold">{t('Parcela de referencia', 'Reference parcel')}</h2>
        <label className="field mt-4">{t('Elegir parcela', 'Choose a parcel')}<ParcelSelect parcels={parcels} value={id} onChange={selectParcel} /></label>
        {parcel ? <div className="mt-4 rounded-xl bg-paper p-4"><strong>{parcel.name}</strong><p className="mt-1 text-sm text-muted">{parcel.location || parcel.country} · {parcel.area_ha} ha {t('registradas', 'registered')}</p></div> : <p className="mt-4 text-sm text-muted">{t('Seleccione una parcela para revisar la configuración.', 'Select a parcel to review the setup.')}</p>}
        <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-muted">{t('El contexto meteorológico se consulta únicamente al pulsar el botón. NASA POWER histórico no es un pronóstico y EC46 no predice el clima exacto de la parcela.', 'Weather context is queried only when you press the button. Historical NASA POWER is not a forecast, and EC46 does not predict the exact weather on the parcel.')}</p>
      </aside>
    </div>}
  </div>
}
