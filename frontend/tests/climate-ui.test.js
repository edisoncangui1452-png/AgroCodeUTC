import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let vite
let ClimateReport
let ClimateAssistant
let ClimateRequestStatus
let PreferencesProvider
let answerClimateQuestion
let toggleAssistant
let shouldCloseAssistant
let resolveInitialLanguage
let resolveInitialTheme
let nextTheme
let persistLanguage
let persistTheme
let normalizeLanguage
let getCountryOptions
let formatParcelArea
let selectedParcelArea
let ClimateAdvanced
let ClimateVisualSummary
let LunarCalendar
let PreferenceControls
let CountrySelect
let ProfileOverview
let getObservedPeriod
let toggleAdvancedMode
let buildLunarYearData
let buildLunarMonthRows
let calculateLunarDay
let calculatePrincipalPhaseEvents
let moveLunarDate
let getLunarAgriculturalRule
let LUNAR_AGRICULTURAL_RULES

const coverage = {
  T2M: { valid_days: 365, missing_days: 0, total_days: 365, coverage_percent: 100, complete: true, missing_ranges: [] },
  T2M_MAX: { valid_days: 365, missing_days: 0, total_days: 365, coverage_percent: 100, complete: true, missing_ranges: [] },
  T2M_MIN: { valid_days: 365, missing_days: 0, total_days: 365, coverage_percent: 100, complete: true, missing_ranges: [] },
  PRECTOTCORR: { valid_days: 365, missing_days: 0, total_days: 365, coverage_percent: 100, complete: true, missing_ranges: [] },
  RH2M: { valid_days: 365, missing_days: 0, total_days: 365, coverage_percent: 100, complete: true, missing_ranges: [] },
  ALLSKY_SFC_SW_DWN: { valid_days: 365, missing_days: 0, total_days: 365, coverage_percent: 100, complete: true, missing_ranges: [] },
  WS2M: { valid_days: 365, missing_days: 0, total_days: 365, coverage_percent: 100, complete: true, missing_ranges: [] },
}
const parcel = { id: 7, name: 'Parcela Demo', location: 'Sierra', country: 'EC', area_ha: 2.5, latitude: -1.66, longitude: -78.64 }
const result = {
  period: { start: '2023-01-01', end: '2023-12-31' },
  years: [2023, 2023],
  fetched_at: '2026-11-15T12:00:00Z',
  source: 'NASA POWER',
  units: { T2M: '°C', T2M_MAX: '°C', T2M_MIN: '°C', PRECTOTCORR: 'mm/día', RH2M: '%', ALLSKY_SFC_SW_DWN: 'MJ/m²/día', WS2M: 'm/s' },
  coverage,
  monthly: [{ year: 2023, month: 1, days: 31, T2M: 14, PRECTOTCORR: 30, coverage: { T2M: 31, PRECTOTCORR: 31 } }],
}

