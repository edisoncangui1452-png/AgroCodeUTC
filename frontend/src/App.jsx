import { createContext, useContext, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { ArrowRight, ChartNoAxesCombined, ChevronRight, CloudSun, Database, FlaskConical, Globe2, Leaf, LogOut, MapPinned, Menu, ShieldCheck, Sprout } from 'lucide-react'
import { api } from './api'
import { AuthPages, ProfilePage } from './pages/Auth'
import { Dashboard, ParcelsPage, ClimatePage, AgriculturePage, SimulatorPage, HistoryPage } from './pages/Workspace'
import { PreferenceControls, PreferencesProvider, translated, usePreferences } from './preferences'
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
  const { language } = usePreferences()
  const t = (es, en) => translated(language, es, en)
  const features = [
    { n: '01', icon: MapPinned, title: t('Ubica tu terreno', 'Locate your land'), text: t('Dibuja tu parcela en el mapa y registra lo que sabes de tu suelo y cultivos.', 'Draw your parcel on the map and record what you know about its soil and crops.') },
    { n: '02', icon: CloudSun, title: t('Entiende el clima', 'Understand the climate'), text: t('Compara los últimos tres años de temperatura, lluvia y otras variables de NASA POWER.', 'Compare the last three years of temperature, rainfall, and other NASA POWER variables.') },
    { n: '03', icon: Sprout, title: t('Explora opciones', 'Explore your options'), text: t('Consulta cultivos documentados para la región y compara rotaciones con criterios claros.', 'Explore documented regional crops and compare rotations using clear criteria.') },
  ]
  return <div className="min-h-screen bg-paper">
    <header className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-6 sm:px-5 md:px-10"><div className="brand-preferences"><Logo /><PreferenceControls /></div><nav className="hidden items-center gap-8 text-sm font-semibold md:flex"><a href="#como-funciona">{t('Cómo funciona', 'How it works')}</a><a href="#tecnologia">{t('Tecnología', 'Technology')}</a><Link to="/ingresar">{t('Iniciar sesión', 'Sign in')}</Link></nav><Link to={user ? '/panel' : '/registro'} className="button button-dark text-sm landing-start" aria-label={t('Empezar', 'Get started')}><span>{t('Empezar', 'Get started')}</span> <ArrowRight size={15} /></Link></header>
    <main>
      <section className="relative mx-auto grid max-w-7xl gap-12 overflow-hidden px-5 pb-20 pt-16 md:grid-cols-[1.05fr_.95fr] md:items-center md:px-10 md:pb-32 md:pt-24">
        <div className="relative z-10"><div className="eyebrow"><span className="h-2 w-2 rounded-full bg-ink" /> {t('INTELIGENCIA PARA EL CAMPO', 'INTELLIGENCE FOR AGRICULTURE')}</div><h1 className="mt-7 max-w-[730px] font-display text-[clamp(3.5rem,7vw,6.7rem)] font-bold leading-[1.03] tracking-[-.075em]">{t('El futuro del campo empieza con', 'The future of agriculture starts with')} <em className="font-normal">{t('datos.', 'data.')}</em></h1><p className="mt-8 max-w-lg text-lg leading-relaxed text-muted">{t('Cultiva mejores decisiones con datos de la NASA. Explora el clima de tu terreno, compara temporadas y descubre nuevas posibilidades para tus cultivos.', 'Make better decisions with NASA data. Explore your land’s climate, compare seasons, and discover new possibilities for your crops.')}</p><div className="mt-10 flex flex-wrap gap-3"><Link to={user ? '/panel' : '/registro'} className="button button-dark">{t('Analizar mi terreno', 'Analyze my land')} <ArrowRight size={18} /></Link><a href="#como-funciona" className="button button-outline">{t('Descubrir cómo funciona', 'See how it works')}</a></div><div className="mt-14 flex items-center gap-3 border-t border-line pt-6 text-xs text-muted"><Globe2 size={18} /> {t('Datos climáticos globales · Recomendaciones transparentes · Sin promesas mágicas', 'Global climate data · Transparent recommendations · No magic promises')}</div></div>
        <div className="hero-visual" aria-label={t('Ilustración abstracta de parcelas agrícolas y datos', 'Abstract illustration of agricultural parcels and data')}><div className="hero-grid" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="absolute left-[9%] top-[15%] rounded-2xl border border-white/25 bg-white/90 p-4 text-ink shadow-xl backdrop-blur"><div className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('Tu parcela', 'Your parcel')}</div><div className="mt-2 flex items-center gap-2 text-xl font-bold"><MapPinned size={20} /> {t('Conoce tu tierra', 'Get to know your land')}</div></div><div className="absolute bottom-[12%] right-[6%] rounded-2xl border border-white/25 bg-white/90 p-4 text-ink shadow-xl backdrop-blur"><div className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('Clima histórico', 'Historical climate')}</div><div className="mt-2 flex h-12 items-end gap-1.5">{[18, 29, 22, 38, 31, 42, 33, 47, 35].map((h, i) => <span key={i} className="w-3 rounded-t-sm bg-ink" style={{ height: h }} />)}</div></div><div className="hero-center"><Leaf size={85} strokeWidth={1} /></div></div>
      </section>
      <section id="como-funciona" className="border-t border-line bg-white px-5 py-24 md:px-10"><div className="mx-auto max-w-7xl"><div className="eyebrow">{t('01 / SIMPLE Y CLARO', '01 / SIMPLE AND CLEAR')}</div><div className="mt-5 flex flex-wrap items-end justify-between gap-5"><h2 className="section-title">{t('De la tierra a la', 'From the land to the')} <em>{t('decisión.', 'decision.')}</em></h2><p className="max-w-sm text-muted">{t('Una forma más clara de mirar atrás para planificar lo que viene.', 'A clearer way to look back and plan what comes next.')}</p></div><div className="mt-14 grid gap-4 md:grid-cols-3">{features.map(({ n, icon: Icon, title, text }) => <div className="feature-card" key={n}><div className="flex items-start justify-between"><Icon size={30} strokeWidth={1.4} /><span className="text-sm text-muted">{n}</span></div><h3 className="mt-16 font-display text-2xl font-bold">{title}</h3><p className="mt-3 leading-relaxed text-muted">{text}</p></div>)}</div></div></section>
      <section id="tecnologia" className="bg-ink px-5 py-24 text-white md:px-10"><div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 md:items-center"><div><div className="eyebrow border-white/20 text-white/70">{t('02 / CIENCIA ABIERTA', '02 / OPEN SCIENCE')}</div><h2 className="section-title mt-7">{t('Información real.', 'Real information.')}<br /><em>{t('Decisiones humanas.', 'Human decisions.')}</em></h2></div><div className="space-y-6 text-white/70"><p className="text-lg leading-relaxed">{t('Usamos NASA POWER para datos climáticos históricos y, cuando corresponde, NASA GIBS para explorar imágenes satelitales. Los datos son regionales: no sustituyen mediciones en tu parcela.', 'We use NASA POWER for historical climate data and, where available, NASA GIBS to explore satellite imagery. Data are regional and do not replace measurements on your parcel.')}</p><div className="flex gap-3 border-t border-white/20 pt-6 text-sm"><ShieldCheck className="shrink-0" size={22} /><span>{t('Las recomendaciones se basan únicamente en fichas regionales documentadas. Si faltan datos, te lo decimos.', 'Recommendations rely only on documented regional profiles. We tell you when data are missing.')}</span></div><Link to={user ? '/panel' : '/registro'} className="inline-flex items-center gap-2 font-bold text-white">{t('Comenzar ahora', 'Get started now')} <ArrowRight size={18} /></Link></div></div></section>
    </main><footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-10 text-sm text-muted md:px-10"><Logo /><span>{t('AgrocodeUTC · Datos para cultivar mejores decisiones.', 'AgrocodeUTC · Data for better growing decisions.')}</span></footer>
  </div>
}

