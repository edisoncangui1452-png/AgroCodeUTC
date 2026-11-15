import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShieldCheck, Sprout, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, errorMessage } from '../api'
import { useAuth } from '../App'
import { PreferenceControls, translated, usePreferences } from '../preferences'
import ProfileOverview from '../components/ProfileOverview'

export function AuthPages({ mode }) {
  const { setUser } = useAuth()
  const { language } = usePreferences()
  const t = (es, en) => translated(language, es, en)
  const navigate = useNavigate()
  const { uid, token } = useParams()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const activeSchema = mode === 'recover' ? z.object({ email: z.email(t('Introduce un correo válido.', 'Enter a valid email address.')) }) : mode === 'reset' ? z.object({ password: z.string().min(8, t('Usa al menos 8 caracteres.', 'Use at least 8 characters.')) }) : z.object({
    first_name: z.string().optional(),
    email: z.email(t('Introduce un correo válido.', 'Enter a valid email address.')),
    password: z.string().min(1, t('Introduce una contraseña.', 'Enter a password.')),
  })
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(activeSchema) })
  const titles = {
    login: t('Bienvenido de nuevo.', 'Welcome back.'),
    register: t('Empecemos por aquí.', 'Let’s get started.'),
    recover: t('Recupera tu acceso.', 'Recover your account.'),
    reset: t('Crea una nueva contraseña.', 'Create a new password.'),
  }
  async function submit(data) {
    setBusy(true); setMessage('')
    try {
      if (mode === 'register' && !data.first_name?.trim()) { setMessage(t('Introduce tu nombre.', 'Enter your name.')); return }
      if (mode === 'recover') {
        await api.post('auth/password-reset/', { email: data.email })
        setMessage(t('Si el correo está registrado, recibirás instrucciones. Revisa también la consola del servidor en desarrollo.', 'If the email is registered, you will receive instructions. In development, also check the server console.'))
      } else if (mode === 'reset') {
        await api.post('auth/password-reset/confirm/', { uid, token, password: data.password })
        navigate('/ingresar')
      } else {
        const { data: user } = await api.post(mode === 'register' ? 'auth/register/' : 'auth/login/', data)
        setUser(user); navigate('/panel')
      }
    } catch (error) { setMessage(errorMessage(error)) } finally { setBusy(false) }
  }
  return <div className="grid min-h-screen md:grid-cols-2"><div className="flex flex-col bg-white px-6 py-8 md:px-[max(3rem,8vw)] md:py-12"><div className="brand-preferences"><Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-white"><Sprout size={20} /></span> AgrocodeUTC</Link><PreferenceControls /></div><div className="my-auto max-w-md py-16"><Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted"><ArrowLeft size={15} /> {t('Volver al inicio', 'Back to home')}</Link><div className="eyebrow">{t('TU ESPACIO AGRÍCOLA', 'YOUR AGRICULTURAL WORKSPACE')}</div><h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight">{titles[mode]}</h1><p className="mt-3 text-muted">{t('Una mirada más clara a tu terreno y a su historia climática.', 'A clearer view of your land and its climate history.')}</p><form className="mt-9 space-y-4" onSubmit={handleSubmit(submit)}>{mode === 'register' && <label className="field">{t('Nombre', 'Name')}<input autoComplete="given-name" {...register('first_name')} placeholder={t('Tu nombre', 'Your name')} /></label>}<label className="field">{t('Correo electrónico', 'Email address')}<input type="email" autoComplete="email" {...register('email')} placeholder={t('nombre@correo.com', 'name@example.com')} />{errors.email && <small>{errors.email.message}</small>}</label>{mode !== 'recover' && <label className="field">{t('Contraseña', 'Password')}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} {...register('password')} placeholder={t('Tu contraseña', 'Your password')} />{errors.password && <small>{errors.password.message}</small>}</label>}{message && <p role="alert" className="rounded-lg bg-paper p-3 text-sm">{message}</p>}<button disabled={busy} className="button button-dark mt-2 w-full">{busy ? t('Procesando…', 'Working…') : mode === 'login' ? t('Iniciar sesión', 'Sign in') : mode === 'register' ? t('Crear cuenta', 'Create account') : mode === 'recover' ? t('Enviar instrucciones', 'Send instructions') : t('Cambiar contraseña', 'Change password')} <ArrowRight size={17} /></button></form><div className="mt-6 text-sm text-muted">{mode === 'login' ? <><Link className="underline" to="/recuperar">{t('¿Olvidaste tu contraseña?', 'Forgot your password?')}</Link><p className="mt-4">{t('¿No tienes cuenta?', 'Don’t have an account?')} <Link className="font-bold text-ink underline" to="/registro">{t('Regístrate', 'Sign up')}</Link></p></> : <Link className="font-bold text-ink underline" to="/ingresar">{t('Ya tengo una cuenta', 'I already have an account')}</Link>}</div></div><p className="text-xs text-muted">{t('Tus parcelas son privadas. Ninguna recomendación sustituye asesoría local.', 'Your parcels are private. Recommendations do not replace local advice.')}</p></div><div className="relative hidden overflow-hidden bg-ink p-16 text-white md:flex md:flex-col md:justify-end"><div className="hero-grid opacity-50" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><Sprout className="absolute left-1/2 top-1/3 -translate-x-1/2" size={150} strokeWidth={0.6} /><div className="relative z-10"><div className="eyebrow border-white/30 text-white/70">{t('DATOS QUE ECHAN RAÍCES', 'DATA THAT TAKES ROOT')}</div><p className="mt-6 max-w-lg font-display text-4xl font-bold leading-tight">{t('Conoce tu tierra.', 'Know your land.')}<br />{t('Comprende el clima.', 'Understand the climate.')}<br /><em className="font-normal">{t('Decide con claridad.', 'Make clear decisions.')}</em></p></div></div></div>
}

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const { language } = usePreferences()
  const t = (es, en) => translated(language, es, en)
  const [firstName, setFirstName] = useState(user.first_name || '')
  const [email, setEmail] = useState(user.email || '')
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [parcels, setParcels] = useState([])
  const [parcelsState, setParcelsState] = useState('loading')
  async function loadParcels() {
    setParcelsState('loading')
    try { const { data } = await api.get('parcels/'); setParcels(data.results || data); setParcelsState('ready') }
    catch { setParcelsState('error') }
  }
  useEffect(() => { loadParcels() }, [])
  async function save(e) { e.preventDefault(); try { const { data } = await api.patch('auth/me/', { first_name: firstName, email }); setUser(data); setMessage(t('Perfil actualizado.', 'Profile updated.')) } catch (err) { setMessage(errorMessage(err)) } }
  async function change(e) { e.preventDefault(); try { await api.post('auth/change-password/', { current_password: current, password }); setCurrent(''); setPassword(''); setMessage(t('Contraseña actualizada.', 'Password updated.')) } catch (err) { setMessage(errorMessage(err)) } }
  return <div className="profile-page max-w-4xl">
    <div className="eyebrow">{t('TU CUENTA', 'YOUR ACCOUNT')}</div><h1 className="page-title">{t('Mi perfil', 'My profile')}</h1>
    {message && <div role="status" className="notice mt-5">{message}</div>}
    <ProfileOverview firstName={firstName} email={email} parcels={parcels} parcelsState={parcelsState} onRetry={loadParcels} language={language} />
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <form onSubmit={save} className="panel space-y-4"><h2 className="flex items-center gap-2 text-xl font-bold"><UserRound size={21} aria-hidden="true" /> {t('Mis datos', 'My details')}</h2><label className="field">{t('Nombre', 'Name')}<input autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} /></label><label className="field">{t('Correo electrónico', 'Email address')}<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label><button className="button button-dark w-full">{t('Guardar cambios', 'Save changes')}</button></form>
      <form onSubmit={change} className="panel space-y-4"><h2 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck size={21} aria-hidden="true" /> {t('Seguridad', 'Security')}</h2><label className="field">{t('Contraseña actual', 'Current password')}<input autoComplete="current-password" type="password" value={current} onChange={e => setCurrent(e.target.value)} /></label><label className="field">{t('Nueva contraseña', 'New password')}<input autoComplete="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} /></label><button className="button button-outline w-full">{t('Cambiar contraseña', 'Change password')}</button></form>
    </div>
  </div>
}
