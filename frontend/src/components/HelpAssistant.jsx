import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleHelp, MessageCircle, Send, UserRound, X } from 'lucide-react'
import { api } from '../api'
import { answerHelp, helpTopics } from './helpKnowledge'
import { translated, usePreferences } from '../preferences'

export default function HelpAssistant() {
  const { language } = usePreferences()
  const t = (es, en) => translated(language, es, en)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('guide')
  const [people, setPeople] = useState([])
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const endRef = useRef(null)
  useEffect(() => {
    if (open && tab === 'people') api.get('agronomists/').then(({ data }) => setPeople(data.results || data)).catch(() => {})
  }, [open, tab])
  useEffect(() => {
    setMessages([{ role: 'assistant', text: t('¡Hola! Soy la guía de AgrocodeUTC. Pregúntame cómo usar mapas, parcelas, clima, cultivos o tu historial.', 'Hi! I’m the AgrocodeUTC guide. Ask me how to use maps, parcels, climate, crops, or your history.') }])
    setDraft('')
  }, [language])
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'nearest' }) }, [open, messages])
  useEffect(() => {
    const close = event => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])
  function ask(text) {
    const question = text.trim().slice(0, 300)
    if (!question) return
    const answer = answerHelp(question, language)
    setMessages(current => [...current, { role: 'user', text: question }, { role: 'assistant', text: answer.answer, path: answer.path }])
    setDraft('')
  }
  return <div className="fixed bottom-5 right-5 z-[1200]">
    {open && <section role="dialog" aria-label={t('Ayuda de AgrocodeUTC', 'AgrocodeUTC help')} className="absolute bottom-16 right-0 flex h-[min(560px,75vh)] w-[min(370px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-ink p-4 text-white"><div><h3 className="font-display font-bold">{t('Ayuda AgrocodeUTC', 'AgrocodeUTC help')}</h3><p className="text-xs text-white/75">{t('Guía local de uso · sin envío de preguntas', 'Local user guide · questions are not sent externally')}</p></div><button onClick={() => setOpen(false)} title={t('Cerrar ayuda', 'Close help')} aria-label={t('Cerrar ayuda', 'Close help')}><X size={19} /></button></div>
      <div className="flex border-b border-line text-sm font-semibold"><button className={`flex flex-1 items-center justify-center gap-2 p-3 ${tab === 'guide' ? 'border-b-2 border-leaf text-leaf' : 'text-muted'}`} onClick={() => setTab('guide')}><MessageCircle size={16} /> {t('Guía', 'Guide')}</button><button className={`flex flex-1 items-center justify-center gap-2 p-3 ${tab === 'people' ? 'border-b-2 border-leaf text-leaf' : 'text-muted'}`} onClick={() => setTab('people')}><UserRound size={16} /> {t('Profesionales', 'Professionals')}</button></div>
      {tab === 'guide' ? <>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">{messages.map((message, i) => <div key={i} className={`max-w-[92%] rounded-xl p-3 ${message.role === 'user' ? 'ml-auto bg-leaf text-white' : 'bg-paper'}`}>{message.text}{message.path && <Link to={message.path} onClick={() => setOpen(false)} className="mt-2 block font-semibold underline">{t('Ir a esa sección', 'Go to that section')} →</Link>}</div>)}<div ref={endRef} /></div>
        {messages.length <= 1 && <div className="flex gap-2 overflow-x-auto border-t border-line px-3 py-2">{helpTopics.slice(0, 4).map(topic => <button key={topic.question} className="shrink-0 rounded-full bg-mint px-3 py-1 text-xs" onClick={() => ask(topic.question)}>{language === 'en' ? topic.question_en : topic.question}</button>)}</div>}
        <form className="flex gap-2 border-t border-line p-3" onSubmit={event => { event.preventDefault(); ask(draft) }}><input className="input !min-h-0 flex-1" value={draft} maxLength={300} onChange={event => setDraft(event.target.value)} placeholder={t('Escribe tu duda sobre la app…', 'Ask a question about the app…')} aria-label={t('Pregunta para la guía', 'Question for the guide')} /><button className="button button-dark !min-h-0 !px-3" title={t('Enviar pregunta a la guía local', 'Send question to the local guide')} aria-label={t('Enviar pregunta', 'Send question')}><Send size={17} /></button></form>
      </> : <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm"><p className="text-muted">{t('Ningún dato de tu parcela se comparte automáticamente. Contacta directamente a un profesional publicado.', 'No parcel data is shared automatically. Contact a listed professional directly.')}</p>{people.length ? people.map(person => <div key={person.id} className="mt-4 border-t border-line pt-3"><strong>{person.name}</strong><div>{person.specialty} · {person.country}</div><div className="text-muted">{person.credentials}</div>{person.email && <a className="text-leaf underline" href={`mailto:${person.email}`}>{person.email}</a>}</div>) : <p className="mt-5 text-muted">{t('Aún no hay profesionales verificados publicados.', 'No verified professionals have been listed yet.')}</p>}</div>}
      <p className="border-t border-line px-4 py-2 text-[10px] text-muted">{t('La guía responde preguntas frecuentes; no es una IA generativa ni ofrece asesoría agronómica.', 'The guide answers common questions; it is not generative AI and does not provide agronomic advice.')}</p>
    </section>}
    <button className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-xl" aria-label={open ? t('Cerrar ayuda', 'Close help') : t('Abrir ayuda', 'Open help')} title={t('Abre la guía de uso y contactos profesionales', 'Open the user guide and professional contacts')} onClick={() => setOpen(!open)}>{open ? <X /> : <CircleHelp />}</button>
  </div>
}