before(async () => {
  const storage = new Map()
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  globalThis.window = { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} }
  globalThis.document = { documentElement: { dataset: {}, style: {} } }
  vite = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  const report = await vite.ssrLoadModule('/src/components/ClimateReport.jsx')
  const status = await vite.ssrLoadModule('/src/components/ClimateRequestStatus.jsx')
  const assistant = await vite.ssrLoadModule('/src/components/ClimateAssistant.jsx')
  const advanced = await vite.ssrLoadModule('/src/components/ClimateAdvanced.jsx')
  const visuals = await vite.ssrLoadModule('/src/components/ClimateVisuals.jsx')
  const lunar = await vite.ssrLoadModule('/src/components/LunarCalendar.jsx')
  const countrySelect = await vite.ssrLoadModule('/src/components/CountrySelect.jsx')
  const profileOverview = await vite.ssrLoadModule('/src/components/ProfileOverview.jsx')
  const insights = await vite.ssrLoadModule('/src/climateInsights.js')
  const countries = await vite.ssrLoadModule('/src/countries.js')
  const parcelMetrics = await vite.ssrLoadModule('/src/parcelMetrics.js')
  const lunarData = await vite.ssrLoadModule('/src/lunarCalendar.js')
  const lunarRules = await vite.ssrLoadModule('/src/lunarAgriculturalRules.js')
  const preferences = await vite.ssrLoadModule('/src/preferences.jsx')
  ClimateReport = report.default
  ClimateRequestStatus = status.default
  ClimateAssistant = assistant.default
  answerClimateQuestion = assistant.answerClimateQuestion
  toggleAssistant = assistant.toggleAssistant
  shouldCloseAssistant = assistant.shouldCloseAssistant
  ClimateAdvanced = advanced.default
  ClimateVisualSummary = visuals.ClimateVisualSummary
  LunarCalendar = lunar.LunarCalendar
  CountrySelect = countrySelect.default
  ProfileOverview = profileOverview.default
  getObservedPeriod = insights.getObservedPeriod
  toggleAdvancedMode = insights.toggleAdvancedMode
  getCountryOptions = countries.getCountryOptions
  formatParcelArea = parcelMetrics.formatParcelArea
  selectedParcelArea = parcelMetrics.selectedParcelArea
  buildLunarYearData = lunarData.buildLunarYearData
  buildLunarMonthRows = lunarData.buildLunarMonthRows
  calculateLunarDay = lunarData.calculateLunarDay
  calculatePrincipalPhaseEvents = lunarData.calculatePrincipalPhaseEvents
  moveLunarDate = lunarData.moveLunarDate
  getLunarAgriculturalRule = lunarRules.getLunarAgriculturalRule
  LUNAR_AGRICULTURAL_RULES = lunarRules.LUNAR_AGRICULTURAL_RULES
  PreferencesProvider = preferences.PreferencesProvider
  PreferenceControls = preferences.PreferenceControls
  resolveInitialLanguage = preferences.resolveInitialLanguage
  resolveInitialTheme = preferences.resolveInitialTheme
  nextTheme = preferences.nextTheme
  persistLanguage = preferences.persistLanguage
  persistTheme = preferences.persistTheme
  normalizeLanguage = preferences.normalizeLanguage
})

after(async () => { await vite?.close() })

function render(component, language = 'es') {
  localStorage.setItem('agrocode-language', language)
  return renderToStaticMarkup(React.createElement(PreferencesProvider, null, React.createElement(React.Fragment, null, component)))
}

