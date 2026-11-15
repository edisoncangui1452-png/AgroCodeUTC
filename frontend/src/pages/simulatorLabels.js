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

export const labelStage = code => stageLabels[code] || 'Etapa no confirmada'
export const labelStageSource = code => stageSourceLabels[code] || 'No hay una observación confirmada para este período.'
export const labelCondition = code => conditionLabels[code] || 'No hay información suficiente para evaluar esta condición con precisión.'
export const labelRisk = code => riskLabels[code] || 'Riesgo no especificado'
export const labelRiskStatus = code => riskStatusLabels[code] || 'estado sin confirmar'
export const labelInformation = code => informationLabels[code] || 'Tipo de información no disponible'
export const labelMissing = code => missingLabels[code] || 'variable meteorológica sin identificar'

export function labelWarning(warning) {
  return Object.entries(missingLabels).reduce(
    (text, [code, label]) => text.replaceAll(code, label), warning,
  )
}
