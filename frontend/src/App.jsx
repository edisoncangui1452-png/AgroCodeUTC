import { createContext, useContext, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { ArrowRight, ChartNoAxesCombined, ChevronRight, CloudSun, Database, FlaskConical, Globe2, Leaf, LogOut, MapPinned, Menu, ShieldCheck, Sprout } from 'lucide-react'
import { api } from './api'
import { AuthPages, ProfilePage } from './pages/Auth'
import { Dashboard, ParcelsPage, ClimatePage, AgriculturePage, SimulatorPage, HistoryPage } from './pages/Workspace'
import HelpAssistant from './components/HelpAssistant'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)
const menu = [
  { to: '/panel', label: 'Resumen', icon: ChartNoAxesCombined },
  { to: '/parcelas', label: 'Mis parcelas', icon: MapPinned },
  { to: '/clima', label: 'Historial climático', icon: CloudSun },
  { to: '/agricultura', label: 'Cultivos y rotaciones', icon: Sprout },
  { to: '/simulador', label: 'Simulador agrícola', icon: FlaskConical },
  { to: '/historial', label: 'Mi historial', icon: Database },
]

function Logo({ light = false }) {
  return <Link to="/" className={`logo ${light ? 'text-white' : 'text-ink'}`} aria-label="AgrocodeUTC, ir al inicio"><span className={`logo-mark ${light ? 'bg-white text-ink' : 'bg-ink text-white'}`}><Sprout size={19} strokeWidth={2.3} aria-hidden="true" /></span><span>AgrocodeUTC<span className="ml-1 align-top text-[8px] font-bold tracking-widest">/ NASA</span></span></Link>
}

function Landing() {
  const { user } = useAuth()
  return <div className="min-h-screen bg-paper">
    <header className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-6 sm:px-5 md:px-10"><div className="brand-preferences"><Logo /><PreferenceControls /></div><nav className="hidden items-center gap-8 text-sm font-semibold md:flex"><a href="#como-funciona">Cómo funciona</a><a href="#tecnologia">Tecnología</a><Link to="/ingresar">Iniciar sesión</Link></nav><Link to={user ? '/panel' : '/registro'} className="button button-dark text-sm landing-start" aria-label="Empezar"><span>Empezar</span> <ArrowRight size={15} /></Link></header>
    <main>
      <section className="relative mx-auto grid max-w-7xl gap-12 overflow-hidden px-5 pb-20 pt-16 md:grid-cols-[1.05fr_.95fr] md:items-center md:px-10 md:pb-32 md:pt-24">
        <div className="relative z-10"><div className="eyebrow"><span className="h-2 w-2 rounded-full bg-ink" /> INTELIGENCIA PARA EL CAMPO</div><h1 className="mt-7 max-w-[730px] font-display text-[clamp(3.5rem,7vw,6.7rem)] font-bold leading-[1.03] tracking-[-.075em]">El futuro del campo empieza con <em className="font-normal">datos.</em></h1><p className="mt-8 max-w-lg text-lg leading-relaxed text-muted">Cultiva mejores decisiones con datos de la NASA. Explora el clima de tu terreno, compara temporadas y descubre nuevas posibilidades para tus cultivos.</p><div className="mt-10 flex flex-wrap gap-3"><Link to={user ? '/panel' : '/registro'} className="button button-dark">Analizar mi terreno <ArrowRight size={18} /></Link><a href="#como-funciona" className="button button-outline">Descubrir cómo funciona</a></div><div className="mt-14 flex items-center gap-3 border-t border-line pt-6 text-xs text-muted"><Globe2 size={18} /> Datos climáticos globales · Recomendaciones transparentes · Sin promesas mágicas</div></div>
        <div className="hero-visual" aria-label="Ilustración abstracta de parcelas agrícolas y datos"><div className="hero-grid" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="absolute left-[9%] top-[15%] rounded-2xl border border-white/25 bg-white/90 p-4 text-ink shadow-xl backdrop-blur"><div className="text-[10px] font-bold uppercase tracking-widest text-muted">Tu parcela</div><div className="mt-2 flex items-center gap-2 text-xl font-bold"><MapPinned size={20} /> Conoce tu tierra</div></div><div className="absolute bottom-[12%] right-[6%] rounded-2xl border border-white/25 bg-white/90 p-4 text-ink shadow-xl backdrop-blur"><div className="text-[10px] font-bold uppercase tracking-widest text-muted">Clima histórico</div><div className="mt-2 flex h-12 items-end gap-1.5">{[18, 29, 22, 38, 31, 42, 33, 47, 35].map((h, i) => <span key={i} className="w-3 rounded-t-sm bg-ink" style={{ height: h }} />)}</div></div><div className="hero-center"><Leaf size={85} strokeWidth={1} /></div></div>
      </section>
      <section id="como-funciona" className="border-t border-line bg-white px-5 py-24 md:px-10"><div className="mx-auto max-w-7xl"><div className="eyebrow">01 / SIMPLE Y CLARO</div><div className="mt-5 flex flex-wrap items-end justify-between gap-5"><h2 className="section-title">De la tierra a la <em>decisión.</em></h2><p className="max-w-sm text-muted">Una forma más clara de mirar atrás para planificar lo que viene.</p></div><div className="mt-14 grid gap-4 md:grid-cols-3">{[{ n: '01', icon: MapPinned, title: 'Ubica tu terreno', text: 'Dibuja tu parcela en el mapa y registra lo que sabes de tu suelo y cultivos.' }, { n: '02', icon: CloudSun, title: 'Entiende el clima', text: 'Compara los últimos tres años de temperatura, lluvia y otras variables de NASA POWER.' }, { n: '03', icon: Sprout, title: 'Explora opciones', text: 'Consulta cultivos documentados para la región y compara rotaciones con criterios claros.' }].map(({ n, icon: Icon, title, text }) => <div className="feature-card" key={n}><div className="flex items-start justify-between"><Icon size={30} strokeWidth={1.4} /><span className="text-sm text-muted">{n}</span></div><h3 className="mt-16 font-display text-2xl font-bold">{title}</h3><p className="mt-3 leading-relaxed text-muted">{text}</p></div>)}</div></div></section>
      <section id="tecnologia" className="bg-ink px-5 py-24 text-white md:px-10"><div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 md:items-center"><div><div className="eyebrow border-white/20 text-white/70">02 / CIENCIA ABIERTA</div><h2 className="section-title mt-7">Información real.<br /><em>Decisiones humanas.</em></h2></div><div className="space-y-6 text-white/70"><p className="text-lg leading-relaxed">Usamos NASA POWER para datos climáticos históricos y, cuando corresponde, NASA GIBS para explorar imágenes satelitales. Los datos son regionales: no sustituyen mediciones en tu parcela.</p><div className="flex gap-3 border-t border-white/20 pt-6 text-sm"><ShieldCheck className="shrink-0" size={22} /><span>Las recomendaciones se basan únicamente en fichas regionales documentadas. Si faltan datos, te lo decimos.</span></div><Link to={user ? '/panel' : '/registro'} className="inline-flex items-center gap-2 font-bold text-white">Comenzar ahora <ArrowRight size={18} /></Link></div></div></section>
    </main><footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-10 text-sm text-muted md:px-10"><Logo /><span>AgrocodeUTC · Datos para cultivar mejores decisiones.</span></footer>
  </div>
}

