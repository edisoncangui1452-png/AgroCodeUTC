import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getObservedPeriod, CLIMATE_VARIABLES } from '../climateInsights'
import { translated } from '../preferences'

const months = {
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

function SourceCoverage({ language, children }) {
  return <p className="source-coverage-note">{translated(language, 'Fuente: NASA POWER. Cobertura:', 'Source: NASA POWER. Coverage:')} {children}</p>
}

function available(value, unit, language) {
  return value === null || value === undefined
    ? translated(language, 'Dato no disponible', 'Data not available')
    : `${value}${unit ? ` ${unit}` : ''}`
}

function Section({ id, title, children, note }) {
  return <section className="advanced-section" data-advanced-section={id} aria-labelledby={'advanced-' + id}>
    <h3 id={'advanced-' + id} className="text-lg font-bold">{title}</h3>
    {children}
    <SourceCoverage language={note.language}>{note.content}</SourceCoverage>
  </section>
}

export default function ClimateAdvanced({ open, result, language, variable, onVariableChange, onToggle }) {
  const english = language === 'en'
  const coverage = result.coverage || {}
  const period = result.period || { start: '', end: '' }
  const observed = getObservedPeriod(coverage)
  const monthNames = months[english ? 'en' : 'es']
  const variables = CLIMATE_VARIABLES.filter(item => Object.hasOwn(result.units || {}, item.key))
  const years = [...new Set((result.monthly || []).map(row => row.year))]
  const variableInfo = variables.find(item => item.key === variable) || variables[0]
  const selectedKey = variableInfo?.key
  const chartData = monthNames.map((month, index) => ({
    month,
    ...Object.fromEntries(years.map(year => [year, result.monthly.find(row => row.year === year && row.month === index + 1)?.[selectedKey]])),
  })).filter(item => years.filter(year => Number.isFinite(item[year])).length >= 2)
  const chartRows = chartData.flatMap(item => years
    .filter(year => Number.isFinite(item[year]))
    .map(year => result.monthly.find(row => row.year === year && row.month === monthNames.indexOf(item.month) + 1)))
  const scenario = result.scenario || []
  const showSourceNote = content => ({ language, content })

  return <section className="mt-5" aria-labelledby="advanced-mode-title">
    <button type="button" className="button button-outline climate-advanced-toggle" aria-expanded={open} aria-controls="advanced-climate-sections" onClick={onToggle}>
      {translated(language, 'Modo avanzado', 'Advanced mode')} <span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    <div id="advanced-climate-sections" className="mt-4 space-y-3" hidden={!open}>
      <h2 id="advanced-mode-title" className="sr-only">{translated(language, 'Datos climáticos avanzados', 'Advanced climate data')}</h2>

      <Section id="observed-range" title={translated(language, 'Rango histórico observado', 'Observed historical range')} note={showSourceNote(translated(language, 'primera y última fecha con dato válido en cualquiera de las variables devueltas.', 'first and last date with a valid value in any returned variable.'))}>
        {observed
          ? <p className="mt-3 text-lg font-semibold">{observed.start} – {observed.end}</p>
          : <p className="visual-unavailable mt-3">{translated(language, 'Cobertura insuficiente: NASA POWER no devolvió fechas con datos válidos en este periodo.', 'Insufficient coverage: NASA POWER returned no dates with valid values in this period.')}</p>}
      </Section>

      <Section id="comparison-table" title={translated(language, 'Tabla comparativa', 'Comparison table')} note={showSourceNote(translated(language, 'días válidos por variable sobre los días de cada mes.', 'valid days per variable out of the days in each month.'))}>
        <div className="mt-3 overflow-x-auto">
          <table className="advanced-table">
            <thead><tr><th>{translated(language, 'Año', 'Year')}</th><th>{translated(language, 'Mes', 'Month')}</th>{variables.map(item => <th key={item.key}>{english ? item.en : item.es} ({result.units[item.key]})</th>)}</tr></thead>
            <tbody>{(result.monthly || []).map(row => <tr key={row.year + '-' + row.month}>
              <td>{row.year}</td><td>{monthNames[row.month - 1]}</td>{variables.map(item => <td key={item.key}>
                {available(row[item.key], result.units[item.key], language)}
                <small className="block text-muted">{translated(language, 'Cobertura', 'Coverage')}: {row.coverage?.[item.key] ?? translated(language, 'Dato no disponible', 'Data not available')}/{row.days} {translated(language, 'días', 'days')}</small>
              </td>)}
            </tr>)}</tbody>
          </table>
        </div>
        {(!result.monthly?.length || !variables.length) && <p className="visual-unavailable mt-3">{translated(language, 'Cobertura insuficiente: no hay filas mensuales o variables disponibles.', 'Insufficient coverage: no monthly rows or variables are available.')}</p>}
      </Section>

      <Section id="monthly-comparison" title={translated(language, 'Comparación mensual', 'Monthly comparison')} note={showSourceNote(chartRows.length
        ? <span>{translated(language, 'días válidos para', 'valid days for')} {english ? variableInfo?.en : variableInfo?.es}: {chartRows.map(row => `${monthNames[row.month - 1]} ${row.year} ${row.coverage?.[selectedKey] ?? translated(language, 'Dato no disponible', 'Data not available')}/${row.days}`).join(' · ')}</span>
        : translated(language, 'Cobertura insuficiente: no hay meses con valores disponibles para esta variable.', 'Insufficient coverage: no months have available values for this variable.'))}>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="field min-w-[210px]">{translated(language, 'Variable disponible', 'Available variable')}
            <select className="select" value={selectedKey} onChange={event => onVariableChange(event.target.value)} disabled={!variables.length}>
              {variables.map(item => <option key={item.key} value={item.key}>{english ? item.en : item.es}</option>)}
            </select>
          </label>
        </div>
        {chartData.length > 0
          ? <div className="mt-5 h-[320px] w-full"><ResponsiveContainer width="100%" height="100%">
            {selectedKey === 'PRECTOTCORR'
              ? <BarChart data={chartData}><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />{years.map((year, index) => <Bar key={year} dataKey={String(year)} fill={['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'][index]} />)}</BarChart>
              : <LineChart data={chartData}><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />{years.map((year, index) => <Line key={year} type="monotone" dataKey={String(year)} stroke={['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'][index]} strokeWidth={3} connectNulls={false} />)}</LineChart>}
          </ResponsiveContainer></div>
          : <p className="visual-unavailable mt-3">{translated(language, 'Cobertura insuficiente para comparar meses de esta variable.', 'Insufficient coverage to compare months for this variable.')}</p>}
      </Section>

      <Section id="climate-summary" title={translated(language, 'Resumen climático por mes disponible', 'Climate summary by available month')} note={showSourceNote(translated(language, 'cantidad de observaciones mensuales que ya devuelve el escenario, por variable.', 'number of monthly observations already returned by the scenario, per variable.'))}>
        {scenario.length > 0 ? <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {scenario.map(row => <article className="visual-summary-month" key={row.month}>
            <h4 className="font-bold">{monthNames[row.month - 1]}</h4>
            {['T2M', 'PRECTOTCORR'].filter(key => Object.hasOwn(result.units || {}, key)).map(key => {
              const item = row[key]
              const label = key === 'T2M' ? translated(language, 'Temperatura media', 'Mean temperature') : translated(language, 'Lluvia', 'Rain')
              const unit = result.units[key]
              return item
                ? <p className="mt-2" key={key}><strong>{label}:</strong> {translated(language, 'rango', 'range')} {item.min}–{item.max} {unit}; {translated(language, 'central', 'central')} {item.central} {unit}; {translated(language, 'observaciones', 'observations')}: {item.observations}.</p>
                : <p className="visual-unavailable mt-2" key={key}>{translated(language, 'Dato no disponible:', 'Data not available:')} {label}.</p>
            })}
          </article>)}
        </div> : <p className="visual-unavailable mt-3">{translated(language, 'Cobertura insuficiente: no hay resumen mensual disponible.', 'Insufficient coverage: no monthly summary is available.')}</p>}
      </Section>

      <Section id="monthly-summary" title={translated(language, 'Resumen mensual disponible', 'Available monthly summary')} note={showSourceNote(translated(language, 'se muestran las variables/unidades de la respuesta y los días con dato de cada mes.', 'the response variables/units and days with data for each month are shown.'))}>
        {result.monthly?.length && variables.length ? <div className="mt-3 overflow-x-auto">
          <table className="advanced-table">
            <thead><tr><th>{translated(language, 'Año', 'Year')}</th><th>{translated(language, 'Mes', 'Month')}</th>{variables.map(item => <th key={item.key}>{english ? item.en : item.es} ({result.units[item.key]})</th>)}</tr></thead>
            <tbody>{result.monthly.map(row => <tr key={row.year + '-' + row.month}>
              <td>{row.year}</td><td>{monthNames[row.month - 1]}</td>{variables.map(item => <td key={item.key}>
                {available(row[item.key], result.units[item.key], language)}
                <small className="block text-muted">{translated(language, 'Cobertura', 'Coverage')}: {row.coverage?.[item.key] ?? translated(language, 'Dato no disponible', 'Data not available')}/{row.days} {translated(language, 'días', 'days')}</small>
              </td>)}
            </tr>)}</tbody>
          </table>
        </div> : <p className="visual-unavailable mt-3">{translated(language, 'Dato no disponible: faltan filas mensuales o variables devueltas.', 'Data not available: monthly rows or returned variables are missing.')}</p>}
      </Section>

      <Section id="queried-period" title={translated(language, 'Periodo consultado', 'Queried period')} note={showSourceNote(translated(language, 'periodo solicitado; es distinto del rango histórico observado mostrado arriba.', 'requested period; it differs from the observed historical range above.'))}>
        <p className="mt-3 text-lg font-semibold">{period.start || translated(language, 'Dato no disponible', 'Data not available')} – {period.end || translated(language, 'Dato no disponible', 'Data not available')}</p>
      </Section>
    </div>
  </section>
}
