import * as SunCalc from 'suncalc'

export const LUNAR_CALENDAR_YEAR = 2026
export const LUNAR_SAMPLE_HOUR_LOCAL = 12
export const LUNAR_PRINCIPAL_PHASE_TOLERANCE_DAYS = 0.5
const SYNODIC_MONTH_DAYS = 29.530588853
const PRINCIPAL_PHASES = [
  { key: 'new', position: 0, es: 'Luna nueva' },
  { key: 'first-quarter', position: 0.25, es: 'Cuarto creciente' },
  { key: 'full', position: 0.5, es: 'Luna llena' },
  { key: 'last-quarter', position: 0.75, es: 'Cuarto menguante' },
]

export function formatLocalDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function nearestPrincipalPhase(phase) {
  let nearest = null
  let distance = Infinity
  for (const candidate of PRINCIPAL_PHASES) {
    const directDistance = Math.abs(phase - candidate.position)
    const cyclicDistance = Math.min(directDistance, 1 - directDistance)
    if (cyclicDistance < distance) {
      nearest = candidate
      distance = cyclicDistance
    }
  }
  return distance * SYNODIC_MONTH_DAYS <= LUNAR_PRINCIPAL_PHASE_TOLERANCE_DAYS ? nearest : null
}

export function calculateLunarDay(year, monthIndex, day) {
  const sample = new Date(year, monthIndex, day, LUNAR_SAMPLE_HOUR_LOCAL, 0, 0, 0)
  const illumination = SunCalc.getMoonIllumination(sample)
  const principalPhase = nearestPrincipalPhase(illumination.phase)
  return {
    date: formatLocalDateKey(sample),
    fraction: illumination.fraction,
    phase: illumination.phase,
    waxing: illumination.waxing,
    percentVisible: Math.round(illumination.fraction * 100),
    principalPhase: principalPhase?.key || null,
    principalPhaseLabel: principalPhase?.es || null,
  }
}

export function buildLunarYearData(year = LUNAR_CALENDAR_YEAR) {
  if (!Number.isInteger(year)) return {}
  const data = {}
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const days = new Date(year, monthIndex + 1, 0).getDate()
    for (let day = 1; day <= days; day += 1) {
      const lunarDay = calculateLunarDay(year, monthIndex, day)
      data[lunarDay.date] = lunarDay
    }
  }
  return data
}

export function getIsoWeekNumber(date) {
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  return Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7)
}

export function buildLunarMonthRows(year, monthIndex, lunarData) {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return []
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()
  const firstMondayOffset = (firstWeekday + 6) % 7
  const firstDay = 1 - firstMondayOffset
  const rowCount = Math.ceil((firstMondayOffset + days) / 7)

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const rowStart = firstDay + rowIndex * 7
    const thursday = new Date(Date.UTC(year, monthIndex, rowStart + 3))
    const week = getIsoWeekNumber(thursday)
    const cells = Array.from({ length: 7 }, (_, weekdayIndex) => {
      const day = rowStart + weekdayIndex
      if (day < 1 || day > days) return null
      const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { ...(lunarData[date] || {}), date, day }
    })
    return { week, cells }
  })
}

export function moveLunarDate(dateKey, offsetDays) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day, LUNAR_SAMPLE_HOUR_LOCAL)
  date.setDate(date.getDate() + offsetDays)
  return date.getFullYear() === LUNAR_CALENDAR_YEAR ? formatLocalDateKey(date) : null
}
