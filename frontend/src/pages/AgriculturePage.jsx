import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, MapPinned, Sprout } from 'lucide-react'
import { api, errorMessage } from '../api'
import ParcelMap from '../components/ParcelMap'
import { cropVisuals, CropWindowCards, Empty, Heading, ParcelSelect, useParcels } from './shared'
import { translated, usePreferences } from '../preferences'

export function AgriculturePage() {
  const { language } = usePreferences()
  const t = (es, en) => translated(language, es, en)
  const { parcels } = useParcels()
  const [params, setParams] = useSearchParams()
  const id = params.get('parcela') || ''
  const parcel = parcels.find(p => String(p.id) === id)
  const [candidates, setCandidates] = useState(null)
  const [rotation, setRotation] = useState(null)
  const [strategies, setStrategies] = useState(['', '', ''])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [catalog, setCatalog] = useState([])
  const [activeStrategy, setActiveStrategy] = useState(0)
  const [aiStatus, setAiStatus] = useState({ configured: false, detail: t('Comprobando Ollama local…', 'Checking local Ollama…') })
  const [aiReview, setAiReview] = useState(null)
  useEffect(() => {
    api.get('crops/').then(({ data }) => setCatalog(data.results || data)).catch(() => {})
  }, [])
  useEffect(() => { checkAi() }, [])
  async function checkAi() {
    try {
      const { data } = await api.get('ai/status/')
      setAiStatus(data)
    } catch (err) { setAiStatus({ configured: false, detail: errorMessage(err) }) }
  }
  function choose(value) { setParams(value ? { parcela: value } : {}); setCandidates(null); setRotation(null); setAiReview(null); setMessage('') }
  function addCrop(name) {
    setAiReview(null)
    setStrategies(current => current.map((value, index) => index === activeStrategy ? [value.trim(), name].filter(Boolean).join(', ') : value))
  }
  async function askAi() {
    setBusy(true); setMessage(''); setAiReview(null)
    try {
      const names = strategies[activeStrategy].split(',').map(name => name.trim()).filter(Boolean)
      const { data } = await api.post(`parcels/${id}/ai-rotation-review/`, {
        crops: names, strategy_name: `${t('Estrategia', 'Strategy')} ${'ABC'[activeStrategy]}`,
      })
      setAiReview(data)
    } catch (err) { setMessage(errorMessage(err)) } finally { setBusy(false) }
  }
  async function recommend() {
    setBusy(true); setMessage('')
    try {
      const { data } = await api.post(`parcels/${id}/recommend/`)
      setCandidates(data); setMessage(t('Análisis exploratorio guardado en el historial de esta parcela.', 'Exploratory analysis saved to this parcel’s history.'))
    } catch (err) { setMessage(errorMessage(err)) } finally { setBusy(false) }
  }
  async function compare() {
    setBusy(true); setMessage('')
    try {
      const { data } = await api.post(`parcels/${id}/rotations/`, {
        strategies: strategies.map((s, index) => ({
          name: `${t('Estrategia', 'Strategy')} ${'ABC'[index]}`, crops: s.split(',').map(name => name.trim()).filter(Boolean),
        })),
      })
      setRotation(data); setMessage(t('Comparación guardada en el historial de esta parcela.', 'Comparison saved to this parcel’s history.'))
    } catch (err) { setMessage(errorMessage(err)) } finally { setBusy(false) }
  }
  return <div>
    <Heading eyebrow={t('03 / DECISIONES INFORMADAS', '03 / INFORMED DECISIONS')} title={t('Cultivos y rotaciones', 'Crops and rotations')} description={t('Explora ciclos respaldados por fichas FAO generales y compara la diversidad de tus estrategias.', 'Explore cycles based on general FAO profiles and compare the diversity of your strategies.')} />
    {!parcels.length ? <div className="mt-8"><Empty icon={Sprout} title={t('Primero ubica tu terreno', 'Locate your land first')} text={t('Para comparar cultivos necesitamos conocer la ubicación de tu parcela.', 'To compare crops, we need to know your parcel’s location.')} to="/parcelas" action={t('Crear parcela', 'Create parcel')} /></div> : <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
      <div className="min-w-0 space-y-5">
        <section className="panel">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{t('Cultivos para evaluar', 'Crops to evaluate')}</h2><p className="mt-2 max-w-xl text-sm text-muted">{t('Comparamos todos los meses de crecimiento contra registros históricos, no solo el mes de inicio. La referencia FAO no constituye asesoría local.', 'We compare every month of growth with historical records, not just the start month. FAO references are not local advice.')}</p></div><button disabled={!id || busy} className="button button-dark" title={t('Compara las fichas FAO con el clima histórico de todos los meses del cultivo y guarda un análisis.', 'Compare FAO profiles with historical climate for every crop month and save an analysis.')} onClick={recommend}><Sprout size={17} /> {t('Analizar cultivos', 'Analyze crops')}</button></div>
          {candidates && <div className="mt-6 space-y-4"><p className="text-xs text-muted">{t('Cada cultivo aparece una vez, en su duración principal; abra la tarjeta para ver otras duraciones compatibles. Son coincidencias históricas parciales, no una garantía de cosecha.', 'Each crop appears once, under its primary duration; open the card to see other compatible durations. These are partial historical matches, not a harvest guarantee.')}</p>{[2, 3, 6].map(duration => <CropWindowCards key={duration} candidates={candidates.candidates} duration={duration} primaryOnly />)}<p className="notice">{candidates.notice}</p></div>}
        </section>
        <section className="panel"><h2 className="text-xl font-bold">{t('Comparar rotaciones', 'Compare rotations')}</h2><p className="mt-2 text-sm text-muted">{t('Escribe cultivos separados por comas. Se comparan familias documentadas y datos faltantes; no se estima rendimiento ni agua.', 'Enter crops separated by commas. Documented families and missing data are compared; yield and water are not estimated.')}</p>
          <div className="mt-4 rounded-xl bg-paper p-4"><p className="text-sm font-bold">{t('1. Elige una estrategia para agregar cultivos', '1. Choose a strategy to add crops')}</p><div className="mt-2 flex gap-2">{[0, 1, 2].map(index => <button key={index} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${activeStrategy === index ? 'bg-leaf text-white' : 'border border-line bg-white'}`} onClick={() => { setActiveStrategy(index); setAiReview(null) }}>{t('Estrategia', 'Strategy')} {'ABC'[index]}</button>)}</div><p className="mt-3 text-sm font-bold">{t('2. Pulsa un cultivo o escribe el nombre en los cuadros', '2. Select a crop or type its name in the boxes')}</p><div className="mt-2 flex flex-wrap gap-2">{catalog.map(crop => <button key={crop.id} title={t(`Añadir ${crop.name} a la estrategia ${'ABC'[activeStrategy]}. Ficha FAO general, no validación regional.`, `Add ${crop.name} to strategy ${'ABC'[activeStrategy]}. General FAO profile, not regional validation.`)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs hover:bg-mint" onClick={() => addCrop(crop.name)}><span role="img" aria-label={crop.name}>{cropVisuals[crop.name] || '🌱'}</span> {crop.name}</button>)}</div></div>
          <div className="mt-5 grid gap-4 xl:grid-cols-3">{strategies.map((value, index) => <label className="field" key={index}>{t('Estrategia', 'Strategy')} {'ABC'[index]}<textarea rows="3" placeholder={t('Ej. papa, haba, cebada', 'e.g. potato, fava bean, barley')} value={value} onChange={e => { setStrategies(strategies.map((s, i) => i === index ? e.target.value : s)); setAiReview(null) }} /></label>)}</div>
          <button className="button button-dark mt-5" title={t('Compara la diversidad de familias de las tres estrategias y guarda el resultado; no predice plagas ni cosechas.', 'Compare crop-family diversity across the three strategies and save the result; this does not predict pests or harvests.')} disabled={!id || busy} onClick={compare}>3. {t('Comparar y guardar', 'Compare and save')} <ArrowRight size={17} /></button>
          {rotation && <div className="mt-6 grid gap-3 xl:grid-cols-3">{rotation.strategies.map(strategy => <div className="rounded-xl bg-paper p-5" key={strategy.name}><h3 className="font-bold">{strategy.name}</h3><p className="mt-2 text-sm">{strategy.crops.join(' → ') || t('Sin cultivos', 'No crops')}</p><p className="mt-4 text-sm">{t('Familias documentadas distintas', 'Distinct documented families')}: <strong>{strategy.families}</strong></p><p className="text-sm">{t('Repeticiones de familia', 'Repeated families')}: <strong>{strategy.repeated_families}</strong></p>{strategy.guidance?.map((line, index) => <p className="mt-2 text-xs text-muted" key={index}>{line}</p>)}{strategy.unknown.length > 0 && <p className="mt-2 text-xs text-muted">{t('Sin ficha FAO en esta zona demo', 'No FAO profile in this demo area')}: {strategy.unknown.join(', ')}</p>}</div>)}</div>}
          <div className="mt-6 border-t border-line pt-5"><h3 className="font-bold">{t('Revisión adicional con IA (opcional)', 'Additional AI review (optional)')}</h3><p className="mt-2 text-sm text-muted">{t('Ollama local puede comentar la estrategia', 'Local Ollama can comment on strategy')} {'ABC'[activeStrategy]}{t(', las familias y el perfil de suelo/riego disponible. No se envían coordenadas ni historial. Si no indicas si es asociación o rotación, la IA no puede asumirlo. El resultado no valida asociaciones ni garantiza evitar plagas.', ', crop families, and available soil/irrigation profile. Coordinates and history are not sent. If you do not specify whether this is intercropping or rotation, AI cannot assume it. The result does not validate crop associations or guarantee pest prevention.')}</p>
            <button className="button button-outline mt-3" title={aiStatus.configured ? t('Consulta Ollama en tu equipo con los cultivos, familias y perfil agronómico básico.', 'Ask Ollama on your device using crops, families, and the basic agronomic profile.') : t('Inicia Ollama y descarga el modelo para activar esta revisión.', 'Start Ollama and download the model to enable this review.')} disabled={!id || !aiStatus.configured || busy || !strategies[activeStrategy].trim()} onClick={askAi}>{t('Solicitar revisión de estrategia', 'Request strategy review')} {'ABC'[activeStrategy]}</button>
            {!aiStatus.configured && <p className="mt-2 text-xs text-muted">{aiStatus.detail} {t('El comparador de reglas transparentes funciona sin Ollama.', 'The transparent rules comparator works without Ollama.')} <button type="button" className="font-semibold underline" onClick={checkAi}>{t('Comprobar de nuevo', 'Check again')}</button></p>}
            {aiReview && <div className="notice mt-3 whitespace-pre-wrap"><strong>{t('Texto generado por', 'Text generated by')} {aiReview.model}</strong><p className="mt-2">{aiReview.review}</p><p className="mt-2 text-xs">{aiReview.notice}</p></div>}
          </div>
        </section>
        {message && <p role="status" className="notice">{message}</p>}
      </div>
      <aside className="panel lg:sticky lg:top-28">
        <h2 className="text-lg font-bold">{t('Parcela de referencia', 'Reference parcel')}</h2>
        <p className="mb-4 mt-1 text-xs text-muted">{t('Permanece visible al desplazarte por la página.', 'Stays visible as you scroll the page.')}</p>
        <label className="field">{t('Elegir parcela', 'Choose a parcel')}<ParcelSelect parcels={parcels} value={id} onChange={choose} /></label>
        {parcel ? <><div className="mt-4 h-44 overflow-hidden rounded-xl border border-line"><ParcelMap geometry={parcel.geometry} point={[parcel.latitude, parcel.longitude]} /></div><h3 className="mt-4 font-bold">{parcel.name}</h3><p className="text-sm text-muted">{parcel.location || parcel.country} · {parcel.area_ha.toFixed(2)} ha</p><p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-muted">{t('El catálogo exploratorio corresponde únicamente a un corredor geográfico aproximado de la Sierra ecuatoriana. Confirma condiciones locales con un profesional.', 'The exploratory catalog covers only an approximate geographic corridor in the Ecuadorian highlands. Confirm local conditions with a professional.')}</p></> : <p className="mt-5 flex gap-2 text-sm text-muted"><MapPinned size={18} className="shrink-0" /> {t('Selecciona una parcela para continuar.', 'Select a parcel to continue.')}</p>}
      </aside>
    </div>}
  </div>
}