function Workspace() {
  const { user, setUser } = useAuth()
  const { language } = usePreferences()
  const t = (es, en) => translated(language, es, en)
  const [mobile, setMobile] = useState(false)
  const navigate = useNavigate()
  async function exit() { await api.post('auth/logout/'); setUser(null); navigate('/') }
  const menuEnglish = { '/panel': 'Overview', '/parcelas': 'My parcels', '/clima': 'Climate history', '/agricultura': 'Crops and rotations', '/simulador': 'Crop simulator', '/historial': 'My history' }
  return <div className="min-h-screen bg-paper"><header className="sticky top-0 z-[1001] flex h-20 items-center justify-between gap-2 border-b border-line bg-white/95 px-3 backdrop-blur sm:px-5 md:px-9"><div className="flex min-w-0 items-center gap-2"><button className="icon-button md:hidden" onClick={() => setMobile(!mobile)} aria-label={t('Abrir menú', 'Open menu')}><Menu /></button><div className="brand-preferences"><Logo /><PreferenceControls /></div></div><div className="flex shrink-0 items-center gap-2 md:gap-4"><span className="hidden text-sm text-muted sm:block">{t('Hola', 'Hello')}, {user.first_name || t('agricultor', 'farmer')}</span><Link to="/perfil" className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-bold text-white" title={t('Mi perfil', 'My profile')}>{(user.first_name || 'A')[0].toUpperCase()}</Link></div></header><div className="mx-auto flex max-w-[1600px]"><aside className={`${mobile ? 'block' : 'hidden'} fixed inset-y-20 left-0 z-[1000] w-64 border-r border-line bg-white p-5 md:sticky md:top-20 md:block md:h-[calc(100vh-80px)] md:w-64 md:shrink-0`}><div className="mb-5 px-3 pt-3 text-[10px] font-bold uppercase tracking-[.2em] text-muted">{t('Área de trabajo', 'Workspace')}</div><nav className="space-y-1">{menu.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobile(false)} className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}><Icon size={18} /> {language === 'en' ? menuEnglish[to] : label} <ChevronRight className="ml-auto opacity-40" size={14} /></NavLink>)}</nav><div className="mt-10 border-t border-line pt-4"><NavLink to="/perfil" className="nav-item" onClick={() => setMobile(false)}>{t('Mi perfil', 'My profile')}</NavLink><button onClick={exit} className="nav-item w-full"><LogOut size={18} /> {t('Cerrar sesión', 'Sign out')}</button></div><div className="mt-12 rounded-xl bg-paper p-4 text-xs leading-relaxed text-muted">{t('Los análisis son orientativos. Antes de tomar decisiones agrícolas, consulta con un profesional local.', 'Analyses are for guidance only. Consult a local professional before making agricultural decisions.')}</div></aside><main className="min-w-0 flex-1 px-5 pb-20 pt-10 md:px-10 md:pt-12"><Routes><Route path="/panel" element={<Dashboard />} /><Route path="/parcelas" element={<ParcelsPage />} /><Route path="/clima" element={<ClimatePage />} /><Route path="/agricultura" element={<AgriculturePage />} /><Route path="/simulador" element={<SimulatorPage />} /><Route path="/historial" element={<HistoryPage />} /><Route path="/perfil" element={<ProfilePage />} /><Route path="*" element={<Navigate to="/panel" />} />  </Routes></main></div><HelpAssistant /></div>}

function AppRoutes() {
  const [user, setUser] = useState(undefined)
  const { language } = usePreferences()
  useEffect(() => { api.get('auth/me/').then(({ data }) => setUser(data)).catch(() => setUser(null)) }, [])
  if (user === undefined) return <div className="flex min-h-screen items-center justify-center bg-paper text-muted">{translated(language, 'Cargando AgrocodeUTC…', 'Loading AgrocodeUTC…')}</div>
  return <AuthContext.Provider value={{ user, setUser }}><Routes><Route path="/" element={<Landing />} /><Route path="/ingresar" element={<AuthPages mode="login" />} /><Route path="/registro" element={<AuthPages mode="register" />} /><Route path="/recuperar" element={<AuthPages mode="recover" />} /><Route path="/restablecer/:uid/:token" element={<AuthPages mode="reset" />} /><Route path="/*" element={user ? <Workspace /> : <Navigate to="/ingresar" replace />} /></Routes></AuthContext.Provider>}

export default function App() {
  return <PreferencesProvider><AppRoutes /></PreferencesProvider>
}
