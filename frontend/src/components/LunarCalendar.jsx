import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { buildLunarMonthRows, buildLunarYearData, formatLocalDateKey, LUNAR_CALENDAR_YEAR, moveLunarDate } from '../lunarCalendar'
import { translated } from '../preferences'

const MONTHS = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
const PHASE_LABELS = {
  new: ['Luna nueva', 'New moon'],
  'first-quarter': ['Cuarto creciente', 'First quarter'],
  full: ['Luna llena', 'Full moon'],
  'last-quarter': ['Cuarto menguante', 'Last quarter'],
}
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

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

function MoonImage({ lunarDay, phaseLabel }) {
  const description = phaseLabel || (lunarDay.waxing ? 'creciente' : 'menguante')
  const accessibleLabel = `Luna en fase ${description}, ${lunarDay.percentVisible}% visible`
  const path = moonPath(lunarDay.fraction, lunarDay.waxing)
  return <svg className="lunar-moon-image" viewBox="0 0 100 100" role="img" aria-label={accessibleLabel}>
    <circle cx="50" cy="50" r="48" className="lunar-moon-shadow" />
    {path === 'full' ? <circle cx="50" cy="50" r="48" className="lunar-moon-lit" /> : path && <path d={path} className="lunar-moon-lit" />}
  </svg>
}

export function LunarCalendar({ open, language = 'es', onClose, today = new Date() }) {
  const dialogRef = useRef(null)
  const pendingFocus = useRef(null)
  const english = language === 'en'
  const locale = english ? 'en' : 'es'
  const monthNames = MONTHS[locale]
  const todayInYear = today.getFullYear() === LUNAR_CALENDAR_YEAR
  const todayKey = todayInYear ? formatLocalDateKey(today) : null
  const [visibleMonth, setVisibleMonth] = useState(() => todayInYear ? today.getMonth() : 0)
  const [selectedDate, setSelectedDate] = useState(() => todayKey)
  const lunarYear = useMemo(() => buildLunarYearData(LUNAR_CALENDAR_YEAR), [])
  const rows = useMemo(() => buildLunarMonthRows(LUNAR_CALENDAR_YEAR, visibleMonth, lunarYear), [visibleMonth, lunarYear])
  const monthName = monthNames[visibleMonth]
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
    if (nextDate) chooseDate(nextDate)
  }

  function navigateMonth(offset) {
    setVisibleMonth(month => Math.max(0, Math.min(11, month + offset)))
  }

  function goToToday() {
    if (!todayKey) return
    chooseDate(todayKey)
  }

  return <dialog ref={dialogRef} className="lunar-dialog" aria-labelledby="lunar-dialog-title" onCancel={event => { event.preventDefault(); closeDialog() }} onClick={event => { if (event.target === dialogRef.current) closeDialog() }}>
    <section className="lunar-dialog-card">
      <header className="lunar-month-banner">
        <button type="button" className="lunar-nav-button" aria-label={translated(language, 'Mes anterior', 'Previous month')} onClick={() => navigateMonth(-1)} disabled={visibleMonth === 0}><ChevronLeft aria-hidden="true" /></button>
        <h2 id="lunar-dialog-title" aria-live="polite">{monthName} {LUNAR_CALENDAR_YEAR}</h2>
        <button type="button" className="lunar-nav-button" aria-label={translated(language, 'Mes siguiente', 'Next month')} onClick={() => navigateMonth(1)} disabled={visibleMonth === 11}><ChevronRight aria-hidden="true" /></button>
        <button type="button" className="lunar-today-button" onClick={goToToday} disabled={!todayKey}>{translated(language, 'Hoy', 'Today')}</button>
        <button type="button" className="lunar-close-button" onClick={closeDialog} aria-label={translated(language, 'Cerrar calendario', 'Close calendar')}><X aria-hidden="true" /></button>
      </header>
      <div className="lunar-grid" role="grid" aria-label={`${monthName} ${LUNAR_CALENDAR_YEAR}`}>
        <div role="row" className="lunar-grid-row lunar-grid-head">
          <span role="columnheader">Semana</span>
          {WEEKDAYS.map(day => <span role="columnheader" key={day}>{day}</span>)}
        </div>
        {rows.map(row => <div role="row" className="lunar-grid-row" key={`${visibleMonth}-${row.week}-${row.cells[0]?.date || 'week'}`}>
          <span role="rowheader" className="lunar-week-number">{row.week}</span>
          {row.cells.map((cell, weekdayIndex) => {
            if (!cell) return <span role="gridcell" aria-hidden="true" className="lunar-outside-day" key={`${row.week}-${weekdayIndex}`} />
            const phaseLabel = cell.principalPhase ? PHASE_LABELS[cell.principalPhase][english ? 1 : 0] : null
            const caption = phaseLabel || `${cell.percentVisible}% ${translated(language, 'visible', 'visible')}`
            const isToday = cell.date === todayKey
            const isSelected = cell.date === selectedDate
            const accessibleName = `${cell.day} ${monthName}, ${caption}`
            return <button type="button" role="gridcell" id={`lunar-date-${cell.date}`} key={cell.date} className={`lunar-day-cell${isSelected ? ' lunar-day-selected' : ''}${isToday ? ' lunar-day-today' : ''}`} aria-label={accessibleName} aria-selected={isSelected} aria-current={isToday ? 'date' : undefined} tabIndex={cell.date === focusDate ? 0 : -1} onClick={() => chooseDate(cell.date, false)} onKeyDown={event => onDayKeyDown(event, cell.date)}>
              <span className="lunar-date-number">{cell.day}</span>
              <MoonImage lunarDay={cell} phaseLabel={phaseLabel || (cell.waxing ? (english ? 'waxing' : 'creciente') : (english ? 'waning' : 'menguante'))} />
              <span className="lunar-date-caption">{caption}</span>
            </button>
          })}
        </div>)}
      </div>
      <p className="lunar-source-note">Fases calculadas con SunCalc 2.1.4. No son datos de NASA POWER ni de NASA GIBS.</p>
    </section>
  </dialog>
}
