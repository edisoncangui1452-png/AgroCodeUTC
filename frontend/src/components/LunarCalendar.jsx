import { useEffect, useMemo, useRef, useState } from 'react'
import { Apple, Bug, Carrot, ChevronLeft, ChevronRight, Droplets, Flower2, Leaf, Scissors, X } from 'lucide-react'
import {
  buildLunarMonthRows,
  buildLunarYearData,
  calculatePrincipalPhaseEvents,
  formatLocalDateKey,
  LUNAR_CALENDAR_YEAR,
  moveLunarDate,
} from '../lunarCalendar'
import { getLunarAgriculturalRule, LUNAR_AGRICULTURAL_RULES } from '../lunarAgriculturalRules'
import { translated } from '../preferences'

const MONTHS = [
  { name: 'ENERO', abbreviation: 'ENE' },
  { name: 'FEBRERO', abbreviation: 'FEB' },
  { name: 'MARZO', abbreviation: 'MAR' },
  { name: 'ABRIL', abbreviation: 'ABR' },
  { name: 'MAYO', abbreviation: 'MAY' },
  { name: 'JUNIO', abbreviation: 'JUN' },
  { name: 'JULIO', abbreviation: 'JUL' },
  { name: 'AGOSTO', abbreviation: 'AGO' },
  { name: 'SEPTIEMBRE', abbreviation: 'SEP' },
  { name: 'OCTUBRE', abbreviation: 'OCT' },
  { name: 'NOVIEMBRE', abbreviation: 'NOV' },
  { name: 'DICIEMBRE', abbreviation: 'DIC' },
]
const WEEKDAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
const MONTHS_EN = [
  { name: 'JANUARY', abbreviation: 'JAN' }, { name: 'FEBRUARY', abbreviation: 'FEB' },
  { name: 'MARCH', abbreviation: 'MAR' }, { name: 'APRIL', abbreviation: 'APR' },
  { name: 'MAY', abbreviation: 'MAY' }, { name: 'JUNE', abbreviation: 'JUN' },
  { name: 'JULY', abbreviation: 'JUL' }, { name: 'AUGUST', abbreviation: 'AUG' },
  { name: 'SEPTEMBER', abbreviation: 'SEP' }, { name: 'OCTOBER', abbreviation: 'OCT' },
  { name: 'NOVEMBER', abbreviation: 'NOV' }, { name: 'DECEMBER', abbreviation: 'DEC' },
]
const WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const lunarTextEn = {
  creciente: 'waxing', menguante: 'waning', 'Luna nueva': 'New moon', 'Luna llena': 'Full moon',
  'Cuarto creciente': 'First quarter', 'Cuarto menguante': 'Last quarter',
  'Luna Nueva': 'New Moon', Creciente: 'Waxing', 'Luna Llena': 'Full Moon', 'Cuarto Menguante': 'Last Quarter',
  'No sembrar / Descanso y preparación': 'Do not sow / Rest and prepare',
  'Siembra de hojas / Siembra de flores': 'Sow leafy crops / Sow flowers',
  'Cosecha general / Recolección': 'General harvest / Gathering',
  'Poda de formación / Control de plagas': 'Formative pruning / Pest control',
  Poda: 'Pruning', 'Siembra de Raíces': 'Sow root crops', 'Siembra de Hojas': 'Sow leafy crops',
  'Siembra de Flores': 'Sow flowers', Recolección: 'Harvest', 'Riego/Abonado': 'Watering/Fertilizing',
  'Control de Plagas': 'Pest control', 'Dato no disponible': 'Data unavailable',
}
function lunarText(text, language) {
  return language === 'en' ? (lunarTextEn[text] || text) : text
}
const ACTIVITY_ICONS = {
  scissors: Scissors,
  carrot: Carrot,
  leaf: Leaf,
  flower: Flower2,
  apple: Apple,
  droplets: Droplets,
  bug: Bug,
}

function moonPath(fraction, waxing) {
  const illumination = Math.max(0, Math.min(1, fraction))
  if (illumination < 0.001) return ''
  if (illumination > 0.999) return 'full'
  const edge = waxing ? 1 - 2 * illumination : 2 * illumination - 1
  const radius = Math.abs(edge) * 48
  const outerSweep = waxing ? 1 : 0
  const innerSweep = edge >= 0 ? 0 : 1
  const terminator = radius < 0.5
    ? 'L 50 2'
    : `A ${radius} 48 0 0 ${innerSweep} 50 2`
  return `M 50 2 A 48 48 0 0 ${outerSweep} 50 98 ${terminator} Z`
}

