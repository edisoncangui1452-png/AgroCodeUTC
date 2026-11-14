import axios from 'axios'

export const api = axios.create({ baseURL: '/api/v1/', withCredentials: true })
let csrfToken = null
function cookieToken() {
  return document.cookie.split('; ').find(part => part.startsWith('csrftoken='))?.split('=')[1]
}
export async function ensureCsrf() {
  const cookie = cookieToken()
  if (cookie) return decodeURIComponent(cookie)
  if (!csrfToken) {
    const { data } = await api.get('auth/csrf/')
    csrfToken = data.csrfToken
  }
  return csrfToken
}
api.interceptors.request.use(async (config) => {
  if (!['get', 'head', 'options'].includes(config.method?.toLowerCase())) {
    config.headers['X-CSRFToken'] = await ensureCsrf()
  }
  return config
})
export function errorMessage(error) {
  const data = error.response?.data
  if (!data) return 'No hay conexión con el servidor. Inténtalo de nuevo.'
  if (typeof data === 'string') return 'El servidor rechazó la solicitud. Recarga la página e inténtalo de nuevo.'
  if (typeof data.detail === 'string') return data.detail
  const first = Object.values(data)[0]
  return Array.isArray(first) ? first.join(' ') : String(first || 'No se pudo completar la operación.')
}
