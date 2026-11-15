import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Sprout } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, errorMessage } from '../api'
import { useAuth } from '../App'
import { useLanguage } from '../i18n'

const schema = z.object({
  first_name: z.string().optional(),
  email: z.email('Introduce un correo válido.'),
  password: z.string().min(1, 'Introduce una contraseña.'),
})

export function AuthPages({ mode }) {
  const { t } = useLanguage()
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const { uid, token } = useParams()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const activeSchema = mode === 'recover' ? z.object({ email: z.email('Introduce un correo válido.') }) : mode === 'reset' ? z.object({ password: z.string().min(8, 'Usa al menos 8 caracteres.') }) : schema
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(activeSchema) })
  const titles = { login: 'Bienvenido de nuevo.', register: 'Empecemos por aquí.', recover: 'Recupera tu acceso.', reset: 'Crea una nueva contraseña.' }
  async function submit(data) {
    setBusy(true); setMessage('')
    try {
      if (mode === 'register' && !data.first_name?.trim()) { setMessage('Introduce tu nombre.'); return }
      if (mode === 'recover') {
        await api.post('auth/password-reset/', { email: data.email })
        setMessage('Si el correo está registrado, recibirás instrucciones. Revisa también la consola del servidor en desarrollo.')
      } else if (mode === 'reset') {
        await api.post('auth/password-reset/confirm/', { uid, token, password: data.password })
        navigate('/ingresar')
      } else {
        const { data: user } = await api.post(mode === 'register' ? 'auth/register/' : 'auth/login/', data)
        setUser(user); navigate('/panel')
      }
    } catch (error) { setMessage(errorMessage(error)) } finally { setBusy(false) }
  }
  return <div className="grid min-h-screen md:grid-cols-2">
    <div className="flex flex-col bg-white px-6 py-8 md:px-[max(3rem,8vw)] md:py-12">
      <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-white"><Sprout size={20} /></span> AgroCode</Link>
      <div className="my-auto max-w-md py-16">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted"><ArrowLeft size={15} /> {t('Volver al inicio')}</Link>
        <div className="eyebrow">{t('TU ESPACIO AGRÍCOLA')}</div>
        <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight">{t(titles[mode])}</h1>
        <p className="mt-3 text-muted">{t('Una mirada más clara a tu terreno y a su historia climática.')}</p>
        <form className="mt-9 space-y-4" onSubmit={handleSubmit(submit)}>
          {mode === 'register' && <label className="field">{t('Nombre')}<input autoComplete="given-name" {...register('first_name')} placeholder={t('Tu nombre')} /></label>}
          <label className="field">{t('Correo electrónico')}<input type="email" autoComplete="email" {...register('email')} placeholder="nombre@correo.com" />{errors.email && <small>{t(errors.email.message)}</small>}</label>
          {mode !== 'recover' && <label className="field">{t('Contraseña')}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} {...register('password')} placeholder={t('Tu contraseña')} />{errors.password && <small>{t(errors.password.message)}</small>}</label>}
          {message && <p role="alert" className="rounded-lg bg-paper p-3 text-sm">{t(message)}</p>}
          <button disabled={busy} className="button button-dark mt-2 w-full">{t(busy ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear cuenta' : mode === 'recover' ? 'Enviar instrucciones' : 'Cambiar contraseña')} <ArrowRight size={17} /></button>
        </form>
        <div className="mt-6 text-sm text-muted">{mode === 'login' ? <><Link className="underline" to="/recuperar">{t('¿Olvidaste tu contraseña?')}</Link><p className="mt-4">{t('¿No tienes cuenta?')} <Link className="font-bold text-ink underline" to="/registro">{t('Regístrate')}</Link></p></> : <Link className="font-bold text-ink underline" to="/ingresar">{t('Ya tengo una cuenta')}</Link>}</div>
      </div>
      <p className="text-xs text-muted">{t('Tus parcelas son privadas. Ninguna recomendación sustituye asesoría local.')}</p>
    </div>
    <div className="relative hidden overflow-hidden bg-ink p-16 text-white md:flex md:flex-col md:justify-end"><div className="hero-grid opacity-50" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><Sprout className="absolute left-1/2 top-1/3 -translate-x-1/2" size={150} strokeWidth={0.6} /><div className="relative z-10"><div className="eyebrow border-white/30 text-white/70">{t('DATOS QUE ECHAN RAÍCES')}</div><p className="mt-6 max-w-lg font-display text-4xl font-bold leading-tight">{t('Conoce tu tierra.')}<br />{t('Comprende el clima.')}<br /><em className="font-normal">{t('Decide con claridad.')}</em></p></div></div>
  </div>
}

export function ProfilePage() {
  const { t } = useLanguage()
  const { user, setUser } = useAuth()
  const [firstName, setFirstName] = useState(user.first_name)
  const [email, setEmail] = useState(user.email)
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  async function save(e) { e.preventDefault(); try { const { data } = await api.patch('auth/me/', { first_name: firstName, email }); setUser(data); setMessage('Perfil actualizado.') } catch (err) { setMessage(errorMessage(err)) } }
  async function change(e) { e.preventDefault(); try { await api.post('auth/change-password/', { current_password: current, password }); setCurrent(''); setPassword(''); setMessage('Contraseña actualizada.') } catch (err) { setMessage(errorMessage(err)) } }
  return <div className="max-w-2xl"><div className="eyebrow">{t('TU CUENTA')}</div><h1 className="page-title">{t('Mi perfil')}</h1>{message && <div role="status" className="notice mt-5">{t(message)}</div>}<form onSubmit={save} className="panel mt-8 space-y-4"><h2 className="text-xl font-bold">{t('Información personal')}</h2><label className="field">{t('Nombre')}<input value={firstName} onChange={e => setFirstName(e.target.value)} /></label><label className="field">{t('Correo')}<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label><button className="button button-dark">{t('Guardar cambios')}</button></form><form onSubmit={change} className="panel mt-5 space-y-4"><h2 className="text-xl font-bold">{t('Seguridad')}</h2><label className="field">{t('Contraseña actual')}<input type="password" value={current} onChange={e => setCurrent(e.target.value)} /></label><label className="field">{t('Nueva contraseña')}<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label><button className="button button-outline">{t('Cambiar contraseña')}</button></form></div>
}