function MoonImage({ lunarDay, className = '', language = 'es' }) {
  const phaseName = lunarText(lunarDay.principalPhaseLabel || (lunarDay.waxing ? 'creciente' : 'menguante'), language)
  const label = translated(language, `Luna en fase ${phaseName}, ${lunarDay.percentVisible}% visible`, `Moon in ${phaseName} phase, ${lunarDay.percentVisible}% visible`)
  const imageClass = className ? `lunar-moon-image ${className}` : 'lunar-moon-image'
  const path = moonPath(lunarDay.fraction, lunarDay.waxing)
  return <svg className={imageClass} viewBox="0 0 100 100" role="img" aria-label={label}>
    <circle cx="50" cy="50" r="48" className="lunar-moon-shadow" />
    {path === 'full' ? <circle cx="50" cy="50" r="48" className="lunar-moon-lit" /> : path && <path d={path} className="lunar-moon-lit" />}
  </svg>
}

function LunarFarmIllustration() {
  return <svg className="lunar-farm-illustration" viewBox="0 0 240 140" aria-hidden="true" focusable="false">
    <circle cx="39" cy="28" r="15" className="lunar-farm-sun" />
    <path d="M0 91 52 55l40 31 49-42 99 55v41H0Z" className="lunar-farm-hill" />
    <path d="M0 107c42-22 72-17 113 2s82 13 127-8v39H0Z" className="lunar-farm-ground" />
    <path d="M31 97V69l25-20 28 20v29Z" className="lunar-farm-house" />
    <path d="m25 71 31-26 34 26" className="lunar-farm-roof" />
    <path d="M48 97V77h18v20M70 80h8v10h-8" className="lunar-farm-window" />
    <path d="M14 119c21-9 35-9 55 0m-48 10c21-8 36-8 58 0m65-12c22-8 40-7 61 1m-53 11c22-8 43-7 66 1" className="lunar-farm-row" />
    <circle cx="183" cy="51" r="8" className="lunar-farmer-head" />
    <path d="M172 49q11-14 22 0M176 60l-8 22 20 2-1-20m-12 19-4 17m13-16 8 16m-21-28-11 13m22-13 10 9" className="lunar-farmer-body" />
    <path d="m157 76-6 28m-4-1 10 2m32-48 10 5" className="lunar-farmer-tool" />
  </svg>
}

function eventText(event, language) {
  if (!event) return null
  const day = String(event.time.getDate()).padStart(2, '0')
  const month = (language === 'en' ? MONTHS_EN : MONTHS)[event.time.getMonth()].abbreviation
  const hour = String(event.time.getHours()).padStart(2, '0')
  const minute = String(event.time.getMinutes()).padStart(2, '0')
  return `${day} ${month} - ${hour}:${minute} ${lunarText(event.label, language).toLocaleUpperCase(language === 'en' ? 'en' : 'es')}`
}

