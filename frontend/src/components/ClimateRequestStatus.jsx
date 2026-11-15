import { RefreshCcw } from 'lucide-react'
import { translated } from '../preferences'

export default function ClimateRequestStatus({ state, selectedParcel, onRetry, language }) {
  if (state === 'loading') return <div className="panel mt-5" role="status" aria-live="polite">
    <div className="climate-skeleton" aria-hidden="true" />
    <p className="mt-3 font-semibold">{translated(language, 'Cargando ficha climática…', 'Loading climate report…')}</p>
  </div>

  if (state === 'error') return <div className="notice mt-5" role="alert">
    <p>{translated(language, 'No se pudo cargar la ficha climática. Comprueba tu conexión e inténtalo de nuevo.', 'The climate report could not be loaded. Check your connection and try again.')}</p>
    <button type="button" className="button button-outline mt-3" disabled={!selectedParcel} onClick={onRetry}>
      <RefreshCcw size={18} aria-hidden="true" /> {translated(language, 'Reintentar consulta', 'Retry query')}
    </button>
  </div>

  if (state === 'empty') return <div className="panel mt-5">
    <p>{selectedParcel
      ? translated(language, 'Selecciona el último año completo y genera la ficha climática.', 'Choose the last complete year and create the climate report.')
      : translated(language, 'Vacío: selecciona una parcela y un periodo para consultar.', 'Empty: select a parcel and period to query.')}</p>
  </div>

  return null
}
