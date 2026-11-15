import { useEffect, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { usePreferences, translated } from '../preferences'

const variableNames = {
  T2M: ['Temperatura media', 'Mean temperature'],
  T2M_MAX: ['Temperatura máxima', 'Maximum temperature'],
  T2M_MIN: ['Temperatura mínima', 'Minimum temperature'],
  PRECTOTCORR: ['Lluvia', 'Rain'],
  RH2M: ['Humedad', 'Humidity'],
  ALLSKY_SFC_SW_DWN: ['Radiación solar', 'Solar radiation'],
  WS2M: ['Velocidad del viento', 'Wind speed'],
}

export function toggleAssistant(open) {
  return !open
}

export function shouldCloseAssistant(key) {
  return key === 'Escape'
}

export function answerClimateQuestion(question, parcel, result, language = 'es') {
  const english = language === 'en'
  const insufficient = translated(language,
    'No tengo suficiente información en tu ficha para responder eso.',
    "I don't have enough information in your report to answer that.")
  const text = question.trim().toLocaleLowerCase()
  if (!result || !parcel || !text) return insufficient

  if (/cobertura|faltan|sin dato|dato|coverage|missing|days/.test(text)) {
    const stats = Object.entries(result.coverage || {}).map(([key, item]) => {
      const name = variableNames[key]?.[english ? 1 : 0] || key
      const ranges = (item.missing_ranges || []).map(range => range.start === range.end ? range.start : `${range.start}–${range.end}`)
      const missing = ranges.length ? ` ${english ? 'Missing dates' : 'Fechas sin dato'}: ${ranges.join(', ')}.` : ''
      return `${name}: ${item.valid_days}/${item.total_days} ${english ? 'days' : 'días'} (${item.coverage_percent}%).${missing}`
    })
    return stats.length ? `${english ? 'Coverage for the selected period:' : 'Cobertura del periodo seleccionado:'} ${stats.join(' ')}` : insufficient
  }

  if (/variable|mide|parámetro|parameter|variables/.test(text)) {
    const available = Object.entries(result.coverage || {}).filter(([, item]) => item.valid_days > 0).map(([key]) => variableNames[key]?.[english ? 1 : 0] || key)
    return available.length
      ? `${english ? 'Variables with data in the report:' : 'Variables con datos en la ficha:'} ${available.join(', ')}.`
      : insufficient
  }

  if (/periodo|período|fecha|año|period|date|year/.test(text)) {
    const period = result.period || { start: `${result.years?.[0]}-01-01`, end: `${result.years?.[1]}-12-31` }
    return `${english ? 'The report period is' : 'El periodo de la ficha es'} ${period.start} ${english ? 'to' : 'a'} ${period.end}.`
  }

  if (/fuente|nasa|source/.test(text)) {
    return english
      ? 'The report uses NASA POWER daily data for the representative point. These are regional estimates, not measurements from the parcel.'
      : 'La ficha usa datos diarios de NASA POWER para el punto representativo. Son estimaciones regionales, no mediciones de la parcela.'
  }

  if (/parcela|ubicaci|location|parcel/.test(text)) {
    const place = [parcel.location, parcel.country].filter(Boolean).join(' · ')
    return `${english ? 'The selected report is for' : 'La ficha seleccionada corresponde a'} ${parcel.name}${place ? ` (${place})` : ''}.`
  }

  return insufficient
}

export default function ClimateAssistant({ parcel, result }) {
  const { language } = usePreferences()
  const english = language === 'en'
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => { if (shouldCloseAssistant(event.key)) setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => { setMessages([]); setQuestion('') }, [parcel?.id, result?.fetched_at])

  function submit(event) {
    event.preventDefault()
    const asked = question.trim()
    if (!asked) return
    setMessages(current => [...current, { question: asked }])
    setQuestion('')
  }

  return <div className="climate-assistant no-print">
    <p className="assistant-notice">{translated(language, 'No sustituye asesoría agronómica. Solo resume la información de tu ficha.', 'Does not replace agronomic advice. It only summarizes information in your report.')}</p>
    <button type="button" className="button button-dark assistant-toggle" aria-expanded={open} aria-controls="climate-assistant-panel" onClick={() => setOpen(toggleAssistant)}>
      {open ? <X size={18} aria-hidden="true" /> : <MessageCircle size={18} aria-hidden="true" />}
      {open ? translated(language, 'Cerrar asistente', 'Close assistant') : translated(language, 'Asistente', 'Assistant')}
    </button>
    <section id="climate-assistant-panel" className={`assistant-panel ${open ? 'assistant-panel-open' : ''}`} aria-label={translated(language, 'Panel del asistente', 'Assistant panel')} aria-hidden={!open}>
      <div className="flex items-center justify-between border-b border-line pb-3">
        <h2 className="font-bold">{translated(language, 'Asistente de la ficha', 'Report assistant')}</h2>
        <button type="button" className="icon-button" aria-label={translated(language, 'Cerrar asistente', 'Close assistant')} onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button>
      </div>
      <p className="mt-3 rounded-lg bg-paper p-3 text-sm">{translated(language, 'No sustituye asesoría agronómica. Solo resume la información de tu ficha.', 'Does not replace agronomic advice. It only summarizes information in your report.')}</p>
      <div className="assistant-messages" aria-live="polite">
        {!messages.length && <p className="text-sm text-muted">{translated(language, 'Pregunta por el periodo, las variables o la cobertura de esta ficha.', 'Ask about the period, variables, or coverage in this report.')}</p>}
        {messages.map((message, index) => <div className="assistant-message" key={`${index}-${message.question}`}>
          <p><strong>{translated(language, 'Tú:', 'You:')}</strong> {message.question}</p>
          <p className="mt-2">{answerClimateQuestion(message.question, parcel, result, language)}</p>
        </div>)}
      </div>
      <form className="assistant-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="assistant-question">{translated(language, 'Pregunta sobre tu ficha', 'Ask about your report')}</label>
        <input id="assistant-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder={translated(language, 'Escribe una pregunta', 'Type a question')} />
        <button type="submit" className="button button-dark" aria-label={translated(language, 'Enviar pregunta', 'Send question')} disabled={!question.trim()}><Send size={18} aria-hidden="true" /></button>
      </form>
    </section>
  </div>
}