export function LunarCalendar({ open, language = 'es', onClose, today = new Date() }) {
  const dialogRef = useRef(null)
  const pendingFocus = useRef(null)
  const todayKey = today.getFullYear() === LUNAR_CALENDAR_YEAR ? formatLocalDateKey(today) : null
  const [visibleMonth, setVisibleMonth] = useState(() => todayKey ? today.getMonth() : 0)
  const [selectedDate, setSelectedDate] = useState(() => todayKey)
  const lunarYear = useMemo(() => buildLunarYearData(LUNAR_CALENDAR_YEAR), [])
  const phaseEvents = useMemo(() => calculatePrincipalPhaseEvents(LUNAR_CALENDAR_YEAR), [])
  const rows = useMemo(() => buildLunarMonthRows(LUNAR_CALENDAR_YEAR, visibleMonth, lunarYear), [visibleMonth, lunarYear])
  const phaseGuideEvents = useMemo(() => Object.fromEntries(
    Object.values(LUNAR_AGRICULTURAL_RULES.phases).map(rule => [
      rule.principalPhaseKey,
      phaseEvents.find(event => event.key === rule.principalPhaseKey),
    ]),
  ), [phaseEvents])
  const month = (language === 'en' ? MONTHS_EN : MONTHS)[visibleMonth]
  const weekdays = language === 'en' ? WEEKDAYS_EN : WEEKDAYS
  const firstDate = `${LUNAR_CALENDAR_YEAR}-${String(visibleMonth + 1).padStart(2, '0')}-01`
  const focusDate = selectedDate?.startsWith(firstDate.slice(0, 7)) ? selectedDate : firstDate

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) dialog.showModal()
    if (!open && dialog?.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!pendingFocus.current) return
    document.getElementById(`lunar-date-${pendingFocus.current}`)?.focus()
    pendingFocus.current = null
  }, [selectedDate, visibleMonth])

  if (!open) return null

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close()
    onClose?.()
  }

  function chooseDate(dateKey, moveMonth = true) {
    setSelectedDate(dateKey)
    pendingFocus.current = dateKey
    if (moveMonth) setVisibleMonth(Number(dateKey.slice(5, 7)) - 1)
  }

  function onDayKeyDown(event, dateKey) {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (!(event.key in offsets)) return
    event.preventDefault()
    const nextDate = moveLunarDate(dateKey, offsets[event.key])
    if (nextDate) chooseDate(nextDate, true)
  }

  function navigateMonth(offset) {
    const nextMonth = Math.max(0, Math.min(11, visibleMonth + offset))
    if (nextMonth === visibleMonth) return
    const selectedDay = selectedDate ? Number(selectedDate.slice(8, 10)) : 1
    const daysInMonth = new Date(LUNAR_CALENDAR_YEAR, nextMonth + 1, 0).getDate()
    const nextDate = `${LUNAR_CALENDAR_YEAR}-${String(nextMonth + 1).padStart(2, '0')}-${String(Math.min(selectedDay, daysInMonth)).padStart(2, '0')}`
    setVisibleMonth(nextMonth)
    chooseDate(nextDate, false)
  }

  function goToToday() {
    if (todayKey) chooseDate(todayKey, true)
  }

  return <dialog ref={dialogRef} className="lunar-dialog" aria-labelledby="lunar-dialog-title" onCancel={event => { event.preventDefault(); closeDialog() }} onClick={event => { if (event.target === dialogRef.current) closeDialog() }}>
    <section className="lunar-dialog-card">
      <header className="lunar-farm-banner">
        <LunarFarmIllustration />
        <div className="lunar-farm-copy">
          <h2 id="lunar-dialog-title" aria-live="polite">{translated(language, 'CALENDARIO LUNAR AGRÍCOLA', 'AGRICULTURAL LUNAR CALENDAR')} - {month.name} {LUNAR_CALENDAR_YEAR}</h2>
          <p>{translated(language, 'Observa la Luna, trabaja la tierra y cosecha abundancia.', 'Observe the Moon, work the land, and harvest abundance.')}</p>
        </div>
      </header>

      <div className="lunar-month-toolbar" aria-label={translated(language, 'Navegación del calendario', 'Calendar navigation')}>
        <button type="button" className="lunar-nav-button" aria-label={translated(language, 'Mes anterior', 'Previous month')} onClick={() => navigateMonth(-1)} disabled={visibleMonth === 0}><ChevronLeft aria-hidden="true" /></button>
        <span className="lunar-current-month" aria-live="polite">{month.name} {LUNAR_CALENDAR_YEAR}</span>
        <button type="button" className="lunar-nav-button" aria-label={translated(language, 'Mes siguiente', 'Next month')} onClick={() => navigateMonth(1)} disabled={visibleMonth === 11}><ChevronRight aria-hidden="true" /></button>
        <button type="button" className="lunar-today-button" onClick={goToToday} disabled={!todayKey}>{translated(language, 'Hoy', 'Today')}</button>
        <button type="button" className="lunar-close-button" onClick={closeDialog} aria-label={translated(language, 'Cerrar calendario', 'Close calendar')}><X aria-hidden="true" /></button>
      </div>

      <div className="lunar-grid" role="grid" aria-label={`${month.name} ${LUNAR_CALENDAR_YEAR}`}>
        <div role="row" className="lunar-grid-row lunar-grid-head">
          {weekdays.map(day => <span role="columnheader" key={day}>{day}</span>)}
        </div>
        {rows.map(row => <div role="row" className="lunar-grid-row" key={row.key}>
          {row.cells.map((cell, weekdayIndex) => {
            if (!cell) return <span role="gridcell" aria-hidden="true" className="lunar-outside-day" key={`${row.key}-${weekdayIndex}`} />
            const rule = getLunarAgriculturalRule(cell)
            const eventLabel = eventText(cell.event, language)
            const monthLabel = cell.outsideMonth ? ` ${(language === 'en' ? MONTHS_EN : MONTHS)[cell.monthIndex].abbreviation}` : ''
            const caption = cell.principalPhase ? null : `${cell.percentVisible}% visible`
            const isToday = cell.date === todayKey
            const isSelected = cell.date === selectedDate
            const localizedRule = { ...rule, title: lunarText(rule.title, language), recommendation: lunarText(rule.recommendation, language), guide: lunarText(rule.guide, language) }
            const accessibleName = translated(language, `${cell.day} ${MONTHS[cell.monthIndex].name}, Luna ${cell.percentVisible}% visible.${eventLabel ? ` ${eventLabel}.` : ''} ${localizedRule.recommendation}.`, `${cell.day} ${(language === 'en' ? MONTHS_EN : MONTHS)[cell.monthIndex].name}, Moon ${cell.percentVisible}% visible.${eventLabel ? ` ${eventLabel}.` : ''} ${localizedRule.recommendation}.`)
            const visibleIcons = LUNAR_AGRICULTURAL_RULES.activityLegend.filter(item => rule.activityKeys.includes(item.key))
            return <button type="button" role="gridcell" id={`lunar-date-${cell.date}`} key={cell.date} className={`lunar-day-cell${cell.outsideMonth ? ' lunar-adjacent-month' : ''}${isSelected ? ' lunar-day-selected' : ''}${isToday ? ' lunar-day-today' : ''}`} aria-label={accessibleName} aria-selected={isSelected} aria-current={isToday ? 'date' : undefined} tabIndex={cell.date === focusDate ? 0 : -1} onClick={() => chooseDate(cell.date, cell.outsideMonth)} onKeyDown={event => onDayKeyDown(event, cell.date)}>
              <span className="lunar-date-number">{cell.day}{monthLabel && <span className="lunar-date-month">{monthLabel}</span>}</span>
              <MoonImage lunarDay={cell} language={language} />
              {caption && <span className="lunar-date-caption">{caption}</span>}
              {eventLabel && <span className="lunar-event-label">{eventLabel}</span>}
              <span className="lunar-recommendation">{localizedRule.recommendation}</span>
              {visibleIcons.length > 0 && <span className="lunar-activity-icons" aria-label={translated(language, 'Iconos de actividad', 'Activity icons')}>
                {visibleIcons.map(item => {
                  const Icon = ACTIVITY_ICONS[item.icon]
                  const isSupport = item.key === rule.supportIconKey
                  const activityLabel = lunarText(item.label, language)
                  const label = isSupport ? translated(language, `Actividad de apoyo: ${activityLabel}`, `Supporting activity: ${activityLabel}`) : activityLabel
                  return <span key={item.key} className={`lunar-activity-icon${isSupport ? ' lunar-support-icon' : ''}`} role="img" aria-label={label} title={label}><Icon aria-hidden="true" /></span>
                })}
              </span>}
            </button>
          })}
        </div>)}
      </div>

      <section className="lunar-phase-guide" aria-labelledby="lunar-phase-guide-title">
        <h3 id="lunar-phase-guide-title">{translated(language, 'Guía de fases lunares', 'Moon phase guide')}</h3>
        <div className="lunar-phase-guide-grid">
          {Object.entries(LUNAR_AGRICULTURAL_RULES.phases).map(([key, rule]) => {
            const representativeEvent = phaseGuideEvents[rule.principalPhaseKey]
            return <article className="lunar-phase-guide-card" key={key}>
              {representativeEvent && <MoonImage lunarDay={representativeEvent} className="lunar-guide-moon" language={language} />}
              <div><h4>{lunarText(rule.title, language)}</h4><p>{lunarText(rule.guide, language)}</p></div>
            </article>
          })}
        </div>
      </section>

      <section className="lunar-activity-legend" aria-labelledby="lunar-activity-legend-title">
        <h3 id="lunar-activity-legend-title">{translated(language, 'Leyenda de iconos', 'Icon legend')}</h3>
        <ul>
          {LUNAR_AGRICULTURAL_RULES.activityLegend.map(item => {
            const Icon = ACTIVITY_ICONS[item.icon]
            return <li key={item.key}><Icon aria-hidden="true" /><span>{lunarText(item.label, language)}</span></li>
          })}
        </ul>
      </section>

      <p className="lunar-source-note">{translated(language, 'Fases calculadas con SunCalc 2.1.4. Las recomendaciones son prácticas tradicionales según la fase lunar, no son datos de NASA POWER ni de NASA GIBS y no sustituyen asesoría agronómica.', 'Phases are calculated with SunCalc 2.1.4. Recommendations are traditional practices associated with lunar phases, not NASA POWER or NASA GIBS data, and do not replace agronomic advice.')}</p>
    </section>
  </dialog>
}
