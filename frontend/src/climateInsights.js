export const CLIMATE_VARIABLES = [
  { key: 'T2M', es: 'Temperatura media', en: 'Mean temperature', icon: 'temperature' },
  { key: 'T2M_MAX', es: 'Temperatura máxima', en: 'Maximum temperature', icon: 'temperature' },
  { key: 'T2M_MIN', es: 'Temperatura mínima', en: 'Minimum temperature', icon: 'temperature' },
  { key: 'PRECTOTCORR', es: 'Lluvia', en: 'Rain', icon: 'rain' },
  { key: 'RH2M', es: 'Humedad', en: 'Humidity', icon: 'humidity' },
  { key: 'ALLSKY_SFC_SW_DWN', es: 'Radiación solar', en: 'Solar radiation', icon: 'sun' },
  { key: 'WS2M', es: 'Velocidad del viento', en: 'Wind speed', icon: 'wind' },
]

export function getObservedPeriod(coverage = {}) {
  const observed = Object.values(coverage)
    .filter(item => item?.first_valid_date && item?.last_valid_date)
  if (!observed.length) return null
  return {
    start: observed.map(item => item.first_valid_date).sort()[0],
    end: observed.map(item => item.last_valid_date).sort().at(-1),
  }
}

export function toggleAdvancedMode(open) {
  return !open
}