function Workspace() {
  const { user, setUser } = useAuth()
  const { language } = usePreferences()
  const [mobile, setMobile] = useState(false)
  const navigate = useNavigate()
  async function exit() { await api.post('auth/logout/'); setUser(null); navigate('/') }
  return <div className="min-h-screen bg-paper"><header className="sticky top-0 z-[1001] flex h-20 items-center justify-between border-b border-line bg-white/95 px-5 backdrop-blur md:px-9"><div className="flex items-center gap-5"><button className="md:hidden" onClick={() => setMobile(!mobile)} aria-label="Abrir menú" title="Mostrar navegación"><Menu /></button><Logo /></div><div className="flex items-center gap-4"><span className="hidden text-sm text-muted sm:block">Hola, {user.first_name || 'agricultor'}</span><Link to="/perfil" className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-bold text-white" title="Abrir mi perfil">{(user.first_name || 'A')[0].toUpperCase()}</Link></div></header><div className="mx-auto flex max-w-[1600px]"><aside className={`${mobile ? 'block' : 'hidden'} fixed inset-y-20 left-0 z-[1000] w-64 border-r border-line bg-white p-5 md:sticky md:top-20 md:block md:h-[calc(100vh-80px)] md:w-64 md:shrink-0 md:overflow-y-auto`}><div className="mb-5 px-3 pt-3 text-[10px] font-bold uppercase tracking-[.2em] text-muted">Área de trabajo</div><nav className="space-y-1">{menu.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobile(false)} className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}><Icon size={18} /> {label} <ChevronRight className="ml-auto opacity-40" size={14} /></NavLink>)}</nav><div className="mt-10 border-t border-line pt-4"><NavLink to="/perfil" className="nav-item" onClick={() => setMobile(false)}>Mi perfil</NavLink><button onClick={exit} className="nav-item w-full" title="Cerrar la sesión en este navegador"><LogOut size={18} /> Cerrar sesión</button></div><div className="mt-12 rounded-xl bg-paper p-4 text-xs leading-relaxed text-muted">Los análisis son orientativos. Antes de tomar decisiones agrícolas, consulta con un profesional local.</div></aside><main className="min-w-0 flex-1 px-5 pb-20 pt-10 md:px-10 md:pt-12"><Routes><Route path="/panel" element={<Dashboard />} /><Route path="/parcelas" element={<ParcelsPage />} /><Route path="/clima" element={<ClimatePage />} /><Route path="/agricultura" element={<AgriculturePage />} /><Route path="/simulador" element={<SimulatorPage />} /><Route path="/historial" element={<HistoryPage />} /><Route path="/perfil" element={<ProfilePage />} /><Route path="*" element={<Navigate to="/panel" />} /></Routes></main></div><HelpAssistant /></div>
}

function AppRoutes() {
  const [user, setUser] = useState(undefined)
  useEffect(() => { api.get('auth/me/').then(({ data }) => setUser(data)).catch(() => setUser(null)) }, [])
  if (user === undefined) return <div className="flex min-h-screen items-center justify-center bg-paper text-muted">Cargando AgrocodeUTC…</div>
  return <AuthContext.Provider value={{ user, setUser }}><Routes><Route path="/" element={<Landing />} /><Route path="/ingresar" element={<AuthPages mode="login" />} /><Route path="/registro" element={<AuthPages mode="register" />} /><Route path="/recuperar" element={<AuthPages mode="recover" />} /><Route path="/restablecer/:uid/:token" element={<AuthPages mode="reset" />} /><Route path="/*" element={user ? <Workspace /> : <Navigate to="/ingresar" replace />} /></Routes></AuthContext.Provider>
}

export default function App() {
  return <PreferencesProvider><AppRoutes /></PreferencesProvider>
}
