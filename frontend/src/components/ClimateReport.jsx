import { Printer } from 'lucide-react'
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
const monthNames = {
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

function displayDate(value, language) {
  if (!value) return translated(language, 'Dato no disponible', 'Data not available')
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? translated(language, 'Dato no disponible', 'Data not available') : new Intl.DateTimeFormat(language === 'en' ? 'en' : 'es', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date) + ' UTC'
}

function rangeLabel(range, language) {
  const format = value => {
    const date = new Date(`${value}T00:00:00Z`)
    return new Intl.DateTimeFormat(language === 'en' ? 'en' : 'es', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
  }
  return range.start === range.end ? format(range.start) : `${format(range.start)} – ${format(range.end)}`
}

export default function ClimateReport({ parcel, result }) {
  const { language } = usePreferences()
  const english = language === 'en'
  const coverage = result.coverage || {}
  const allComplete = Object.values(coverage).length > 0 && Object.values(coverage).every(item => item.complete)
  const fields = Object.keys(result.units || coverage).filter(key => coverage[key])
  const period = result.period || { start: `${result.years?.[0] || ''}-01-01`, end: `${result.years?.[1] || ''}-12-31` }
  const fallback = translated(language, 'Dato no disponible', 'Data not available')
  const location = [parcel.location, parcel.country].filter(value => typeof value === 'string' && value.trim()).join(' · ')
  const queriedAt = displayDate(result.queried_at || result.fetched_at, language)
  const fetchedAt = displayDate(result.fetched_at, language)

  return <section id="climate-report" className="climate-report panel mt-5" aria-labelledby="climate-report-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="eyebrow">{translated(language, 'FICHA CLIMÁTICA DE PARCELA', 'PARCEL CLIMATE REPORT')}</div>
        <h2 id="climate-report-title" className="mt-4 font-display text-2xl font-bold">{translated(language, 'Resumen climático de', 'Climate summary for')} {parcel.name || fallback}</h2>
        <p className="mt-2 text-sm text-muted">{translated(language, 'Periodo consultado', 'Period queried')}: {period.start} – {period.end}</p>
      </div>
      <button type="button" className="button button-outline no-print" onClick={() => window.print()}>
        <Printer size={18} aria-hidden="true" /> {translated(language, 'Imprimir / guardar PDF', 'Print / save PDF')}
      </button>
    </div>

    {!allComplete && <div className="report-coverage-status" role="status">
      <strong>{translated(language, 'Cobertura insuficiente en una o más variables.', 'Insufficient coverage in one or more variables.')}</strong>
      <p>{translated(language, 'Hay fechas sin dato en NASA POWER. La cobertura puede ser parcial por variable; la ficha no sustituye ni completa los valores faltantes con supuestos.', 'NASA POWER has dates with no data. Coverage can be partial by variable; this report does not replace or fill missing values with assumptions.')}</p>
    </div>}
    {allComplete && <div className="report-coverage-status report-coverage-complete" role="status">
      <strong>{translated(language, 'Cobertura completa para todas las variables mostradas.', 'Complete coverage for all displayed variables.')}</strong>
    </div>}

    <div className="report-facts">
      <div><span>{translated(language, 'Ubicación registrada', 'Registered location')}</span><strong>{location || fallback}</strong></div>
      <div><span>{translated(language, 'Superficie', 'Area')}</span><strong>{Number.isFinite(Number(parcel.area_ha)) && parcel.area_ha !== null ? `${Number(parcel.area_ha).toLocaleString(english ? 'en' : 'es', { maximumFractionDigits: 2 })} ha` : fallback}</strong></div>
      <div><span>{translated(language, 'Punto consultado (latitud, longitud)', 'Queried point (latitude, longitude)')}</span><strong>{Number.isFinite(Number(parcel.latitude)) && Number.isFinite(Number(parcel.longitude)) ? `${Number(parcel.latitude).toFixed(4)}, ${Number(parcel.longitude).toFixed(4)}` : fallback}</strong></div>
      <div><span>{translated(language, 'Fecha y hora de consulta', 'Query date and time')}</span><strong>{queriedAt}</strong></div>
      <div><span>{translated(language, 'Fecha de recepción de datos NASA POWER', 'NASA POWER data received')}</span><strong>{fetchedAt}</strong></div>
    </div>

    <div className="mt-5">
      <h3 className="text-lg font-bold">{translated(language, 'Variables disponibles y cobertura diaria', 'Available variables and daily coverage')}</h3>
      <p className="mt-1 text-sm text-muted">{translated(language, 'Se muestran solo las variables devueltas por NASA POWER en esta consulta.', 'Only variables returned by NASA POWER in this query are shown.')}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="climate-report-table w-full text-left">
          <thead><tr><th>{translated(language, 'Variable', 'Variable')}</th><th>{translated(language, 'Unidad', 'Unit')}</th><th>{translated(language, 'Días con dato', 'Days with data')}</th><th>{translated(language, 'Días sin dato', 'Days without data')}</th><th>{translated(language, 'Cobertura', 'Coverage')}</th><th>{translated(language, 'Fechas sin dato', 'Dates without data')}</th></tr></thead>
          <tbody>{fields.map(key => {
            const item = coverage[key]
            const name = variableNames[key]?.[english ? 1 : 0] || key
            const ranges = item.missing_ranges || []
            return <tr key={key}>
              <th scope="row">{name} <span className="report-variable-code">({key})</span></th>
              <td data-label={translated(language, 'Unidad', 'Unit')}>{result.units?.[key] || fallback}</td>
              <td data-label={translated(language, 'Días con dato', 'Days with data')}>{item.valid_days} / {item.total_days}</td>
              <td data-label={translated(language, 'Días sin dato', 'Days without data')}>{item.missing_days}</td>
              <td data-label={translated(language, 'Cobertura', 'Coverage')}>{item.coverage_percent}%</td>
              <td data-label={translated(language, 'Fechas sin dato', 'Dates without data')}>{ranges.length ? ranges.map(rangeLabelSafe => rangeLabel(rangeLabelSafe, language)).join('; ') : translated(language, 'Sin faltantes', 'None')}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
    </div>

    <div className="mt-5">
      <h3 className="text-lg font-bold">{translated(language, 'Resumen mensual disponible', 'Available monthly summary')}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="climate-report-table w-full text-left">
          <thead><tr><th>{translated(language, 'Año', 'Year')}</th><th>{translated(language, 'Mes', 'Month')}</th><th>{translated(language, 'Temperatura media °C', 'Mean temperature °C')}</th><th>{translated(language, 'Lluvia mm/mes', 'Rain mm/month')}</th><th>{translated(language, 'Días válidos (temp. / lluvia)', 'Valid days (temp. / rain)')}</th></tr></thead>
          <tbody>{(result.monthly || []).map(row => <tr key={`${row.year}-${row.month}`}>
            <td data-label={translated(language, 'Año', 'Year')}>{row.year}</td><td data-label={translated(language, 'Mes', 'Month')}>{monthNames[language][row.month - 1]}</td><td data-label={translated(language, 'Temperatura media °C', 'Mean temperature °C')}>{row.T2M ?? '—'}</td><td data-label={translated(language, 'Lluvia mm/mes', 'Rain mm/month')}>{row.PRECTOTCORR ?? '—'}</td>
            <td data-label={translated(language, 'Días válidos (temp. / lluvia)', 'Valid days (temp. / rain)')}>{row.coverage?.T2M ?? 0}/{row.days} · {row.coverage?.PRECTOTCORR ?? 0}/{row.days}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>

    <div className="mt-5 rounded-xl border border-line p-4 text-sm">
      <h3 className="font-bold">{translated(language, 'Fuente e interpretación', 'Source and interpretation')}</h3>
      <p className="mt-2">{translated(language, 'Fuente de datos: NASA POWER. Los datos describen estimaciones de su celda regional para el punto indicado; no son mediciones dentro de la parcela.', 'Data source: NASA POWER. The data describe estimates for its regional cell at the indicated point; they are not measurements from inside the parcel.')}</p>
      <p className="mt-2">{translated(language, 'La ficha resume las variables disponibles durante el periodo consultado. Por sí sola no explica las causas de los cambios ni permite concluir qué ocurrirá en el futuro.', 'This report summarizes the available variables for the queried period. By itself, it does not explain why changes occurred or establish what will happen in the future.')}</p>
      <p className="mt-2 text-muted">{translated(language, 'Generada en el navegador. Imprime esta página y elige “Guardar como PDF” para descargarla.', 'Generated in your browser. Print this page and choose “Save as PDF” to download it.')}</p>
    </div>

    <div className="report-required-notices" aria-label={translated(language, 'Advertencias obligatorias en español e inglés', 'Required notices in Spanish and English')}>
      <h3>{translated(language, 'Advertencias', 'Warnings')}</h3>
      <ul>
        <li>NASA POWER aporta estimaciones regionales, no mediciones de tu parcela.</li>
        <li>NASA GIBS es solo una capa visual, no una fuente de análisis.</li>
        <li>El historial de pocos años no es un pronóstico.</li>
        <li>NASA POWER provides regional estimates, not measurements of your parcel.</li>
        <li>NASA GIBS is only a visual layer, not a source of analysis.</li>
        <li>A history covering only a few years is not a forecast.</li>
      </ul>
    </div>
    <p className="mt-3 text-xs text-muted">NASA POWER · https://power.larc.nasa.gov/ · {fetchedAt}</p>
  </section>
}
