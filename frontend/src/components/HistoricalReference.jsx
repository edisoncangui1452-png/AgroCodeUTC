import { useState } from 'react'
import { CalendarRange, RefreshCcw } from 'lucide-react'
import { api, errorMessage } from '../api'
import { translated, usePreferences } from '../preferences'

export default function HistoricalReference({ parcelId }) {
  const { language } = usePreferences()
  const t = (es, en) => translated(language, es, en)
  const monthFormatter = new Intl.DateTimeFormat(language === 'en' ? 'en' : 'es', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const fmt = (value, unit) => value === null || value === undefined ? t('Sin datos suficientes', 'Not enough data') : `${value}${unit}`
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function load() {
    setBusy(true); setError('')
    try {
      const { data: result } = await api.get(`parcels/${parcelId}/historical-baseline/`)
      setData(result)
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  const now = new Date()
  const upcoming = data?.months ? Array.from({ length: 12 }, (_, offset) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1))
    return { date, row: data.months[date.getUTCMonth()] }
  }) : []
  return <section className="panel mt-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><div className="flex items-center gap-2 text-leaf"><CalendarRange size={19} /><span className="text-xs font-bold uppercase tracking-widest">{t('Serie de largo plazo', 'Long-term series')}</span></div><h2 className="mt-2 font-display text-xl font-bold">{t('Referencia climática', 'Climate reference')} 1983–2025</h2><p className="mt-2 max-w-2xl text-sm text-muted">{t('Estimados y frecuencias observadas de meses equivalentes. No son probabilidades para fechas futuras ni un pronóstico.', 'Estimates and observed frequencies for equivalent months. They are not probabilities for future dates or a forecast.')}</p></div>
      <button className="button button-outline" title={t('Consulta la serie mensual NASA POWER de 1983 a 2025 para esta parcela; puede demorar.', 'Query the NASA POWER monthly series from 1983 to 2025 for this parcel; this may take a while.')} disabled={busy} onClick={load}><RefreshCcw size={16} /> {busy ? t('Consultando serie…', 'Querying series…') : t('Consultar serie histórica', 'Query historical series')}</button>
    </div>
    {error && <p role="alert" className="notice mt-4">{error}</p>}
    {data && <>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-paper p-4"><strong>{t('Próximos días', 'Coming days')}</strong><p className="mt-2 text-sm text-muted">{t('Sin pronóstico diario conectado. La historia mensual no permite estimar el tiempo de mañana ni la probabilidad de helada.', 'No daily forecast is connected. Monthly history cannot estimate tomorrow’s weather or the chance of frost.')}</p></div>
        <div className="rounded-xl bg-paper p-4"><strong>{t('Meses equivalentes', 'Equivalent months')}</strong><p className="mt-2 text-sm text-muted">{t('Medianas y rangos de la misma estación entre 1983 y 2025; no predicción de un mes concreto.', 'Medians and ranges for the same season from 1983 to 2025; not a prediction for a specific month.')}</p></div>
        <div className="rounded-xl bg-paper p-4"><strong>{t('Próximos años', 'Coming years')}</strong><p className="mt-2 text-sm text-muted">{t('Sin proyección climática validada. No se extrapolan 43 años como pronóstico futuro.', 'No validated climate projection is available. The 43-year record is not extrapolated as a future forecast.')}</p></div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{upcoming.map(({ date, row }) => <article className="rounded-xl border border-line p-4" key={date.toISOString()}>
        <h3 className="font-display font-bold capitalize">{monthFormatter.format(date)}</h3>
        <p className="mt-1 text-xs text-muted">{row.temperature_c?.observations || 0} {t('años con temperatura válida · referencia histórica', 'years with valid temperature · historical reference')}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="text-xs text-muted">{t('Temperatura estimada*', 'Estimated temperature*')}</span><strong className="block">{fmt(row.temperature_c?.median, ' °C')}</strong><span className="text-xs text-muted">{row.temperature_c && `${row.temperature_c.p10}–${row.temperature_c.p90} °C (P10–P90)`}</span></div><div><span className="text-xs text-muted">{t('Lluvia estimada*', 'Estimated rainfall*')}</span><strong className="block">{fmt(row.rain_mm?.median, ' mm')}</strong><span className="text-xs text-muted">{row.rain_mm && `${row.rain_mm.p10}–${row.rain_mm.p90} mm (P10–P90)`}</span></div></div>
        <div className="mt-4 space-y-1 border-t border-line pt-3 text-xs"><p>{t('Meses con lluvia ≥100 mm', 'Months with rainfall ≥100 mm')}: <strong>{fmt(row.rain_ge_100mm_frequency_percent, ' %')}</strong></p><p>{t('Meses con temperatura media <10 °C', 'Months with mean temperature <10 °C')}: <strong>{fmt(row.temperature_below_10c_frequency_percent, ' %')}</strong></p><p>{t('Meses con media de mínimas diarias <0 °C', 'Months with mean daily minimum below 0 °C')}: <strong>{fmt(row.monthly_mean_min_below_zero_frequency_percent, ' %')}</strong></p></div>
      </article>)}</div>
      <p className="mt-5 text-xs leading-relaxed text-muted">{t('* «Estimado» significa mediana de meses históricos, no valor esperado para una fecha futura. Las frecuencias son porcentajes de meses observados que superaron cada umbral (con al menos 30 años válidos); no probabilidades predictivas. Precipitación mensual calculada a partir de mm/día × días del mes.', '* “Estimate” means the median of historical months, not an expected value for a future date. Frequencies are percentages of observed months that exceeded each threshold (with at least 30 valid years); they are not predictive probabilities. Monthly rainfall is calculated from mm/day × days in the month.')} {data.notice} {data.cached ? t('Serie recuperada de caché.', 'Series retrieved from cache.') : ''}</p>
    </>}
  </section>
}
