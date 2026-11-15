import { CalendarDays, CloudRain, Droplets, Sun, Thermometer, Wind } from 'lucide-react'
import { CLIMATE_VARIABLES } from '../climateInsights'
import { translated } from '../preferences'

const variableIcons = { temperature: Thermometer, rain: CloudRain, humidity: Droplets, sun: Sun, wind: Wind }
const monthsByLanguage = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
function SourceCoverage({ language, detail }) {
  return <p className="source-coverage-note">{translated(language, 'Fuente: NASA POWER. Cobertura:', 'Source: NASA POWER. Coverage:')} {detail}</p>
}

export function ClimateVisualSummary({ result, language }) {
  const english = language === 'en'
  const returnedKeys = new Set(Object.keys(result.units || {}))
  const variables = CLIMATE_VARIABLES.filter(item => returnedKeys.has(item.key))
  const groups = [...new Set((result.monthly || []).map(row => row.year))]
  const names = monthsByLanguage[english ? 'en' : 'es']

  if (!groups.length || !variables.length) return <section className="panel mt-5" aria-labelledby="visual-summary-title">
    <h2 id="visual-summary-title" className="text-xl font-bold">{translated(language, 'Resumen visual', 'Visual summary')}</h2>
    <p className="visual-unavailable">{translated(language, 'Dato no disponible: no hay meses o variables devueltos para este periodo.', 'Data not available: no months or variables were returned for this period.')}</p>
  </section>

  return <section className="panel mt-5" aria-labelledby="visual-summary-title">
    <div className="flex items-start gap-3">
      <span className="visual-metric-icon"><Sun size={24} aria-hidden="true" /></span>
      <div><h2 id="visual-summary-title" className="text-xl font-bold">{translated(language, 'Resumen visual por mes', 'Visual summary by month')}</h2>
        <p className="mt-1 text-muted">{translated(language, 'Valores mensuales disponibles en la respuesta de NASA POWER; no se calculan valores adicionales.', 'Monthly values returned by NASA POWER; no additional values are calculated.')}</p>
      </div>
    </div>
    <div className="mt-4 space-y-3">
      {groups.map((year, yearIndex) => {
        const rows = result.monthly.filter(row => row.year === year)
        return <details className="visual-summary-year" key={year} open={yearIndex === 0}>
          <summary className="cursor-pointer font-bold">{year} · {rows.length} {translated(language, 'meses', 'months')}</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map(row => {
              const available = variables.filter(item => row[item.key] !== null && row[item.key] !== undefined)
              const unavailable = variables.filter(item => row[item.key] === null || row[item.key] === undefined)
              return <article className="visual-summary-month" key={year + '-' + row.month}>
                <h3 className="flex items-center gap-2 font-bold"><CalendarDays size={18} aria-hidden="true" /> {names[row.month - 1]} {year}</h3>
                {available.length > 0 && <div className="mt-3 grid gap-2">
                  {available.map(item => {
                    const Icon = variableIcons[item.icon]
                    const label = english ? item.en : item.es
                    return <div className="visual-metric" key={item.key} data-climate-variable={item.key}>
                      <span className="visual-metric-icon"><Icon size={20} aria-hidden="true" /></span>
                      <span className="min-w-0"><strong>{label}</strong>: {String(row[item.key])} {result.units[item.key]}<small className="block text-muted">{translated(language, 'Cobertura diaria', 'Daily coverage')}: {row.coverage?.[item.key] === undefined ? translated(language, 'Dato no disponible', 'Data not available') : `${row.coverage[item.key]}/${row.days} ${translated(language, 'días', 'days')}`}</small></span>
                    </div>
                  })}
                </div>}
                {unavailable.length > 0 && <p className="visual-unavailable">{translated(language, 'Dato no disponible:', 'Data not available:')} {unavailable.map(item => english ? item.en : item.es).join(', ')}</p>}
              </article>
            })}
          </div>
        </details>
      })}
    </div>
    <SourceCoverage language={language} detail={translated(language, 'días válidos por variable sobre los días del mes.', 'valid days per variable out of the days in each month.')} />
  </section>
}