function contrastRatio(first, second) {
  const luminance = color => {
    const channels = color.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test('climate report renders real parcel fields, variables, coverage, and bilingual notices', () => {
  const html = render(React.createElement(ClimateReport, { parcel, result }))
  for (const text of [
    'Parcela Demo', '2,5 ha', 'NASA POWER', 'T2M', '2023-01-01',
    'NASA POWER aporta estimaciones regionales, no mediciones de tu parcela.',
    'NASA GIBS es solo una capa visual, no una fuente de análisis.',
    'El historial de pocos años no es un pronóstico.',
    'NASA POWER provides regional estimates, not measurements of your parcel.',
    'NASA GIBS is only a visual layer, not a source of analysis.',
    'A history covering only a few years is not a forecast.',
  ]) assert.ok(html.includes(text), `Expected report to include: ${text}`)
})

test('incomplete report calls out missing dates and does not hide partial coverage', () => {
  const partial = structuredClone(result)
  partial.coverage.T2M = { valid_days: 363, missing_days: 2, total_days: 365, coverage_percent: 99.45, complete: false, missing_ranges: [{ start: '2023-03-12', end: '2023-03-13', days: 2 }] }
  const html = render(React.createElement(ClimateReport, { parcel, result: partial }))
  assert.match(html, /Cobertura insuficiente/)
  assert.match(html, /12 mar 2023/)
  assert.match(html, /99\.45%/)
})

test('loading, error with retry, and empty states render accessible labels', () => {
  const loading = render(React.createElement(ClimateRequestStatus, { state: 'loading', language: 'es' }))
  assert.match(loading, /Cargando ficha climática/)
  const error = render(React.createElement(ClimateRequestStatus, { state: 'error', language: 'en', selectedParcel: parcel, onRetry() {} }))
  assert.match(error, /role="alert"/)
  assert.match(error, /Retry query/)
  const empty = render(React.createElement(ClimateRequestStatus, { state: 'empty', language: 'es' }))
  assert.match(empty, /Vacío: selecciona una parcela y un periodo/)
})

test('assistant displays its notice and uses only report data or the explicit fallback', () => {
  const html = render(React.createElement(ClimateAssistant, { parcel, result }))
  assert.match(html, /Asistente/)
  assert.match(html, /No sustituye asesoría agronómica/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(answerClimateQuestion('¿Cuál es la cobertura?', parcel, result), /365\/365 días/)
  assert.equal(answerClimateQuestion('¿Lloverá mañana?', parcel, result), 'No tengo suficiente información en tu ficha para responder eso.')
  assert.equal(toggleAssistant(false), true)
  assert.equal(toggleAssistant(true), false)
  assert.equal(shouldCloseAssistant('Escape'), true)
  assert.equal(shouldCloseAssistant('Enter'), false)
})

test('language and theme initialize, toggle, and persist without changing system settings', () => {
  assert.equal(resolveInitialLanguage('en'), 'en')
  assert.equal(resolveInitialLanguage('fr'), 'es')
  assert.equal(resolveInitialTheme(null, true), 'dark')
  assert.equal(resolveInitialTheme('light', true), 'light')
  assert.equal(resolveInitialTheme('dark', false), 'dark')
  assert.equal(normalizeLanguage('en'), 'en')
  assert.equal(normalizeLanguage('pt'), 'es')
  assert.equal(nextTheme('light'), 'dark')
  assert.equal(nextTheme('dark'), 'light')
  const stored = new Map()
  const storage = { setItem: (key, value) => stored.set(key, value) }
  persistLanguage(storage, 'en')
  persistTheme(storage, 'dark')
  assert.equal(stored.get('agrocode-language'), 'en')
  assert.equal(stored.get('agrocode-theme'), 'dark')
})

test('appearance controls stay together beside the logo and preserve accessible labels', () => {
  const html = render(React.createElement(PreferenceControls))
  const app = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8')
  assert.match(html, /header-preferences/)
  assert.match(html, /Ajustes de apariencia/)
  assert.match(html, /Cambiar idioma a inglés/)
  assert.match(html, /Cambiar a tema oscuro/)
  assert.match(app, /brand-preferences"><Logo \/><PreferenceControls \/><\/div>/)
  assert.doesNotMatch(app, /AppRoutes \/><PreferenceControls/)
})

test('country selector offers localized ISO codes and keeps the selected ISO value', () => {
  const options = getCountryOptions('es')
  assert.ok(options.some(option => option.code === 'EC' && option.name === 'Ecuador'))
  const html = render(React.createElement(CountrySelect, { value: 'EC', onChange() {}, language: 'es' }))
  assert.match(html, /País ISO/)
  assert.match(html, /Selecciona tu país/)
  assert.match(html, /Ecuador \(EC\)/)
  assert.match(html, /<option value="EC" selected="">Ecuador \(EC\)<\/option>/)
  assert.match(html, /required=""/)
  let savedCode = ''
  const selectElement = CountrySelect({ value: 'EC', onChange: code => { savedCode = code }, language: 'es' }).props.children[1]
  selectElement.props.onChange({ target: { value: 'PE' } })
  assert.equal(savedCode, 'PE')
  const parcelsPage = readFileSync(resolve(process.cwd(), 'src/pages/ParcelsPage.jsx'), 'utf8')
  assert.match(parcelsPage, /const payload = \{ name, country, location, geometry \}/)
})

test('parcel area reuses saved hectares and converts to square metres without inventing missing data', () => {
  assert.deepEqual(formatParcelArea({ type: 'Polygon', coordinates: [] }, 1.25), { hectares: '1,25', squareMeters: '12.500' })
  assert.equal(formatParcelArea(null, 1.25), null)
  assert.equal(formatParcelArea({ type: 'Polygon', coordinates: [] }, null), null)
  const geometryA = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 1]]] }
  const geometryB = { type: 'Polygon', coordinates: [[[2, 2], [3, 2], [2, 3]]] }
  const parcels = [{ id: 1, geometry: geometryA, area_ha: 1.25 }, { id: 2, geometry: geometryB, area_ha: 3 }]
  assert.equal(selectedParcelArea(parcels, '1', geometryA).hectares, '1,25')
  assert.equal(selectedParcelArea(parcels, '2', geometryB).hectares, '3')
  assert.equal(selectedParcelArea(parcels, '1', geometryB), null)
  assert.equal(selectedParcelArea(parcels, '1', null), null)
})

