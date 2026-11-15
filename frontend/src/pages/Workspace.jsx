import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, CloudSun, Database, Download, MapPin, MapPinned, Plus, RefreshCcw, Save, Search, Sprout, Trash2, Upload } from 'lucide-react'
import { api, errorMessage } from '../api'
import ParcelMap from '../components/ParcelMap'
import ClimateReport from '../components/ClimateReport'
import ClimateAssistant from '../components/ClimateAssistant'
import ClimateRequestStatus from '../components/ClimateRequestStatus'
import ClimateAdvanced from '../components/ClimateAdvanced'
import { ClimateVisualSummary } from '../components/ClimateVisuals'
import { LunarCalendar } from '../components/LunarCalendar'
import CountrySelect from '../components/CountrySelect'
import { toggleAdvancedMode } from '../climateInsights'
import { usePreferences, translated } from '../preferences'
import { formatParcelArea, selectedParcelArea } from '../parcelMetrics'

function useParcels() {
  const [parcels, setParcels] = useState([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => { try { const { data } = await api.get('parcels/'); setParcels(data.results || data) } finally { setLoading(false) } }, [])
  useEffect(() => { reload().catch(() => setLoading(false)) }, [reload])
  return { parcels, loading, reload }
}
function Heading({ eyebrow, title, description }) { return <div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1>{description && <p className="mt-3 max-w-2xl text-muted">{description}</p>}</div> }
function Empty({ icon: Icon, title, text, to, action }) { return <div className="panel flex flex-col items-center py-14 text-center"><span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-paper"><Icon size={28} /></span><h3 className="font-display text-xl font-bold">{title}</h3><p className="mt-2 max-w-md text-sm text-muted">{text}</p>{to && <Link to={to} className="button button-dark mt-6">{action} <ArrowRight size={16} /></Link>}</div> }
function ParcelSelect({ parcels, value, onChange }) { return <select className="select" value={value} onChange={e => onChange(e.target.value)} aria-label="Seleccionar parcela"><option value="">Selecciona una parcela</option>{parcels.map(p => <option key={p.id} value={p.id}>{p.name} · {p.location || p.country}</option>)}</select> }

function LunarCalendarAccess() {
  const [open, setOpen] = useState(false)
  const { language } = usePreferences()
  return <>
    <button type="button" className="button button-outline" onClick={() => setOpen(true)} aria-haspopup="dialog"><CalendarDays size={18} aria-hidden="true" /> {translated(language, 'Calendario lunar', 'Lunar calendar')}</button>
    <LunarCalendar open={open} language={language} onClose={() => setOpen(false)} />
  </>
}

export function Dashboard() {
  const { parcels, loading } = useParcels()
  const [analyses, setAnalyses] = useState([])
  useEffect(() => { api.get('analyses/').then(({ data }) => setAnalyses((data.results || data).slice(0, 4))).catch(() => {}) }, [])
  const parcel = parcels[0]
  const parcelAreaDisplay = parcel ? formatParcelArea(parcel.geometry, parcel.area_ha) : null
  return <div><div className="mb-5 flex justify-end"><LunarCalendarAccess /></div><div className="flex flex-wrap items-end justify-between gap-4"><Heading eyebrow="TU ESPACIO DE TRABAJO" title="Una visión más clara de tu campo." description="Todos los datos de tu terreno, su clima y tus decisiones en un mismo lugar." /><Link to="/parcelas" className="button button-dark"><Plus size={17} /> Nueva parcela</Link></div>{loading ? <p className="mt-10">Cargando parcelas…</p> : !parcel ? <div className="mt-9"><Empty icon={MapPinned} title="Tu historia empieza con un lugar" text="Dibuja tu primera parcela para explorar su clima histórico con datos de NASA." to="/parcelas" action="Crear mi parcela" /></div> : <><div className="mt-9 grid gap-4 md:grid-cols-3"><div className="stat"><MapPin size={20} /><span className="mt-6 text-sm text-muted">Parcela activa</span><strong>{parcel.name}</strong><span className="text-xs text-muted">{parcel.location || parcel.country}</span></div><div className="stat"><MapPinned size={20} /><span className="mt-6 text-sm text-muted">Superficie geodésica</span><strong>{parcelAreaDisplay ? parcelAreaDisplay.hectares + " ha" : "Área no disponible"}</strong><span className="text-xs text-muted">Calculada a partir del polígono</span></div><div className="stat"><CloudSun size={20} /><span className="mt-6 text-sm text-muted">Historial climático</span><strong>3 años</strong><Link className="text-xs font-bold underline" to="/clima">Explorar datos NASA <ArrowRight className="inline" size={12} /></Link></div></div><div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]"><div className="panel overflow-hidden p-0"><div className="flex items-center justify-between p-6"><h2 className="text-xl font-bold">Tu terreno</h2><Link className="text-sm font-bold underline" to="/parcelas">Ver parcela</Link></div><div className="h-[320px]"><ParcelMap geometry={parcel.geometry} point={[parcel.latitude, parcel.longitude]} /></div></div><div className="panel"><h2 className="text-xl font-bold">Explora tus opciones</h2><p className="mt-2 text-sm text-muted">Conoce qué indican los datos y qué información falta para decidir mejor.</p><div className="mt-8 space-y-3"><Link to="/clima" className="action-row"><CloudSun size={20} /> Comparar clima <ArrowRight size={16} className="ml-auto" /></Link><Link to="/agricultura" className="action-row"><Sprout size={20} /> Cultivos y rotaciones <ArrowRight size={16} className="ml-auto" /></Link><Link to="/historial" className="action-row"><Database size={20} /> Mi historial <ArrowRight size={16} className="ml-auto" /></Link></div></div></div><div className="mt-6"><h2 className="mb-4 text-xl font-bold">Análisis recientes</h2>{analyses.length ? <div className="grid gap-3 md:grid-cols-2">{analyses.map(a => <div className="panel" key={a.id}><span className="text-xs uppercase text-muted">{a.kind}</span><h3 className="mt-2 font-bold">{a.title}</h3><span className="text-xs text-muted">{new Date(a.created_at).toLocaleDateString('es')}</span></div>)}</div> : <p className="text-sm text-muted">Todavía no hay análisis guardados.</p>}</div></>}</div>
}

export function ParcelsPage() {
  const { language } = usePreferences()
  const { parcels, loading, reload } = useParcels()
  const [selected, setSelected] = useState('')
  const [geometry, setGeometry] = useState(null)
  const [point, setPoint] = useState(null)
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [countryTouched, setCountryTouched] = useState(false)
  const [location, setLocation] = useState('Sierra ecuatoriana')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [satellite, setSatellite] = useState(false)
  const [date, setDate] = useState(new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10))
  const [profile, setProfile] = useState({ soil_texture: '', water_availability: '', irrigation: '', current_crop: '', notes: '' })
  const selectedParcel = parcels.find(parcel => String(parcel.id) === String(selected))
  const selectedArea = selectedParcelArea(parcels, selected, geometry, language === 'en' ? 'en' : 'es')
  const onGeometry = useCallback(g => setGeometry(g), [])
  const onPoint = useCallback(p => setPoint(p), [])
  function choose(id) {
    setSelected(id)
    setCountryTouched(false)
    const p = parcels.find(x => String(x.id) === String(id))
    if (p) { setName(p.name); setCountry(p.country); setLocation(p.location); setGeometry(p.geometry); setPoint([p.latitude, p.longitude]); api.get(`parcels/${id}/profile/`).then(({ data }) => setProfile(data)).catch(() => {}) }
    else { setName(''); setCountry(''); setCountryTouched(false); setGeometry(null); setPoint(null); setProfile({ soil_texture: '', water_availability: '', irrigation: '', current_crop: '', notes: '' }) }
  }
  async function save(e) {
    e.preventDefault(); setNotice(''); setCountryTouched(true)
    try {
      if (!geometry) throw new Error('Dibuja o importa un polígono primero.')
      const payload = { name, country, location, geometry }
      const { data } = selected ? await api.patch(`parcels/${selected}/`, payload) : await api.post('parcels/', payload)
      await api.put(`parcels/${data.id}/profile/`, profile)
      await reload(); setSelected(String(data.id)); setNotice('Parcela guardada correctamente.')
    } catch (err) { setNotice(err.response ? errorMessage(err) : err.message) }
  }
  async function remove() {
    if (!selected || !window.confirm('¿Eliminar esta parcela y todos sus registros? Esta acción no se puede deshacer.')) return
    try { await api.delete(`parcels/${selected}/`); await reload(); choose(''); setNotice('Parcela eliminada.') } catch (err) { setNotice(errorMessage(err)) }
  }
  async function find() {
    if (!search.trim()) return
    try {
      const { data: results } = await api.get('geocode/', { params: { q: search } })
      if (!results.length) throw new Error('No se encontró la ubicación.')
      const item = results[0]; setPoint([Number(item.lat), Number(item.lon)]); setNotice('Ubicación encontrada. La búsqueda se compartió con OpenStreetMap Nominatim.')
    } catch (err) { setNotice(err.response ? errorMessage(err) : err.message) }
  }
  function importFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100000) { setNotice('GeoJSON demasiado grande.'); return }
    file.text().then(text => { try { const json = JSON.parse(text); const g = json.type === 'FeatureCollection' ? json.features?.[0]?.geometry : json.type === 'Feature' ? json.geometry : json; if (g?.type !== 'Polygon') throw new Error('Importa un polígono GeoJSON.'); setGeometry(g); setNotice('Polígono importado. Guarda la parcela para validarlo.') } catch (err) { setNotice(err.message) } })
  }
  function exportFile() { const url = URL.createObjectURL(new Blob([JSON.stringify({ type: 'Feature', properties: { name }, geometry }, null, 2)], { type: 'application/geo+json' })); const a = document.createElement('a'); a.href = url; a.download = 'parcela.geojson'; a.click(); URL.revokeObjectURL(url) }
  function locate() { navigator.geolocation?.getCurrentPosition(pos => setPoint([pos.coords.latitude, pos.coords.longitude]), () => setNotice('No se pudo obtener tu ubicación. Puedes introducir coordenadas manualmente.')) }
  return <div><Heading eyebrow="01 / TU TERRENO" title="Mis parcelas" description="Dibuja, edita y guarda tu terreno. El área se calcula geodésicamente en el servidor." /><div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]"><div><div className="mb-3 flex flex-wrap gap-2"><input className="input min-w-0 flex-1" placeholder="Buscar lugar (ej. Riobamba, Ecuador)" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && find()} /><button className="button button-outline" onClick={find}><Search size={17} /> Buscar</button><button className="button button-outline" onClick={locate}><MapPin size={17} /> Ubicarme</button></div><div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-4 text-sm"><span className="font-semibold">Área de la parcela seleccionada</span>{selectedParcel ? (selectedArea ? <strong>Área: {selectedArea.hectares} ha ({selectedArea.squareMeters} m²)</strong> : <strong>Área no disponible</strong>) : <span className="text-muted">Selecciona una parcela guardada para consultar su área.</span>}</div><div className="overflow-hidden rounded-2xl border border-line bg-white"><div className="h-[480px]"><ParcelMap geometry={geometry} onChange={onGeometry} point={point} onPoint={onPoint} satellite={satellite} date={date} /></div><div className="flex flex-wrap items-center gap-3 border-t border-line p-4 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={satellite} onChange={e => setSatellite(e.target.checked)} /> NASA GIBS (MODIS Terra)</label>{satellite && <label>Fecha <input className="input ml-2 !w-auto !py-1" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>}<span className="ml-auto text-muted">Imágenes satelitales, no mediciones de parcela.</span></div></div><div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><label className="button button-outline cursor-pointer"><Upload size={16} /> Importar GeoJSON<input className="hidden" type="file" accept=".json,.geojson,application/geo+json" onChange={importFile} /></label><button className="button button-outline" disabled={!geometry} onClick={exportFile}><Download size={16} /> Exportar</button><span className="text-muted">Usa la barra del mapa para dibujar o editar polígonos.</span></div></div><div className="panel h-fit"><h2 className="text-xl font-bold">Datos de parcela</h2><label className="field mt-5">Parcela guardada<ParcelSelect parcels={parcels} value={selected} onChange={choose} /></label>{loading && <p className="text-xs text-muted">Cargando…</p>}<form className="mt-5 space-y-4" onSubmit={save}><label className="field">Nombre<input required value={name} onChange={e => setName(e.target.value)} placeholder="Mi parcela" /></label><div className="grid grid-cols-2 gap-3"><CountrySelect value={country} language={language} invalid={countryTouched && !country} onChange={setCountry} onBlur={() => setCountryTouched(true)} /><label className="field">Región documentada<input value={location} onChange={e => setLocation(e.target.value)} placeholder="Sierra ecuatoriana" /></label></div><div className="grid grid-cols-2 gap-3"><label className="field">Latitud<input type="number" step="any" value={point?.[0] ?? ''} onChange={e => setPoint([Number(e.target.value), point?.[1] || 0])} /></label><label className="field">Longitud<input type="number" step="any" value={point?.[1] ?? ''} onChange={e => setPoint([point?.[0] || 0, Number(e.target.value)])} /></label></div><p className="text-xs text-muted">Las coordenadas manuales mueven el mapa; para guardar debes dibujar un polígono. NASA recibirá el punto representativo cuando consultes su clima.</p><details className="border-t border-line pt-4"><summary className="cursor-pointer font-semibold">Perfil agronómico (opcional)</summary><div className="mt-4 space-y-3">{[['current_crop', 'Cultivo actual'], ['soil_texture', 'Textura del suelo'], ['water_availability', 'Agua disponible'], ['irrigation', 'Riego'], ['notes', 'Observaciones']].map(([key, label]) => <label className="field" key={key}>{label}<input value={profile[key] || ''} placeholder="No lo sé" onChange={e => setProfile({ ...profile, [key]: e.target.value })} /></label>)}</div></details><button className="button button-dark w-full"><Save size={17} /> Guardar parcela</button>{selected && <button type="button" className="button button-outline w-full" onClick={remove}><Trash2 size={16} /> Eliminar parcela</button>}</form>{notice && <p role="status" className="notice mt-4">{notice}</p>}</div></div></div>
}

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function ClimatePage() {
  const { language } = usePreferences()
  const english = language === 'en'
  const { parcels } = useParcels()
  const [id, setId] = useState('')
  const [result, setResult] = useState(null)
  const [variable, setVariable] = useState('T2M')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [requestError, setRequestError] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [endYear, setEndYear] = useState(new Date().getFullYear() - 1)
  const selectedParcel = parcels.find(parcel => String(parcel.id) === String(id))
  async function load(save = false) {
    if (!id || busy) return
    setBusy(true)
    setMessage('')
    setRequestError(false)
    if (!save) setResult(null)
    const path = 'parcels/' + id + '/climate/'
    const params = { start_year: endYear - 2, end_year: endYear }
    try {
      const { data } = await api[save ? 'post' : 'get'](path, save ? params : { params })
      setResult(data)
      if (save) setMessage(translated(language, 'Análisis guardado en tu historial.', 'Analysis saved to your history.'))
    } catch (error) {
      if (save) setMessage(translated(language, 'No se pudo guardar el análisis. Inténtalo de nuevo.', 'The analysis could not be saved. Please try again.'))
      else setRequestError(true)
    } finally {
      setBusy(false)
    }
  }

  const years = result ? [...new Set(result.monthly.map(row => row.year))] : []
  return <div>
    <Heading
      eyebrow={translated(language, '02 / DATOS NASA', '02 / NASA DATA')}
      title={translated(language, 'Historial climático', 'Historical climate')}
      description={translated(language, 'Consulta hasta tres años calendario completos. Son estimaciones regionales, no mediciones dentro de tu parcela.', 'Query up to three complete calendar years. These are regional estimates, not measurements inside your parcel.')}
    />
    {!parcels.length ? <div className="mt-8">
      <Empty icon={MapPinned} title={translated(language, 'Primero crea una parcela', 'Create a parcel first')} text={translated(language, 'Necesitamos una ubicación registrada para consultar NASA POWER.', 'A registered location is needed to query NASA POWER.')} to="/parcelas" action={translated(language, 'Ir a mis parcelas', 'Go to my parcels')} />
    </div> : <>
      <div className="panel mt-8 flex flex-wrap items-end gap-3">
        <label className="field min-w-[200px] flex-1">{translated(language, 'Parcela', 'Parcel')}
          <ParcelSelect parcels={parcels} value={id} onChange={value => { setId(value); setResult(null); setMessage(''); setRequestError(false) }} />
        </label>
        <label className="field">{translated(language, 'Último año completo', 'Last complete year')}
          <input type="number" className="!w-32" min="1983" max={new Date().getFullYear() - 1} value={endYear} onChange={event => { setEndYear(Number(event.target.value)); setResult(null); setRequestError(false) }} />
        </label>
        <button type="button" className="button button-dark" disabled={!id || busy} onClick={() => load()}>
          <RefreshCcw size={18} aria-hidden="true" /> {busy ? translated(language, 'Consultando…', 'Querying…') : translated(language, 'Consultar y generar ficha', 'Query and create report')}
        </button>
      </div>

      <ClimateRequestStatus state={busy ? 'loading' : requestError ? 'error' : (!result ? 'empty' : 'hidden')} selectedParcel={selectedParcel} onRetry={() => load()} language={language} />
      {message && <p role="status" className="notice mt-4">{message}</p>}

      {result && selectedParcel && <>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="stat"><span className="text-sm text-muted">{translated(language, 'Periodo consultado', 'Period queried')}</span><strong>{years.join(' · ')}</strong></div>
          <div className="stat"><span className="text-sm text-muted">{translated(language, 'Fuente', 'Source')}</span><strong className="!text-lg">NASA POWER</strong><span className="text-xs text-muted">{result.cached ? translated(language, 'Desde caché', 'From cache') : translated(language, 'Consulta reciente', 'Recent query')}</span></div>
          <div className="stat"><span className="text-sm text-muted">{translated(language, 'Cobertura', 'Coverage')}</span><strong>{Object.values(result.coverage || {}).every(item => item.complete) ? translated(language, 'Completa', 'Complete') : translated(language, 'Revisar faltantes', 'Review missing data')}</strong><span className="text-xs text-muted">{translated(language, 'La ficha detalla días y fechas por variable.', 'The report lists days and dates for each variable.')}</span></div>
        </div>

        <ClimateAdvanced
          open={advanced}
          result={result}
          language={language}
          variable={variable}
          onVariableChange={setVariable}
          onToggle={() => setAdvanced(toggleAdvancedMode)}
        />
        <ClimateVisualSummary result={result} language={language} />


        <ClimateReport parcel={selectedParcel} result={result} />
        <ClimateAssistant parcel={selectedParcel} result={result} />
        <button type="button" className="button button-outline mt-5 no-print" onClick={() => load(true)} disabled={busy}>
          <Save size={18} aria-hidden="true" /> {translated(language, 'Guardar este análisis', 'Save this analysis')}
        </button>
      </>}
    </>}
  </div>
}
export function AgriculturePage() {
  const { parcels } = useParcels()
  const [id, setId] = useState('')
  const [candidates, setCandidates] = useState(null)
  const [rotation, setRotation] = useState(null)
  const [strategies, setStrategies] = useState(['', '', ''])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function recommend() { setBusy(true); setMessage(''); try { const { data } = await api.post(`parcels/${id}/recommend/`); setCandidates(data); setMessage('Recomendación guardada en tu historial.') } catch (err) { setMessage(errorMessage(err)) } finally { setBusy(false) } }
  async function compare() { setBusy(true); setMessage(''); try { const { data } = await api.post(`parcels/${id}/rotations/`, { strategies: strategies.map((s, i) => ({ name: `Estrategia ${'ABC'[i]}`, crops: s.split(',').map(x => x.trim()).filter(Boolean) })) }); setRotation(data); setMessage('Comparación guardada en tu historial.') } catch (err) { setMessage(errorMessage(err)) } finally { setBusy(false) } }
  return <div><Heading eyebrow="03 / DECISIONES INFORMADAS" title="Cultivos y rotaciones" description="Explora alternativas respaldadas por fichas regionales y compara la diversidad de tus estrategias." />{!parcels.length ? <div className="mt-8"><Empty icon={Sprout} title="Primero ubica tu terreno" text="Para comparar cultivos necesitamos conocer la ubicación de tu parcela." to="/parcelas" action="Crear parcela" /></div> : <><div className="panel mt-8"><label className="field max-w-md">Selecciona una parcela<ParcelSelect parcels={parcels} value={id} onChange={v => { setId(v); setCandidates(null); setRotation(null) }} /></label></div><div className="panel mt-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Cultivos compatibles</h2><p className="mt-2 max-w-xl text-sm text-muted">Solo mostramos cultivos con fichas documentadas para la región escrita en la parcela. No es una predicción de cosecha.</p></div><button disabled={!id || busy} className="button button-dark" onClick={recommend}><Sprout size={17} /> Analizar cultivos</button></div>{candidates && (candidates.candidates.length ? <div className="mt-6 grid gap-3 md:grid-cols-2">{candidates.candidates.map((c, i) => <div className="rounded-xl border border-line p-5" key={i}><h3 className="text-lg font-bold">{c.crop}</h3><p className="text-xs text-muted">{c.family} · {c.region}</p><p className="mt-4 text-sm">{c.reason}</p><p className="mt-2 text-sm"><strong>Meses orientativos:</strong> {c.months.map(m => monthNames[m - 1]).join(', ')}</p><p className="mt-2 text-sm text-muted">{c.risks}</p>{c.source && <a className="mt-3 block text-xs underline" href={c.source} target="_blank" rel="noreferrer">Consultar fuente</a>}</div>)}</div> : <p className="notice mt-5">{candidates.notice}</p>)}</div><div className="panel mt-5"><h2 className="text-xl font-bold">Comparar rotaciones</h2><p className="mt-2 text-sm text-muted">Escribe cultivos separados por comas. La comparación identifica familias documentadas y vacíos de información; no estima rendimiento.</p><div className="mt-5 grid gap-4 lg:grid-cols-3">{strategies.map((v, i) => <label className="field" key={i}>Estrategia {'ABC'[i]}<textarea rows="3" placeholder="Ej. papa, haba, cebada" value={v} onChange={e => setStrategies(strategies.map((s, index) => index === i ? e.target.value : s))} /></label>)}</div><button className="button button-dark mt-5" disabled={!id || busy} onClick={compare}>Comparar y guardar <ArrowRight size={17} /></button>{rotation && <div className="mt-6 grid gap-3 md:grid-cols-3">{rotation.strategies.map(s => <div className="rounded-xl bg-paper p-5" key={s.name}><h3 className="font-bold">{s.name}</h3><p className="mt-2 text-sm">{s.crops.join(' → ') || 'Sin cultivos'}</p><p className="mt-4 text-sm">Familias documentadas distintas: <strong>{s.families}</strong></p><p className="text-sm">Repeticiones de familia: <strong>{s.repeated_families}</strong></p>{s.unknown.length > 0 && <p className="mt-2 text-xs text-muted">Sin ficha regional: {s.unknown.join(', ')}</p>}</div>)}</div>}</div>{message && <p role="status" className="notice mt-4">{message}</p>}</>}</div>
}

export function HistoryPage() {
  const { parcels } = useParcels()
  const [records, setRecords] = useState([])
  const [analyses, setAnalyses] = useState([])
  const [parcel, setParcel] = useState('')
  const [crop, setCrop] = useState('')
  const [planted, setPlanted] = useState('')
  const [harvested, setHarvested] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(null)
  const reload = useCallback(() => { api.get('history/').then(({ data }) => setRecords(data.results || data)).catch(() => {}); api.get('analyses/').then(({ data }) => setAnalyses(data.results || data)).catch(() => {}) }, [])
  useEffect(() => { reload() }, [reload])
  function resetForm() { setEditing(null); setParcel(''); setCrop(''); setPlanted(''); setHarvested(''); setNotes('') }
  async function add(e) {
    e.preventDefault()
    try {
      const data = { parcel: Number(parcel), crop_name: crop, planted_on: planted, harvested_on: harvested || null, notes }
      if (editing) await api.patch(`history/${editing}/`, data)
      else await api.post('history/', data)
      resetForm(); setMessage(editing ? 'Registro actualizado.' : 'Cultivo registrado.'); reload()
    } catch (err) { setMessage(errorMessage(err)) }
  }
  function edit(record) {
    setEditing(record.id); setParcel(String(record.parcel)); setCrop(record.crop_name)
    setPlanted(record.planted_on); setHarvested(record.harvested_on || ''); setNotes(record.notes || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function remove(id) { if (!window.confirm('¿Eliminar este registro?')) return; try { await api.delete(`history/${id}/`); reload() } catch (err) { setMessage(errorMessage(err)) } }
  return <div>
    <Heading eyebrow="04 / TU MEMORIA AGRÍCOLA" title="Mi historial" description="Los registros que introduces son tuyos. Los análisis de NASA se distinguen de tus observaciones." />
    <div className="mt-8 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <form className="panel h-fit space-y-4" onSubmit={add}>
        <h2 className="text-xl font-bold">{editing ? 'Editar cultivo' : 'Registrar un cultivo'}</h2>
        <label className="field">Parcela<ParcelSelect parcels={parcels} value={parcel} onChange={setParcel} /></label>
        <label className="field">Cultivo<input required value={crop} onChange={e => setCrop(e.target.value)} placeholder="Ej. haba" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">Siembra<input required type="date" value={planted} onChange={e => setPlanted(e.target.value)} /></label>
          <label className="field">Cosecha<input type="date" value={harvested} onChange={e => setHarvested(e.target.value)} /></label>
        </div>
        <label className="field">Observaciones<textarea rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Resultados, aprendizajes…" /></label>
        <button disabled={!parcel} className="button button-dark w-full"><Save size={17} /> {editing ? 'Actualizar registro' : 'Guardar registro'}</button>
        {editing && <button type="button" className="button button-outline w-full" onClick={resetForm}>Cancelar edición</button>}
        {message && <p role="status" className="notice">{message}</p>}
      </form>
      <div className="panel"><h2 className="text-xl font-bold">Línea de tiempo de cultivos</h2>
        {records.length ? <div className="mt-5 border-l border-ink pl-5">{records.map(r => <div className="relative mb-6" key={r.id}>
          <span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-ink" />
          <div className="flex justify-between gap-3"><strong>{r.crop_name}</strong><div className="flex gap-3"><button className="text-xs underline" onClick={() => edit(r)}>Editar</button><button title="Eliminar" aria-label={`Eliminar ${r.crop_name}`} onClick={() => remove(r.id)}><Trash2 size={16} /></button></div></div>
          <p className="text-xs text-muted">Siembra: {r.planted_on} {r.harvested_on && `· Cosecha: ${r.harvested_on}`}</p><p className="mt-2 text-sm">{r.notes}</p>
        </div>)}</div> : <p className="mt-6 text-sm text-muted">Aún no has registrado cultivos.</p>}
      </div>
    </div>
    <div className="panel mt-5"><h2 className="text-xl font-bold">Análisis guardados</h2>
      {analyses.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{analyses.map(a => <details className="rounded-xl border border-line p-4" key={a.id}>
        <summary className="cursor-pointer font-semibold">{a.title} <span className="block text-xs font-normal text-muted">{new Date(a.created_at).toLocaleString('es')} · {a.kind}</span></summary>
        <div className="mt-4 text-sm text-muted">{a.kind === 'climate' ? `Periodo: ${a.result.years?.join('–')}. ${a.result.notice}` : a.kind === 'recommendation' ? `${a.result.candidates?.map(c => c.crop).join(', ') || 'Sin candidatos'}. ${a.result.notice}` : a.result.strategies?.map(s => `${s.name}: ${s.crops.join(' → ')}`).join('; ')}</div>
      </details>)}</div> : <p className="mt-5 text-sm text-muted">Aún no guardaste análisis.</p>}
    </div>
  </div>
}
