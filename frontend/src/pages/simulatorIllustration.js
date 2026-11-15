// Educational storyboards, NOT crop models. The frames are not calibrated phenology.
// Where phase 3 has an external harvest interval, its upper limit bounds the
// display scale only. It is never treated as a predicted harvest or stage date.
export const illustrationFrames = {
  cilantro: ['siembra', 'germinacion', 'emergencia', 'crecimiento_inicial', 'desarrollo_vegetativo', 'desarrollo_vegetativo', 'desarrollo_avanzado'],
  rabano: ['siembra', 'emergencia', 'crecimiento_inicial', 'desarrollo_vegetativo', 'desarrollo_avanzado', 'desarrollo_avanzado', 'desarrollo_avanzado'],
  rucula: ['siembra', 'germinacion', 'emergencia', 'crecimiento_inicial', 'desarrollo_vegetativo', 'desarrollo_avanzado', 'desarrollo_avanzado'],
  lechuga_hoja: ['siembra', 'germinacion', 'germinacion', 'emergencia', 'crecimiento_inicial', 'desarrollo_vegetativo', 'desarrollo_avanzado'],
  espinaca: ['siembra', 'germinacion', 'emergencia', 'emergencia', 'crecimiento_inicial', 'desarrollo_vegetativo', 'desarrollo_avanzado'],
}

export function illustrationForPeriod(result, period) {
  if (!period || result.weather.information_type === 'historical') return { stage: null, reason: 'Sin pronóstico futuro utilizable; no se dibuja una evolución.' }
  const frames = illustrationFrames[result.crop.id]
  const planted = Date.parse(`${result.planted_on}T00:00:00Z`)
  const end = Date.parse(`${period.period_end}T00:00:00Z`)
  if (!frames || !Number.isFinite(planted) || !Number.isFinite(end)) {
    return { stage: null, reason: 'Faltan especie o fechas válidas para el guion visual.' }
  }
  const first = result.results?.[0]
  const firstEnd = first && Date.parse(`${first.period_end}T00:00:00Z`)
  // A short forecast is not evidence of daily phenological transitions.
  const ageDays = Math.max(0, Math.round(((result.horizon_days === 45 ? end : firstEnd) - planted) / 86400000))
  const upperReference = result.crop.indicative_days?.[1]
  const visualSpan = Number.isFinite(upperReference) && upperReference > 0 ? upperReference : 45
  const frame = Math.min(frames.length - 1, Math.max(0, Math.ceil((ageDays + 1) * frames.length / visualSpan) - 1))
  return {
    stage: frames[frame],
    frame,
    reason: upperReference
      ? 'Guion visual no calibrado; el rango bibliográfico solo orienta la escala, no asigna etapas reales ni confirma cosecha.'
      : 'Guion visual demostrativo sin duración de ciclo validada; la escala de 45 días no predice etapas reales.',
  }
}

export function visualStageForPeriod(result, period, mode) {
  if (result.weather.information_type === 'historical' || !period) return null
  if (mode === 'illustrative') return illustrationForPeriod(result, period).stage
  return ['observacion_confirmada', 'observacion_en_periodo_no_proyeccion'].includes(period.stage_source)
    ? period.stage : null
}