test('lunar calendar calculates SunCalc event instants and Sunday-first 2026 rows', () => {
  const events = calculatePrincipalPhaseEvents(2026)
  assert.ok(events.length >= 48 && events.length <= 52)
  assert.ok(events.every(event => event.time instanceof Date && event.time.getFullYear() === 2026))
  for (const [key, target] of [['new', 0], ['first-quarter', 0.25], ['full', 0.5], ['last-quarter', 0.75]]) {
    const event = events.find(item => item.key === key)
    assert.ok(event, 'Missing ' + key + ' event')
    const difference = Math.abs(event.phase - target)
    assert.ok(Math.min(difference, 1 - difference) < 1e-5, 'Unexpected phase instant for ' + key)
  }

  const year = buildLunarYearData(2026)
  assert.equal(Object.keys(year).length, 365)
  assert.ok(Object.values(year).some(day => day.principalPhase === 'new' && day.event?.time instanceof Date))
  assert.ok(Object.values(year).every(day => day.fraction >= 0 && day.fraction <= 1 && Number.isInteger(day.percentVisible)))

  const october = buildLunarMonthRows(2026, 9, year)
  assert.equal(october.length, 5)
  assert.equal(october[0].cells[0].date, '2026-09-27')
  assert.equal(october[0].cells[0].outsideMonth, true)
  assert.ok(october.every(row => row.cells.length === 7))
  const november = buildLunarMonthRows(2026, 10, year)
  assert.equal(november.length, 5)
  assert.equal(november.at(-1).cells[6].date, '2026-12-05')
  assert.equal(november.at(-1).cells[6].outsideMonth, true)
  assert.equal(buildLunarMonthRows(2026, 12, year).length, 0)
  assert.equal(moveLunarDate('2026-11-15', 1), '2026-11-16')
  assert.equal(moveLunarDate('2026-12-31', 1), null)
  assert.equal(moveLunarDate('2026-01-01', -1), null)
})

test('central agricultural rules cover each phase and the defined intermediate support icons', () => {
  const phases = LUNAR_AGRICULTURAL_RULES.phases
  assert.equal(phases.new.recommendation, 'No sembrar / Descanso y preparación')
  assert.equal(phases.waxing.recommendation, 'Siembra de hojas / Siembra de flores')
  assert.equal(phases.full.recommendation, 'Cosecha general / Recolección')
  assert.equal(phases.waning.recommendation, 'Poda de formación / Control de plagas')

  const intermediate = phase => ({ phase, waxing: phase < 0.5, principalPhase: null })
  assert.equal(getLunarAgriculturalRule(intermediate(0.1)).recommendation, phases.waxing.recommendation)
  assert.equal(getLunarAgriculturalRule(intermediate(0.1)).supportIconKey, 'roots')
  assert.equal(getLunarAgriculturalRule(intermediate(0.35)).recommendation, phases.full.recommendation)
  assert.equal(getLunarAgriculturalRule(intermediate(0.35)).supportIconKey, 'watering')
  assert.equal(getLunarAgriculturalRule(intermediate(0.65)).recommendation, phases.waning.recommendation)
  assert.equal(getLunarAgriculturalRule(intermediate(0.65)).supportIconKey, 'roots')
  assert.equal(getLunarAgriculturalRule(intermediate(0.9)).recommendation, phases.new.recommendation)
  assert.equal(getLunarAgriculturalRule(intermediate(0.9)).supportIconKey, 'watering')
  assert.deepEqual(LUNAR_AGRICULTURAL_RULES.activityLegend.map(item => item.label), [
    'Poda', 'Siembra de Raíces', 'Siembra de Hojas', 'Siembra de Flores', 'Recolección', 'Riego/Abonado', 'Control de Plagas',
  ])
})

