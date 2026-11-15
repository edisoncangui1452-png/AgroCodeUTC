import * as SunCalc from 'suncalc'

export const LUNAR_CALENDAR_YEAR = 2026
export const LUNAR_SAMPLE_HOUR_LOCAL = 12
export const LUNAR_PRINCIPAL_PHASE_TOLERANCE_HOURS = 13
const PHASE_SCAN_STEP_HOURS = 6
const PHASE_REFINEMENT_STEPS = 40
const PRINCIPAL_PHASES = [
  { key: 'new', position: 0, label: 'Luna nueva' },
  { key: 'first-quarter', position: 0.25, label: 'Cuarto creciente' },
  { key: 'full', position: 0.5, label: 'Luna llena' },
  { key: 'last-quarter', position: 0.75, label: 'Cuarto menguante' },
]

export function formatLocalDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function phaseAtCyclePosition(date, targetPosition) {
  const phase = SunCalc.getMoonIllumination(date).phase
  return phase + Math.round(targetPosition - phase)
}

function refinePrincipalPhaseTime(start, end, targetPosition) {
  let left = start.getTime()
  let right = end.getTime()
  for (let step = 0; step < PHASE_REFINEMENT_STEPS; step += 1) {
    const middle = (left + right) / 2
    const phase = phaseAtCyclePosition(new Date(middle), targetPosition)
    if (phase < targetPosition) left = middle
    else right = middle
  }
  return new Date((left + right) / 2)
}

/** Locate principal-phase instants by solving SunCalc's phase curve over the requested year. */
export function calculatePrincipalPhaseEvents(year = LUNAR_CALENDAR_YEAR) {
  if (!Number.isInteger(year)) return []
  const yearStart = new Date(year, 0, 1, 0, 0, 0, 0)
  const yearEnd = new Date(year + 1, 0, 1, 0, 0, 0, 0)
  const stepMilliseconds = PHASE_SCAN_STEP_HOURS * 60 * 60 * 1000
  let previousTime = yearStart
  let previousPhase = SunCalc.getMoonIllumination(previousTime).phase
  let unwrappedPhase = previousPhase
  const events = []

  for (let currentMilliseconds = previousTime.getTime() + stepMilliseconds; currentMilliseconds <= yearEnd.getTime(); currentMilliseconds += stepMilliseconds) {
    const currentTime = new Date(Math.min(currentMilliseconds, yearEnd.getTime()))
    const currentPhase = SunCalc.getMoonIllumination(currentTime).phase
    let phaseChange = currentPhase - previousPhase
    if (phaseChange < -0.5) phaseChange += 1
    else if (phaseChange > 0.5) phaseChange -= 1
    const nextUnwrappedPhase = unwrappedPhase + phaseChange

    let targetStep = Math.floor(unwrappedPhase * 4 + 1e-9) + 1
    while (targetStep / 4 <= nextUnwrappedPhase + 1e-10) {
      const targetPosition = targetStep / 4
      const time = refinePrincipalPhaseTime(previousTime, currentTime, targetPosition)
      if (time >= yearStart && time < yearEnd) {
        const phase = PRINCIPAL_PHASES[targetStep % PRINCIPAL_PHASES.length]
        const illumination = SunCalc.getMoonIllumination(time)
        events.push({
          date: formatLocalDateKey(time),
          key: phase.key,
          label: phase.label,
          principalPhaseLabel: phase.label,
          time,
          fraction: illumination.fraction,
          phase: illumination.phase,
          waxing: illumination.waxing,
          percentVisible: Math.round(illumination.fraction * 100),
        })
      }
      targetStep += 1
    }

    previousTime = currentTime
    previousPhase = currentPhase
    unwrappedPhase = nextUnwrappedPhase
    if (currentTime.getTime() === yearEnd.getTime()) break
  }

  return events
}

export function calculateLunarDay(year, monthIndex, day, principalEvent) {
  const sample = new Date(year, monthIndex, day, LUNAR_SAMPLE_HOUR_LOCAL, 0, 0, 0)
  if (sample.getFullYear() !== year || sample.getMonth() !== monthIndex || sample.getDate() !== day) return null
  const illumination = SunCalc.getMoonIllumination(sample)
  const date = formatLocalDateKey(sample)
  const event = principalEvent === undefined
    ? calculatePrincipalPhaseEvents(year).find(item => item.date === date) || null
    : principalEvent
  const eventWithinTolerance = event?.date === date
    && Math.abs(event.time.getTime() - sample.getTime()) <= LUNAR_PRINCIPAL_PHASE_TOLERANCE_HOURS * 60 * 60 * 1000

  return {
    date,
    fraction: illumination.fraction,
    phase: illumination.phase,
    waxing: illumination.waxing,
    percentVisible: Math.round(illumination.fraction * 100),
    principalPhase: eventWithinTolerance ? event.key : null,
    principalPhaseLabel: eventWithinTolerance ? event.label : null,
    event: eventWithinTolerance ? event : null,
  }
}

export function buildLunarYearData(year = LUNAR_CALENDAR_YEAR) {
  if (!Number.isInteger(year)) return {}
  const eventsByDate = new Map(calculatePrincipalPhaseEvents(year).map(event => [event.date, event]))
  const data = {}
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const days = new Date(year, monthIndex + 1, 0).getDate()
    for (let day = 1; day <= days; day += 1) {
      const lunarDay = calculateLunarDay(year, monthIndex, day, eventsByDate.get(formatLocalDateKey(new Date(year, monthIndex, day, LUNAR_SAMPLE_HOUR_LOCAL))) || null)
      if (lunarDay) data[lunarDay.date] = lunarDay
    }
  }
  return data
}

/** Builds Sunday-first rows and includes adjacent dates within 2026 for month context. */
export function buildLunarMonthRows(year, monthIndex, lunarData) {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return []
  const days = new Date(year, monthIndex + 1, 0).getDate()
  const firstSundayOffset = new Date(year, monthIndex, 1, LUNAR_SAMPLE_HOUR_LOCAL).getDay()
  const rowCount = Math.ceil((firstSundayOffset + days) / 7)
  const firstDay = 1 - firstSundayOffset

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const cells = Array.from({ length: 7 }, (_, weekdayIndex) => {
      const date = new Date(year, monthIndex, firstDay + rowIndex * 7 + weekdayIndex, LUNAR_SAMPLE_HOUR_LOCAL)
      if (date.getFullYear() !== year) return null
      const dateKey = formatLocalDateKey(date)
      const lunarDay = lunarData[dateKey]
      if (!lunarDay) return null
      return { ...lunarDay, day: date.getDate(), monthIndex: date.getMonth(), outsideMonth: date.getMonth() !== monthIndex }
    })
    return { key: `${year}-${monthIndex}-${rowIndex}`, cells }
  })
}

export function moveLunarDate(dateKey, offsetDays) {
  if (typeof dateKey !== 'string' || !Number.isInteger(offsetDays)) return null
  const [year, month, day] = dateKey.split('-').map(Number)
  if (year !== LUNAR_CALENDAR_YEAR || !month || !day) return null
  const date = new Date(year, month - 1, day, LUNAR_SAMPLE_HOUR_LOCAL)
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null
  date.setDate(date.getDate() + offsetDays)
  return date.getFullYear() === LUNAR_CALENDAR_YEAR ? formatLocalDateKey(date) : null
}
