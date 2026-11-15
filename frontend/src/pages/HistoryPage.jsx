import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Save, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../api'
import { translated, usePreferences } from '../preferences'
import { Heading, ParcelSelect, useParcels } from './shared'

export function HistoryPage() {
  const { language } = usePreferences()
  const t = (es, en) => translated(language, es, en)
  const { parcels } = useParcels()
  const [params, setParams] = useSearchParams()
  const id = params.get('parcela') || ''
  const selectedParcel = parcels.find(parcel => String(parcel.id) === id)
  const [records, setRecords] = useState([])
  const [analyses, setAnalyses] = useState([])
  const [crop, setCrop] = useState('')
  const [planted, setPlanted] = useState('')
  const [harvested, setHarvested] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(null)
  const requestSequence = useRef(0)
  const reload = useCallback(async () => {
    const currentRequest = ++requestSequence.current
    if (!id) { setRecords([]); setAnalyses([]); return }
    const [historyResponse, analysisResponse] = await Promise.all([
      api.get('history/', { params: { parcel: id } }),
      api.get('analyses/', { params: { parcel: id } }),
    ])
    if (currentRequest === requestSequence.current) {
      setRecords(historyResponse.data.results || historyResponse.data)
      setAnalyses(analysisResponse.data.results || analysisResponse.data)
    }
  }, [id])
  useEffect(() => { reload().catch(err => setMessage(errorMessage(err))) }, [reload])
  function resetForm() { setEditing(null); setCrop(''); setPlanted(''); setHarvested(''); setNotes('') }
  function choose(value) {
    requestSequence.current += 1
    setParams(value ? { parcela: value } : {})
    setRecords([]); setAnalyses([]); resetForm(); setMessage('')
  }
  async function save(e) {
    e.preventDefault()
    try {
      const payload = { parcel: Number(id), crop_name: crop, planted_on: planted, harvested_on: harvested || null, notes }
      if (editing) await api.patch(`history/${editing}/`, payload)
      else await api.post('history/', payload)
      setMessage(editing ? t('Registro actualizado.', 'Record updated.') : t('Cultivo registrado.', 'Crop recorded.'))
      resetForm(); await reload()
    } catch (err) { setMessage(errorMessage(err)) }
  }
  function edit(record) {
    setEditing(record.id); setCrop(record.crop_name); setPlanted(record.planted_on)
    setHarvested(record.harvested_on || ''); setNotes(record.notes || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function remove(recordId) {
    if (!window.confirm(t('¿Eliminar este registro?', 'Delete this record?'))) return
    try { await api.delete(`history/${recordId}/`); await reload() }
    catch (err) { setMessage(errorMessage(err)) }
  }
  return <div>
    <Heading eyebrow={t('04 / TU MEMORIA AGRÍCOLA', '04 / YOUR FARM RECORDS')} title={t('Mi historial', 'My history')} description={t('Cada parcela tiene su propia línea de tiempo y sus análisis guardados.', 'Each parcel has its own timeline and saved analyses.')} />
    <div className="panel mt-8 max-w-lg"><label className="field">{t('Parcela de este historial', 'Parcel for this history')}<ParcelSelect parcels={parcels} value={id} onChange={choose} /></label></div>
    {!selectedParcel ? <p className="notice mt-5">{t('Selecciona una parcela para ver o registrar su historial.', 'Select a parcel to view or add to its history.')}</p> : <>
      <div className="mt-5 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <form className="panel h-fit space-y-4" onSubmit={save}>
          <h2 className="text-xl font-bold">{editing ? t('Editar cultivo', 'Edit crop') : `${t('Registrar cultivo', 'Record a crop')} · ${selectedParcel.name}`}</h2>
          <label className="field">{t('Cultivo', 'Crop')}<input required value={crop} onChange={e => setCrop(e.target.value)} placeholder={t('Ej. haba', 'e.g. fava bean')} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">{t('Siembra', 'Planting')}<input required type="date" value={planted} onChange={e => setPlanted(e.target.value)} /></label>
            <label className="field">{t('Cosecha', 'Harvest')}<input type="date" value={harvested} onChange={e => setHarvested(e.target.value)} /></label>
          </div>
          <label className="field">{t('Observaciones', 'Notes')}<textarea rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('Resultados, aprendizajes…', 'Results, lessons learned…')} /></label>
          <button className="button button-dark w-full"><Save size={17} /> {editing ? t('Actualizar registro', 'Update record') : t('Guardar registro', 'Save record')}</button>
          {editing && <button type="button" className="button button-outline w-full" onClick={resetForm}>{t('Cancelar edición', 'Cancel editing')}</button>}
          {message && <p role="status" className="notice">{message}</p>}
        </form>
        <div className="panel"><h2 className="text-xl font-bold">{t('Línea de tiempo', 'Timeline')} · {selectedParcel.name}</h2>
          {records.length ? <div className="mt-5 border-l border-leaf pl-5">{records.map(record => <div className="relative mb-6" key={record.id}>
            <span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-leaf" />
            <div className="flex justify-between gap-3"><strong>{record.crop_name}</strong><div className="flex gap-3"><button className="text-xs text-leaf underline" onClick={() => edit(record)}>{t('Editar', 'Edit')}</button><button title={t('Eliminar', 'Delete')} aria-label={t(`Eliminar ${record.crop_name}`, `Delete ${record.crop_name}`)} onClick={() => remove(record.id)}><Trash2 size={16} /></button></div></div>
            <p className="text-xs text-muted">{t('Siembra', 'Planting')}: {record.planted_on} {record.harvested_on && `· ${t('Cosecha', 'Harvest')}: ${record.harvested_on}`}</p><p className="mt-2 text-sm">{record.notes}</p>
          </div>)}</div> : <p className="mt-6 text-sm text-muted">{t('Esta parcela aún no tiene cultivos registrados.', 'No crops have been recorded for this parcel yet.')}</p>}
        </div>
      </div>
      <div className="panel mt-5"><h2 className="text-xl font-bold">{t('Análisis guardados', 'Saved analyses')} · {selectedParcel.name}</h2>
        {analyses.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{analyses.map(analysis => <details className="rounded-xl border border-line p-4" key={analysis.id}>
          <summary className="cursor-pointer font-semibold">{analysis.title} <span className="block text-xs font-normal text-muted">{new Date(analysis.created_at).toLocaleString(language === 'en' ? 'en' : 'es')} · {analysis.kind}</span></summary>
          <div className="mt-4 text-sm text-muted">{analysis.kind === 'climate' ? `${t('Periodo', 'Period')}: ${analysis.result.years?.join('–')}. ${analysis.result.notice}` : analysis.kind === 'recommendation' ? `${analysis.result.candidates?.map(c => c.crop).join(', ') || t('Sin candidatos', 'No candidates')}. ${analysis.result.notice}` : analysis.result.strategies?.map(s => `${s.name}: ${s.crops.join(' → ')}`).join('; ')}</div>
        </details>)}</div> : <p className="mt-5 text-sm text-muted">{t('Esta parcela aún no tiene análisis guardados.', 'No analyses have been saved for this parcel yet.')}</p>}
      </div>
    </>}
  </div>
}
