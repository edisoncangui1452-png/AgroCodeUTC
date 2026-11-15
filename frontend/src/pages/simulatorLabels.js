// Presentation only: the API keeps its stable machine-readable codes.
export const stageLabels = {
  siembra: 'Siembra',
  germinacion: 'Germinación',
  emergencia: 'Emergencia',
  crecimiento_inicial: 'Crecimiento inicial',
  desarrollo_vegetativo: 'Desarrollo vegetativo',
  desarrollo_avanzado: 'Desarrollo avanzado',
  posible_cosecha: 'Posible cosecha',
}

export const stageSourceLabels = {
  observacion_confirmada: 'Etapa registrada mediante una observación de campo en esta fecha.',
  observacion_en_periodo_no_proyeccion: 'Hay una observación registrada dentro de este bloque; no confirma toda la semana.',
  ultima_observacion_no_reconfirmada: 'Esta etapa se basa en la última observación registrada y todavía no ha sido confirmada para este período.',
  fecha_de_siembra: 'La fecha de siembra está registrada; no se ha observado una etapa de desarrollo.',
  no_determinada: 'No hay una etapa de desarrollo confirmada para este período.',
  demostrativo: 'Etapa exclusivamente ilustrativa; no procede de una observación ni del motor agrícola.',
}

export const conditionLabels = {
  sin_umbral_validado: 'No hay información suficiente para evaluar esta condición con precisión.',
  no_determinable: 'No se puede determinar con los datos disponibles.',
  sin_alerta_de_calor: 'No se identificó una alerta de calor con los criterios disponibles.',
  alerta_calor: 'Posible alerta de calor; no confirma daño.',
  sin_datos: 'No hay datos suficientes para evaluar esta condición.',
  suelo_seco_observado: 'Suelo seco registrado en la fecha de observación.',
  encharcamiento_observado: 'Encharcamiento registrado en la fecha de observación.',
  antecedente_no_reconfirmado: 'Se registró una condición anterior, sin confirmar para este período.',
}

export const riskLabels = {
  calor: 'Posible calor',
  falta_agua: 'Suelo seco registrado',
  exceso_humedad: 'Encharcamiento registrado',
}

export const riskStatusLabels = {
  posible: 'posible',
  observado_en_fecha: 'observado en fecha',
  antecedente_no_reconfirmado: 'antecedente, no confirmado ahora',
}

export const informationLabels = {
  forecast: 'Pronóstico meteorológico',
  subseasonal_forecast: 'Escenario subestacional por semanas',
  historical: 'Referencia histórica; no pronóstico',
}

export const missingLabels = {
  temperature_min_c: 'temperatura mínima',
  temperature_mean_c: 'temperatura media',
  temperature_max_c: 'temperatura máxima',
  precipitation_mm: 'precipitación',
  relative_humidity_air_percent: 'humedad del aire',
  solar_radiation_mj_m2: 'radiación solar',
  soil_moisture_model_percent: 'humedad del suelo estimada',
}

const stageLabelsEn = {
  siembra: 'Planting',
  germinacion: 'Germination',
  emergencia: 'Emergence',
  crecimiento_inicial: 'Early growth',
  desarrollo_vegetativo: 'Vegetative growth',
  desarrollo_avanzado: 'Advanced growth',
  posible_cosecha: 'Possible harvest',
}
const stageSourceLabelsEn = {
  observacion_confirmada: 'Stage recorded through a field observation on this date.',
  observacion_en_periodo_no_proyeccion: 'An observation was recorded within this block; it does not confirm the entire week.',
  ultima_observacion_no_reconfirmada: 'This stage is based on the last recorded observation and has not been reconfirmed for this period.',
  fecha_de_siembra: 'The planting date is recorded; no growth stage has been observed.',
  no_determinada: 'No growth stage has been confirmed for this period.',
  demostrativo: 'Illustrative stage only; not based on an observation or the crop model.',
}
const conditionLabelsEn = {
  sin_umbral_validado: 'There is not enough information to assess this condition accurately.',
  no_determinable: 'Cannot be determined from the available data.',
  sin_alerta_de_calor: 'No heat alert was identified using the available criteria.',
  alerta_calor: 'Possible heat alert; this does not confirm damage.',
  sin_datos: 'There is not enough data to assess this condition.',
  suelo_seco_observado: 'Dry soil recorded on the observation date.',
  encharcamiento_observado: 'Waterlogging recorded on the observation date.',
  antecedente_no_reconfirmado: 'A prior condition was recorded but has not been reconfirmed for this period.',
}
const riskLabelsEn = { calor: 'Possible heat', falta_agua: 'Dry soil recorded', exceso_humedad: 'Waterlogging recorded' }
const riskStatusLabelsEn = { posible: 'possible', observado_en_fecha: 'observed on date', antecedente_no_reconfirmado: 'prior record, not confirmed now' }
const informationLabelsEn = {
  forecast: 'Weather forecast',
  subseasonal_forecast: 'Weekly subseasonal scenario',
  historical: 'Historical reference; not a forecast',
}
const missingLabelsEn = {
  temperature_min_c: 'minimum temperature',
  temperature_mean_c: 'mean temperature',
  temperature_max_c: 'maximum temperature',
  precipitation_mm: 'precipitation',
  relative_humidity_air_percent: 'air humidity',
  solar_radiation_mj_m2: 'solar radiation',
  soil_moisture_model_percent: 'estimated soil moisture',
}

export const labelStage = (code, language = 'es') => (language === 'en' ? stageLabelsEn[code] : stageLabels[code]) || (language === 'en' ? 'Unconfirmed stage' : 'Etapa no confirmada')
export const labelStageSource = (code, language = 'es') => (language === 'en' ? stageSourceLabelsEn[code] : stageSourceLabels[code]) || (language === 'en' ? 'No confirmed observation for this period.' : 'No hay una observación confirmada para este período.')
export const labelCondition = (code, language = 'es') => (language === 'en' ? conditionLabelsEn[code] : conditionLabels[code]) || (language === 'en' ? 'There is not enough information to assess this condition accurately.' : 'No hay información suficiente para evaluar esta condición con precisión.')
export const labelRisk = (code, language = 'es') => (language === 'en' ? riskLabelsEn[code] : riskLabels[code]) || (language === 'en' ? 'Unspecified risk' : 'Riesgo no especificado')
export const labelRiskStatus = (code, language = 'es') => (language === 'en' ? riskStatusLabelsEn[code] : riskStatusLabels[code]) || (language === 'en' ? 'unconfirmed status' : 'estado sin confirmar')
export const labelInformation = (code, language = 'es') => (language === 'en' ? informationLabelsEn[code] : informationLabels[code]) || (language === 'en' ? 'Information type unavailable' : 'Tipo de información no disponible')
export const labelMissing = (code, language = 'es') => (language === 'en' ? missingLabelsEn[code] : missingLabels[code]) || (language === 'en' ? 'unidentified weather variable' : 'variable meteorológica sin identificar')

export function labelWarning(warning, language = 'es') {
  const labels = language === 'en' ? missingLabelsEn : missingLabels
  return Object.entries(missingLabels).reduce(
    (text, [code]) => text.replaceAll(code, labels[code]), warning,
  )
}