test('agricultural lunar calendar renders farm banner, exact events, recommendations, guide, and legend', () => {
  const today = new Date(2026, 10, 15, 12)
  const html = render(React.createElement(LunarCalendar, { open: true, language: 'es', today, onClose() {} }))
  assert.match(html, /CALENDARIO LUNAR AGRÍCOLA - NOVIEMBRE 2026/)
  assert.match(html, /Observa la Luna, trabaja la tierra y cosecha abundancia/)
  assert.match(html, /class=\"lunar-farm-illustration\"/)
  assert.match(html, /role=\"columnheader\">Do<\/span>/)
  const headers = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'].map(day => html.indexOf('role=\"columnheader\">' + day + '</span>'))
  assert.ok(headers.every(index => index >= 0))
  assert.deepEqual([...headers].sort((a, b) => a - b), headers)

  const dayCells = html.match(/<button type=\"button\" role=\"gridcell\"[^>]*class=\"lunar-day-cell[^\"]*\"[^>]*>[\s\S]*?<\/button>/g) || []
  assert.equal(dayCells.length, 35)
  assert.ok(dayCells.every(cell => cell.includes('class=\"lunar-moon-image\"') && cell.includes('class=\"lunar-recommendation\"')))
  assert.match(dayCells[30], /class="lunar-date-number">1<span class="lunar-date-month"> DIC<\/span>/)
  assert.ok(dayCells.some(cell => /class=\"lunar-event-label\">\d{2} (?:NOV|DIC) - \d{2}:\d{2} (?:LUNA NUEVA|CUARTO CRECIENTE|LUNA LLENA|CUARTO MENGUANTE)<\/span>/.test(cell)))
  assert.match(html, /lunar-day-selected lunar-day-today/)
  assert.match(html, /aria-label=\"Luna en fase .*% visible\"/)
  assert.match(html, /class=\"lunar-activity-icon[^\"]*\" role=\"img\" aria-label=\"Actividad de apoyo:/)
  assert.equal((html.match(/class=\"lunar-phase-guide-card\"/g) || []).length, 4)
  assert.match(html, /Guía de fases lunares/)
  assert.equal((html.match(/<li><svg/g) || []).length, 7)
  assert.match(html, /Fases calculadas con SunCalc 2\.1\.4\. Las recomendaciones son prácticas tradicionales según la fase lunar, no son datos de NASA POWER ni de NASA GIBS y no sustituyen asesoría agronómica\./)

  const january = render(React.createElement(LunarCalendar, { open: true, language: 'es', today: new Date(2026, 0, 15, 12) }))
  const december = render(React.createElement(LunarCalendar, { open: true, language: 'es', today: new Date(2026, 11, 15, 12) }))
  assert.match(january, /ENERO 2026/)
  assert.match(january, /aria-label=\"Mes anterior\" disabled=\"\"/)
  assert.match(december, /DICIEMBRE 2026/)
  assert.match(december, /aria-label=\"Mes siguiente\" disabled=\"\"/)

  const calendar = readFileSync(resolve(process.cwd(), 'src/components/LunarCalendar.jsx'), 'utf8')
  const dashboard = readFileSync(resolve(process.cwd(), 'src/pages/DashboardPage.jsx'), 'utf8')
  const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')
  assert.match(dashboard, /setOpen\(true\)/)
  assert.match(dashboard, /aria-haspopup=\"dialog\"/)
  assert.match(calendar, /aria-label=.*Cerrar calendario/)
  assert.match(calendar, /onCancel=\{event => \{ event\.preventDefault\(\); closeDialog\(\) \}\}/)
  assert.match(calendar, /event\.target === dialogRef\.current/)
  assert.match(calendar, /ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7/)
  assert.match(styles, /\.lunar-dialog \{ width: 100vw/)
  assert.match(styles, /\.lunar-grid-row \{ grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/)
  assert.ok((360 - 12 - 2) / 7 >= 44, 'Date columns should stay at least 44px wide at 360px')
  assert.match(styles, /--lunar-outline: #15558b/)
  assert.match(styles, /--lunar-outline: #61b7e8/)
  assert.match(styles, /--lunar-event-surface: #16251b/)
  assert.match(styles, /--lunar-event-surface: #101a14/)
  assert.ok(contrastRatio('#ffffff', '#15558b') >= 4.5)
  assert.ok(contrastRatio('#ffffff', '#286b98') >= 4.5)
  assert.ok(contrastRatio('#15558b', '#e5f0f2') >= 3)
  assert.ok(contrastRatio('#61b7e8', '#263f43') >= 3)
  assert.ok(contrastRatio('#ffffff', '#16251b') >= 4.5)
  assert.ok(contrastRatio('#ffffff', '#101a14') >= 4.5)
})
test('profile overview uses a real initial, profile fields, parcel count, icons, and no invented account facts', () => {
  const html = render(React.createElement(ProfileOverview, { firstName: 'Rosa', email: 'rosa@example.com', parcels: [parcel], parcelsState: 'ready' }))
  assert.match(html, /role="img" aria-label="Avatar de Rosa, inicial R"/)
  assert.match(html, /<strong>Rosa<\/strong>/)
  assert.match(html, /<strong>rosa@example.com<\/strong>/)
  assert.match(html, /<strong>1<\/strong>/)
  assert.match(html, /profile-fact/)
  assert.match(html, /aria-hidden="true"/)
  assert.doesNotMatch(html, /contraseña|token|nivel de agricultor|fecha de registro/i)
})

test('parcel creation actions use the shared brand primary token in both themes', () => {
  const root = resolve(process.cwd(), '..')
  const parcelsPage = readFileSync(join(root, 'frontend/src/pages/ParcelsPage.jsx'), 'utf8')
  const dashboardPage = readFileSync(join(root, 'frontend/src/pages/DashboardPage.jsx'), 'utf8')
  const profile = readFileSync(join(root, 'frontend/src/components/ProfileOverview.jsx'), 'utf8')
  const styles = readFileSync(join(root, 'frontend/src/styles.css'), 'utf8')
  assert.match(dashboardPage, /action=\{t\('Crear mi parcela', 'Create my parcel'\)\}/)
  assert.match(dashboardPage, /to="\/parcelas" className="button button-dark"/)
  assert.match(parcelsPage, /t\('Área', 'Area'\)\}: \{selectedArea\.hectares\} ha/)
  assert.match(parcelsPage, /t\('Área no disponible', 'Area unavailable'\)/)
  assert.match(dashboardPage, /Calendario lunar/)
  assert.match(profile, /className="button button-dark mt-4"/)
  assert.match(styles, /\.button-dark \{ background: rgb\(var\(--brand-rgb\)\); color: var\(--on-brand\);/)
  assert.match(styles, /--brand-hover: #1f623c;/)
  assert.match(styles, /--brand-hover: #28583a;/)
  assert.ok(contrastRatio('#ffffff', '#254f35') >= 4.5)
  assert.ok(contrastRatio('#ffffff', '#1f623c') >= 4.5)
  assert.ok(contrastRatio('#ffffff', '#28583a') >= 4.5)
})

test('English preference localizes controls and the profile overview', () => {
  const controls = render(React.createElement(PreferenceControls), 'en')
  const profile = render(React.createElement(ProfileOverview, {
    firstName: 'Rosa', email: 'rosa@example.com', parcels: [parcel], parcelsState: 'ready', language: 'en',
  }), 'en')
  assert.match(controls, /EN · Español/)
  assert.match(profile, /Your workspace/)
  assert.match(profile, /Manage your details and view your registered parcels/)
  assert.match(profile, /Email address/)
})

test('parcel map renders its declared view controller without an unresolved component', () => {
  const root = resolve(process.cwd(), '..')
  const parcelMap = readFileSync(join(root, 'frontend/src/components/ParcelMap.jsx'), 'utf8')
  assert.match(parcelMap, /function ViewController\(/)
  assert.match(parcelMap, /<ViewController geometry=\{geometry\} focus=\{focus\} \/>/)
  assert.doesNotMatch(parcelMap, /<FlyTo\b/)
})

test('visual summary shows icons only for actual monthly values and labels missing data', () => {
  const html = render(React.createElement(ClimateVisualSummary, { result, language: 'es' }))
  assert.match(html, /data-climate-variable="T2M"/)
  assert.match(html, /data-climate-variable="PRECTOTCORR"/)
  assert.doesNotMatch(html, /data-climate-variable="RH2M"/)
  assert.match(html, /Dato no disponible:/)
  assert.match(html, /Fuente: NASA POWER/)
})

test('advanced mode contains its six data sections and uses observed, not requested, dates', () => {
  const advancedResult = structuredClone(result)
  advancedResult.coverage.T2M.first_valid_date = '2023-02-01'
  advancedResult.coverage.T2M.last_valid_date = '2023-11-30'
  advancedResult.coverage.PRECTOTCORR.first_valid_date = '2023-01-15'
  advancedResult.coverage.PRECTOTCORR.last_valid_date = '2023-12-20'
  advancedResult.scenario = [{ month: 1, T2M: { central: 14, min: 13, max: 15, variation: 1, observations: 3 }, PRECTOTCORR: { central: 30, min: 20, max: 40, variation: 5, observations: 3 } }]
  assert.deepEqual(getObservedPeriod(advancedResult.coverage), { start: '2023-01-15', end: '2023-12-20' })
  const html = render(React.createElement(ClimateAdvanced, { open: true, result: advancedResult, language: 'es', variable: 'T2M', onVariableChange() {}, onToggle() {} }))
  for (const section of ['observed-range', 'comparison-table', 'monthly-comparison', 'climate-summary', 'monthly-summary', 'queried-period']) {
    assert.ok(html.includes(`data-advanced-section="${section}"`), `Missing advanced section ${section}`)
  }
  assert.match(html, /2023-01-15 – 2023-12-20/)
  assert.match(html, /2023-01-01 – 2023-12-31/)
  assert.match(html, /Cobertura insuficiente para comparar meses de esta variable/)
  assert.equal(toggleAdvancedMode(false), true)
  assert.equal(toggleAdvancedMode(true), false)
  const closed = render(React.createElement(ClimateAdvanced, { open: false, result: advancedResult, language: 'es', variable: 'T2M', onVariableChange() {}, onToggle() {} }))
  assert.match(closed, /aria-expanded="false"/)
})

test('repository branding no longer includes the former product name', () => {
  const root = resolve(process.cwd(), '..')
  const ignored = new Set(['.git', 'node_modules', 'dist', '.venv'])
  const textFiles = new Set(['md', 'mdx', 'html', 'js', 'jsx', 'ts', 'tsx', 'json', 'py', 'css', 'scss', 'txt', 'example', 'lock', 'yaml', 'yml', 'toml', 'xml', 'svg', 'csv', 'ini', 'conf', 'sh', 'bat', 'ps1', 'sql'])
  const formerName = ['Agro', 'fisica'].join('')
  const pending = [root]
  const matches = []
  while (pending.length) {
    const directory = pending.pop()
    for (const entry of readdirSync(directory)) {
      if (ignored.has(entry)) continue
      const file = join(directory, entry)
      if (entry.toLocaleLowerCase().includes(formerName.toLocaleLowerCase())) matches.push(file)
      const stat = statSync(file)
      if (stat.isDirectory()) pending.push(file)
      else {
        if (!textFiles.has(entry.includes('.') ? entry.split('.').at(-1).toLocaleLowerCase() : '')) continue
        const content = readFileSync(file, 'utf8')
        if (content.toLocaleLowerCase().includes(formerName.toLocaleLowerCase())) matches.push(file)
      }
    }
  }
  assert.deepEqual(matches, [])
})
