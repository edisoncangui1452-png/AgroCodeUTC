import { useCallback, useState } from 'react'
import { Download, MapPin, Save, Search, Trash2, Upload } from 'lucide-react'
import { api, errorMessage } from '../api'
import ParcelMap from '../components/ParcelMap'
import CountrySelect from '../components/CountrySelect'
import { selectedParcelArea } from '../parcelMetrics'
import { translated, usePreferences } from '../preferences'
import { countryNames, Heading, ParcelSelect, soilTextures, useParcels } from './shared'

const emptyProfile = { soil_texture: '', irrigation: '', current_crop: '', notes: '' }

export function ParcelsPage() {
  const { language } = usePreferences()
  const t = (es, en) => translated(language, es, en)
  const { parcels, loading, reload } = useParcels()
  const [selected, setSelected] = useState('')
  const [geometry, setGeometry] = useState(null)
  const [point, setPoint] = useState(null)
  const [focus, setFocus] = useState(null)
  const [searchMarker, setSearchMarker] = useState(null)
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [location, setLocation] = useState('')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [satellite, setSatellite] = useState(false)
  const [date, setDate] = useState(new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10))
  const [profile, setProfile] = useState(emptyProfile)
  const selectedParcel = parcels.find(parcel => String(parcel.id) === String(selected))
  const selectedArea = selectedParcelArea(parcels, selected, geometry, language === 'en' ? 'en' : 'es')
  const onGeometry = useCallback(g => { setGeometry(g); setFocus(null); if (g) setSearchMarker(null) }, [])
  const onPoint = useCallback(p => setPoint(p), [])

  function choose(id) {
    setSelected(id)
    const parcel = parcels.find(p => String(p.id) === String(id))
    if (parcel) {
      setName(parcel.name); setCountry(parcel.country); setLocation(parcel.location)
      setGeometry(parcel.geometry); setPoint([parcel.latitude, parcel.longitude]); setFocus(null); setSearchMarker(null)
      api.get(`parcels/${id}/profile/`).then(({ data }) => setProfile({
        ...data,
        soil_texture: soilTextures.includes(data.soil_texture) ? data.soil_texture : '',
        irrigation: ['Sí', 'No'].includes(data.irrigation) ? data.irrigation : '',
      })).catch(() => {})
    } else {
      setName(''); setCountry(''); setLocation(''); setGeometry(null); setPoint(null)
      setFocus(null); setSearchMarker(null); setProfile(emptyProfile)
    }
  }

  function focusResult(item) {
    const center = [Number(item.lat), Number(item.lon)]
    const bounds = item.boundingbox?.map(Number)
    setPoint(center)
    setSearchMarker(center)
    setFocus(bounds?.length === 4 && bounds.every(Number.isFinite)
      ? { bounds: [[bounds[0], bounds[2]], [bounds[1], bounds[3]]], maxZoom: item.type === 'country' ? 7 : 16 }
      : { center, zoom: 15 })
    if (item.country_code && countryNames[item.country_code]) setCountry(item.country_code)
    if (item.type !== 'country' && item.region) setLocation(item.region)
  }
  async function find(query = search) {
    if (!query.trim()) return
    try {
      const { data: results } = await api.get('geocode/', { params: { q: query } })
      if (!results.length) throw new Error(t('No se encontró la ubicación.', 'Location not found.'))
      focusResult(results[0])
      setNotice(t('Mapa enfocado en la zona. La búsqueda se compartió con OpenStreetMap Nominatim.', 'Map centered on the area. The search was shared with OpenStreetMap Nominatim.'))
    } catch (err) { setNotice(err.response ? errorMessage(err) : err.message) }
  }
  async function chooseCountry(code) {
    setCountry(code); setNotice('')
    if (code) await find(countryNames[code])
  }
  function locate() {
    if (!navigator.geolocation) { setNotice(t('Este navegador no admite geolocalización. Usa la búsqueda.', 'This browser does not support geolocation. Use search instead.')); return }
    navigator.geolocation.getCurrentPosition(async pos => {
      const center = [pos.coords.latitude, pos.coords.longitude]
      setPoint(center); setSearchMarker(center); setFocus({ center, zoom: 15 })
      try {
        const { data } = await api.get('geocode/reverse/', { params: { lat: center[0], lon: center[1] } })
        if (data.country_code && countryNames[data.country_code]) setCountry(data.country_code)
        if (data.region) setLocation(data.region)
        setNotice(t('Ubicación recibida. El país se obtuvo mediante OpenStreetMap Nominatim.', 'Location received. The country was identified through OpenStreetMap Nominatim.'))
      } catch { setNotice(t('Ubicación recibida; selecciona el país manualmente.', 'Location received; select the country manually.')) }
    }, () => setNotice(t('No se pudo obtener tu ubicación. Usa la búsqueda o el mapa.', 'Could not get your location. Use search or the map.')))
  }
  async function save(e) {
    e.preventDefault(); setNotice('')
    try {
      if (!geometry) throw new Error(t('Dibuja o importa un polígono primero.', 'Draw or import a polygon first.'))
      const payload = { name, country, location, geometry }
      const { data } = selected ? await api.patch(`parcels/${selected}/`, payload) : await api.post('parcels/', payload)
      await api.put(`parcels/${data.id}/profile/`, {
        current_crop: profile.current_crop || '', soil_texture: profile.soil_texture || '',
        irrigation: profile.irrigation || '', notes: profile.notes || '',
      })
      await reload(); setSelected(String(data.id)); setNotice(t('Parcela guardada correctamente.', 'Parcel saved successfully.'))
    } catch (err) { setNotice(err.response ? errorMessage(err) : err.message) }
  }
  async function remove() {
    if (!selected || !window.confirm(t('¿Eliminar esta parcela y todos sus registros? Esta acción no se puede deshacer.', 'Delete this parcel and all its records? This action cannot be undone.'))) return
    try { await api.delete(`parcels/${selected}/`); await reload(); choose(''); setNotice(t('Parcela eliminada.', 'Parcel deleted.')) }
    catch (err) { setNotice(errorMessage(err)) }
  }
  function importFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100000) { setNotice(t('GeoJSON demasiado grande.', 'GeoJSON file is too large.')); return }
    file.text().then(text => {
      try {
        const json = JSON.parse(text)
        const polygon = json.type === 'FeatureCollection' ? json.features?.[0]?.geometry : json.type === 'Feature' ? json.geometry : json
        if (polygon?.type !== 'Polygon') throw new Error(t('Importa un polígono GeoJSON.', 'Import a GeoJSON polygon.'))
        setGeometry(polygon); setFocus(null); setNotice(t('Polígono importado. Confirma el país y guarda para validarlo.', 'Polygon imported. Confirm the country and save to validate it.'))
      } catch (err) { setNotice(err.message) }
    })
  }
  function exportFile() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ type: 'Feature', properties: { name }, geometry }, null, 2)], { type: 'application/geo+json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'parcela.geojson'; link.click(); URL.revokeObjectURL(url)
  }

  return <div>
    <Heading eyebrow={t('01 / TU TERRENO', '01 / YOUR LAND')} title={t('Mis parcelas', 'My parcels')} description={t('Enfoca el mapa en un país o localidad, dibuja tu terreno y guarda su información. La superficie se calcula en el servidor.', 'Center the map on a country or location, draw your land, and save its details. Area is calculated on the server.')} />
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap gap-2">
          <input className="input min-w-0 flex-1" aria-label={t('Buscar localidad o sector', 'Search for a location or area')} placeholder={t('Buscar sector, ciudad o país…', 'Search for an area, city, or country…')} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && find()} />
          <button className="button button-outline" title={t('Busca un país, ciudad o sector; el mapa se centrará y colocará una chincheta.', 'Search for a country, city, or area; the map will center and place a marker.')} onClick={() => find()}><Search size={17} /> {t('Buscar', 'Search')}</button>
          <button className="button button-outline" title={t('Solicita tu ubicación para centrar el mapa; requiere permiso del navegador.', 'Use your location to center the map; browser permission is required.')} onClick={locate}><MapPin size={17} /> {t('Ubicarme', 'Use my location')}</button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="h-[490px]"><ParcelMap geometry={geometry} onChange={onGeometry} point={point} onPoint={onPoint} focus={focus} searchMarker={searchMarker} satellite={satellite} date={date} /></div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line p-4 text-xs">
            <label className="flex items-center gap-2" title={t('Muestra u oculta la capa visual MODIS Terra de NASA; no aporta mediciones del terreno.', 'Show or hide the NASA MODIS Terra visual layer; it does not provide land measurements.')}><input type="checkbox" checked={satellite} onChange={e => setSatellite(e.target.checked)} /> NASA GIBS (MODIS Terra)</label>
            {satellite && <label>{t('Fecha', 'Date')} <input className="input ml-2 !w-auto !py-1" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>}
            <span className="ml-auto text-muted">{t('Imágenes satelitales, no mediciones de parcela.', 'Satellite imagery, not parcel measurements.')}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 text-sm">
          <span className="font-semibold">{t('Área de la parcela seleccionada', 'Selected parcel area')}</span>
          {selectedParcel
            ? selectedArea
              ? <strong>{t('Área', 'Area')}: {selectedArea.hectares} ha ({selectedArea.squareMeters} m²)</strong>
              : <strong>{t('Área no disponible', 'Area unavailable')}</strong>
            : <span className="text-muted">{t('Selecciona una parcela guardada para consultar su área.', 'Select a saved parcel to view its area.')}</span>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <label className="button button-outline cursor-pointer" title={t('Abre un archivo .geojson o .json con un polígono para editarlo y guardarlo como parcela.', 'Open a .geojson or .json polygon file to edit and save it as a parcel.')}><Upload size={16} /> {t('Importar GeoJSON', 'Import GeoJSON')}<input className="hidden" type="file" accept=".json,.geojson,application/geo+json" onChange={importFile} /></label>
          <button className="button button-outline" title={t('Descarga el polígono actual como archivo parcela.geojson; no borra ni comparte datos.', 'Download the current polygon as parcela.geojson; no data is deleted or shared.')} disabled={!geometry} onClick={exportFile}><Download size={16} /> {t('Exportar', 'Export')}</button>
          <div className="w-full text-xs leading-relaxed text-muted"><strong>{t('Importar', 'Import')}:</strong> {t('abre un archivo GeoJSON (.geojson o .json) que contenga un polígono; revisa país y guarda para conservarlo.', 'open a GeoJSON (.geojson or .json) file containing a polygon; check the country and save to keep it.')} <strong>{t('Exportar', 'Export')}:</strong> {t('descarga el polígono actual como parcela.geojson para reutilizarlo en otra herramienta.', 'download the current polygon as parcela.geojson for use in another tool.')}</div>
        </div>
      </div>
      <div className="panel h-fit"><h2 className="text-xl font-bold">{t('Datos de parcela', 'Parcel details')}</h2>
        <label className="field mt-5">{t('Parcela guardada', 'Saved parcel')}<ParcelSelect parcels={parcels} value={selected} onChange={choose} /></label>
        {loading && <p className="mt-2 text-xs text-muted">{t('Cargando…', 'Loading…')}</p>}
        <form className="mt-5 space-y-4" onSubmit={save}>
          <label className="field">{t('Nombre', 'Name')}<input required value={name} onChange={e => setName(e.target.value)} placeholder={t('Mi parcela', 'My parcel')} /></label>
          <CountrySelect value={country} language={language} onChange={chooseCountry} />
          <label className="field">{t('Sector o región', 'Area or region')}<input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('Ej. Chimborazo', 'e.g. Chimborazo')} /></label>
          <p className="text-xs leading-relaxed text-muted">{t('El país se completa al buscar o utilizar tu ubicación, pero puedes corregirlo. Tus coordenadas se usan internamente para NASA; no se muestran aquí.', 'The country is filled in when you search or use your location, but you can change it. Your coordinates are used internally for NASA and are not shown here.')}</p>
          <details className="border-t border-line pt-4"><summary className="cursor-pointer font-semibold">{t('Perfil agronómico (opcional)', 'Agronomic profile (optional)')}</summary>
            <div className="mt-4 space-y-3">
              <label className="field">{t('Cultivo actual', 'Current crop')}<input value={profile.current_crop || ''} placeholder={t('No lo sé', 'I do not know')} onChange={e => setProfile({ ...profile, current_crop: e.target.value })} /></label>
              <label className="field">{t('Textura del suelo', 'Soil texture')}<select value={profile.soil_texture || ''} onChange={e => setProfile({ ...profile, soil_texture: e.target.value })}><option value="">{t('No lo sé', 'I do not know')}</option>{soilTextures.map((texture, index) => <option key={texture} value={texture}>{language === 'en' ? ['Sandy', 'Loamy sand', 'Sandy loam', 'Loam', 'Silt loam', 'Silt', 'Sandy clay loam', 'Clay loam', 'Silty clay loam', 'Sandy clay', 'Silty clay'][index] : texture}</option>)}</select></label>
              <fieldset className="field"><legend>{t('¿Tiene riego?', 'Is irrigation available?')}</legend><div className="flex flex-wrap gap-2">{[['Sí', t('Sí', 'Yes')], ['No', t('No', 'No')], ['', t('No lo sé', 'I do not know')]].map(([value, label]) => <label key={value || 'unknown'} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${profile.irrigation === value ? 'border-leaf bg-mint' : 'border-line bg-white'}`}><input type="radio" name="irrigation" className="!min-h-0 !w-auto accent-leaf" value={value} checked={(profile.irrigation || '') === value} onChange={() => setProfile({ ...profile, irrigation: value })} /> {label}</label>)}</div></fieldset>
              <label className="field">{t('Observaciones', 'Notes')}<input value={profile.notes || ''} placeholder={t('Condiciones conocidas del terreno', 'Known land conditions')} onChange={e => setProfile({ ...profile, notes: e.target.value })} /></label>
            </div>
          </details>
          <button className="button button-dark w-full" title={t('Valida y guarda este polígono y perfil en tu cuenta.', 'Validate and save this polygon and profile to your account.')}><Save size={17} /> {t('Guardar parcela', 'Save parcel')}</button>
          {selected && <button type="button" className="button button-outline w-full" title={t('Elimina permanentemente la parcela seleccionada y su historial; solicitará confirmación.', 'Permanently delete the selected parcel and its history; confirmation will be requested.')} onClick={remove}><Trash2 size={16} /> {t('Eliminar parcela', 'Delete parcel')}</button>}
        </form>
        {notice && <p role="status" className="notice mt-4">{notice}</p>}
      </div>
    </div>
  </div>
}
