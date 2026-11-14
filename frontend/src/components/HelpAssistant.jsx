import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleHelp, MessageCircle, Send, UserRound, X } from 'lucide-react'
import { api } from '../api'
import { answerHelp, helpTopics } from './helpKnowledge'

export default function HelpAssistant() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('guide')
  const [people, setPeople] = useState([])
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([{ role: 'assistant', text: '¡Hola! Soy la guía de AgroFísica. Pregúntame cómo usar mapas, parcelas, clima, cultivos o tu historial.' }])
  const endRef = useRef(null)
  useEffect(() => {
    if (open && tab === 'people') api.get('agronomists/').then(({ data }) => setPeople(data.results || data)).catch(() => {})
  }, [open, tab])
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'nearest' }) }, [open, messages])
  useEffect(() => {
    const close = event => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])
  function ask(text) {
    const question = text.trim().slice(0, 300)
    if (!question) return
    const answer = answerHelp(question)
    setMessages(current => [...current, { role: 'user', text: question }, { role: 'assistant', text: answer.answer, path: answer.path }])
    setDraft('')
  }
  return <div className="fixed bottom-5 right-5 z-[1200]">
    {open && <section role="dialog" aria-label="Ayuda de AgroFísica" className="absolute bottom-16 right-0 flex h-[min(560px,75vh)] w-[min(370px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-ink p-4 text-white"><div><h3 className="font-display font-bold">Ayuda AgroFísica</h3><p className="text-xs text-white/75">Guía local de uso · sin envío de preguntas</p></div><button onClick={() => setOpen(false)} title="Cerrar ayuda" aria-label="Cerrar ayuda"><X size={19} /></button></div>
      <div className="flex border-b border-line text-sm font-semibold"><button className={`flex flex-1 items-center justify-center gap-2 p-3 ${tab === 'guide' ? 'border-b-2 border-leaf text-leaf' : 'text-muted'}`} onClick={() => setTab('guide')}><MessageCircle size={16} /> Guía</button><button className={`flex flex-1 items-center justify-center gap-2 p-3 ${tab === 'people' ? 'border-b-2 border-leaf text-leaf' : 'text-muted'}`} onClick={() => setTab('people')}><UserRound size={16} /> Profesionales</button></div>
      {tab === 'guide' ? <>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">{messages.map((message, i) => <div key={i} className={`max-w-[92%] rounded-xl p-3 ${message.role === 'user' ? 'ml-auto bg-leaf text-white' : 'bg-paper'}`}>{message.text}{message.path && <Link to={message.path} onClick={() => setOpen(false)} className="mt-2 block font-semibold underline">Ir a esa sección →</Link>}</div>)}<div ref={endRef} /></div>
        {messages.length <= 1 && <div className="flex gap-2 overflow-x-auto border-t border-line px-3 py-2">{helpTopics.slice(0, 4).map(topic => <button key={topic.question} className="shrink-0 rounded-full bg-mint px-3 py-1 text-xs" onClick={() => ask(topic.question)}>{topic.question}</button>)}</div>}
        <form className="flex gap-2 border-t border-line p-3" onSubmit={event => { event.preventDefault(); ask(draft) }}><input className="input !min-h-0 flex-1" value={draft} maxLength={300} onChange={event => setDraft(event.target.value)} placeholder="Escribe tu duda sobre la app…" aria-label="Pregunta para la guía" /><button className="button button-dark !min-h-0 !px-3" title="Enviar pregunta a la guía local" aria-label="Enviar pregunta"><Send size={17} /></button></form>
      </> : <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm"><p className="text-muted">Ningún dato de tu parcela se comparte automáticamente. Contacta directamente a un profesional publicado.</p>{people.length ? people.map(person => <div key={person.id} className="mt-4 border-t border-line pt-3"><strong>{person.name}</strong><div>{person.specialty} · {person.country}</div><div className="text-muted">{person.credentials}</div>{person.email && <a className="text-leaf underline" href={`mailto:${person.email}`}>{person.email}</a>}</div>) : <p className="mt-5 text-muted">Aún no hay profesionales verificados publicados.</p>}</div>}
      <p className="border-t border-line px-4 py-2 text-[10px] text-muted">La guía responde preguntas frecuentes; no es una IA generativa ni ofrece asesoría agronómica.</p>
    </section>}
    <button className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-xl" aria-label={open ? 'Cerrar ayuda' : 'Abrir ayuda'} title="Abre la guía de uso y contactos profesionales" onClick={() => setOpen(!open)}>{open ? <X /> : <CircleHelp />}</button>
  </div>
}
