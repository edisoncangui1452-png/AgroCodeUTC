import { useCallback, useState } from 'react'
import { Download, MapPin, Save, Search, Trash2, Upload } from 'lucide-react'
import { api, errorMessage } from '../api'
import ParcelMap from '../components/ParcelMap'
import { countryNames, countryOptions, countryOptionsEn, Heading, ParcelSelect, soilTextures, useParcels } from './shared'
import { useLanguage } from '../i18n'

const emptyProfile = { soil_texture: '', irrigation: '', current_crop: '', notes: '' }

export function ParcelsPage() {
  const { t, language } = useLanguage()
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
      if (!results.length) throw new Error('No se encontró la ubicación.')
      focusResult(results[0])
      setNotice('Mapa enfocado en la zona. La búsqueda se compartió con OpenStreetMap Nominatim.')
    } catch (err) { setNotice(err.response ? errorMessage(err) : err.message) }
  }
  async function chooseCountry(code) {
    setCountry(code); setNotice('')
    if (code) await find(countryNames[code])
  }
  function locate() {
    if (!navigator.geolocation) { setNotice('Este navegador no admite geolocalización. Usa la búsqueda.'); return }
    navigator.geolocation.getCurrentPosition(async pos => {
      const center = [pos.coords.latitude, pos.coords.longitude]
      setPoint(center); setSearchMarker(center); setFocus({ center, zoom: 15 })
      try {
        const { data } = await api.get('geocode/reverse/', { params: { lat: center[0], lon: center[1] } })
        if (data.country_code && countryNames[data.country_code]) setCountry(data.country_code)
        if (data.region) setLocation(data.region)
        setNotice('Ubicación recibida. El país se obtuvo mediante OpenStreetMap Nominatim.')
      } catch { setNotice('Ubicación recibida; selecciona el país manualmente.') }
    }, () => setNotice('No se pudo obtener tu ubicación. Usa la búsqueda o el mapa.'))
  }
  async function save(e) {
    e.preventDefault(); setNotice('')
    try {
      if (!geometry) throw new Error('Dibuja o importa un polígono primero.')
      const payload = { name, country, location, geometry }
      const { data } = selected ? await api.patch(`parcels/${selected}/`, payload) : await api.post('parcels/', payload)
      await api.put(`parcels/${data.id}/profile/`, {
        current_crop: profile.current_crop || '', soil_texture: profile.soil_texture || '',
        irrigation: profile.irrigation || '', notes: profile.notes || '',
      })
      await reload(); setSelected(String(data.id)); setNotice('Parcela guardada correctamente.')
    } catch (err) { setNotice(err.response ? errorMessage(err) : err.message) }
  }
  async function remove() {
    if (!selected || !window.confirm(t('¿Eliminar esta parcela y todos sus registros? Esta acción no se puede deshacer.'))) return
    try { await api.delete(`parcels/${selected}/`); await reload(); choose(''); setNotice('Parcela eliminada.') }
    catch (err) { setNotice(errorMessage(err)) }
  }
  function importFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100000) { setNotice('GeoJSON demasiado grande.'); return }
    file.text().then(text => {
      try {
        const json = JSON.parse(text)
        const polygon = json.type === 'FeatureCollection' ? json.features?.[0]?.geometry : json.type === 'Feature' ? json.geometry : json
        if (polygon?.type !== 'Polygon') throw new Error('Importa un polígono GeoJSON.')
        setGeometry(polygon); setFocus(null); setNotice('Polígono importado. Confirma el país y guarda para validarlo.')
      } catch (err) { setNotice(err.message) }
    })
  }
  function exportFile() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ type: 'Feature', properties: { name }, geometry }, null, 2)], { type: 'application/geo+json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'parcela.geojson'; link.click(); URL.revokeObjectURL(url)
  }

  return <div>
    <Heading eyebrow={t('01 / TU TERRENO')} title={t('Mis parcelas')} description={t('Enfoca el mapa en un país o localidad, dibuja tu terreno y guarda su información. La superficie se calcula en el servidor.')} />
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap gap-2">
          <input className="input min-w-0 flex-1" aria-label={t('Buscar localidad o sector')} placeholder={t('Buscar sector, ciudad o país…')} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && find()} />
          <button className="button button-outline" title={t('Busca un país, ciudad o sector; el mapa se centrará y colocará una chincheta.')} onClick={() => find()}><Search size={17} /> {t('Buscar')}</button>
          <button className="button button-outline" title={t('Solicita tu ubicación para centrar el mapa; requiere permiso del navegador.')} onClick={locate}><MapPin size={17} /> {t('Ubicarme')}</button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="h-[490px]"><ParcelMap geometry={geometry} onChange={onGeometry} point={point} onPoint={onPoint} focus={focus} searchMarker={searchMarker} satellite={satellite} date={date} /></div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line p-4 text-xs">
            <label className="flex items-center gap-2" title={t('Muestra u oculta la capa visual MODIS Terra de NASA; no aporta mediciones del terreno.')}><input type="checkbox" checked={satellite} onChange={e => setSatellite(e.target.checked)} /> NASA GIBS (MODIS Terra)</label>
            {satellite && <label>{t('Fecha')} <input className="input ml-2 !w-auto !py-1" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>}
            <span className="ml-auto text-muted">{t('Imágenes satelitales, no mediciones de parcela.')}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <label className="button button-outline cursor-pointer" title={t('Abre un archivo .geojson o .json con un polígono para editarlo y guardarlo como parcela.')}><Upload size={16} /> {t('Importar GeoJSON')}<input className="hidden" type="file" accept=".json,.geojson,application/geo+json" onChange={importFile} /></label>
          <button className="button button-outline" title={t('Descarga el polígono actual como archivo parcela.geojson; no borra ni comparte datos.')} disabled={!geometry} onClick={exportFile}><Download size={16} /> {t('Exportar')}</button>
          <div className="w-full text-xs leading-relaxed text-muted"><strong>{t('Importar:')}</strong> {t('abre un archivo GeoJSON (.geojson o .json) que contenga un polígono; revisa país y guarda para conservarlo.')} <strong>{t('Exportar:')}</strong> {t('descarga el polígono actual como parcela.geojson para reutilizarlo en otra herramienta.')}</div>
        </div>
      </div>
      <div className="panel h-fit"><h2 className="text-xl font-bold">{t('Datos de parcela')}</h2>
        <label className="field mt-5">{t('Parcela guardada')}<ParcelSelect parcels={parcels} value={selected} onChange={choose} /></label>
        {loading && <p className="mt-2 text-xs text-muted">{t('Cargando…')}</p>}
        <form className="mt-5 space-y-4" onSubmit={save}>
          <label className="field">{t('Nombre')}<input required value={name} onChange={e => setName(e.target.value)} placeholder={t('Mi parcela')} /></label>
          <label className="field">{t('País')}<select required value={country} onChange={e => chooseCountry(e.target.value)}><option value="">{t('Selecciona un país')}</option>{(language === 'en' ? countryOptionsEn : countryOptions).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
          <label className="field">{t('Sector o región')}<input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('Ej. Chimborazo')} /></label>
          <p className="text-xs leading-relaxed text-muted">{t('El país se completa al buscar o utilizar tu ubicación, pero puedes corregirlo. Tus coordenadas se usan internamente para NASA; no se muestran aquí.')}</p>
          <details className="border-t border-line pt-4"><summary className="cursor-pointer font-semibold">{t('Perfil agronómico (opcional)')}</summary>
            <div className="mt-4 space-y-3">
              <label className="field">{t('Cultivo actual')}<input value={profile.current_crop || ''} placeholder={t('No lo sé')} onChange={e => setProfile({ ...profile, current_crop: e.target.value })} /></label>
              <label className="field">{t('Textura del suelo')}<select value={profile.soil_texture || ''} onChange={e => setProfile({ ...profile, soil_texture: e.target.value })}><option value="">{t('No lo sé')}</option>{soilTextures.map(texture => <option key={texture} value={texture}>{t(texture)}</option>)}</select></label>
              <fieldset className="field"><legend>{t('¿Tiene riego?')}</legend><div className="flex flex-wrap gap-2">{[['Sí', 'Sí'], ['No', 'No'], ['', 'No lo sé']].map(([value, label]) => <label key={label} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${profile.irrigation === value ? 'border-leaf bg-mint' : 'border-line bg-white'}`}><input type="radio" name="irrigation" className="!min-h-0 !w-auto accent-leaf" value={value} checked={(profile.irrigation || '') === value} onChange={() => setProfile({ ...profile, irrigation: value })} /> {t(label)}</label>)}</div></fieldset>
              <label className="field">{t('Observaciones')}<input value={profile.notes || ''} placeholder={t('Condiciones conocidas del terreno')} onChange={e => setProfile({ ...profile, notes: e.target.value })} /></label>
            </div>
          </details>
          <button className="button button-dark w-full" title={t('Valida y guarda este polígono y perfil en tu cuenta.')}><Save size={17} /> {t('Guardar parcela')}</button>
          {selected && <button type="button" className="button button-outline w-full" title={t('Elimina permanentemente la parcela seleccionada y su historial; solicitará confirmación.')} onClick={remove}><Trash2 size={16} /> {t('Eliminar parcela')}</button>}
        </form>
        {notice && <p role="status" className="notice mt-4">{t(notice)}</p>}
      </div>
    </div>
  </div>
}
