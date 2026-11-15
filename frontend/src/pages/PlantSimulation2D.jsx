import { useId, useState } from 'react'
import { shortCycleCrops } from './simulatorOptions'
import { illustrationForPeriod, visualStageForPeriod } from './simulatorIllustration'
import {
  labelInformation, labelMissing, labelRisk, labelRiskStatus, labelStage, labelStageSource,
} from './simulatorLabels'

const stageSizes = {
  emergencia: [2, 0.42],
  crecimiento_inicial: [3, 0.62],
  desarrollo_vegetativo: [4, 0.83],
  desarrollo_avanzado: [5, 1],
  posible_cosecha: [5, 1.08],
}

const leafPaths = {
  cilantro: 'M 0 -6 Q -6 -18 -9 -28 Q -23 -26 -20 -37 Q -14 -41 -18 -45 Q -28 -52 -17 -55 Q -10 -54 -12 -59 Q -13 -70 -2 -66 Q 1 -63 3 -70 Q 15 -72 13 -61 Q 11 -57 18 -56 Q 28 -53 19 -46 Q 14 -43 22 -38 Q 24 -27 9 -29 Q 6 -18 0 -6 Z',
  rabano: 'M 0 -5 Q -10 -19 -14 -32 L -24 -39 L -18 -47 L -27 -53 L -15 -57 L -19 -65 Q -11 -70 -5 -65 Q 4 -82 12 -66 L 21 -68 L 18 -56 L 27 -50 L 19 -41 L 23 -33 Q 10 -28 0 -5 Z',
  rucula: 'M 0 -4 Q -7 -17 -9 -27 L -21 -31 L -16 -39 L -23 -44 L -13 -50 L -20 -55 L -9 -60 Q -5 -75 0 -81 Q 7 -72 10 -60 L 20 -55 L 13 -50 L 23 -44 L 16 -39 L 21 -31 L 9 -27 Q 7 -16 0 -4 Z',
  lechuga_hoja: 'M 0 -5 Q -23 -16 -29 -36 Q -36 -49 -23 -58 Q -26 -70 -14 -67 Q -7 -79 1 -68 Q 15 -76 19 -65 Q 34 -65 29 -52 Q 40 -43 27 -33 Q 22 -17 0 -5 Z',
  espinaca: 'M 0 -4 Q -17 -22 -21 -47 Q -17 -71 0 -78 Q 20 -68 23 -48 Q 19 -24 0 -4 Z',
}

const leafAngles = [-48, 38, -23, 23, 0]

function LeafShape({ crop, index, color, droop }) {
  const angle = leafAngles[index]
  const tilt = droop ? (angle < 0 ? -11 : 11) : 0
  return <g className="plant-2d-leaf" transform={`rotate(${angle + tilt})`}>
    <path d={leafPaths[crop]} fill={color} stroke="#245a3b" strokeWidth="2" strokeLinejoin="round" />
    <path d="M 0 -6 Q -3 -35 0 -61" fill="none" stroke="#def3d8" strokeWidth="1.5" opacity=".7" />
  </g>
}

export function PlantSimulation2D({
  crop, stage = null, risks = [], informationType = 'forecast',
  isIllustrative = true, selectedPeriod = null, stageSource = 'no_determinada', missing = [],
  displayMode = 'observed',
}) {
  const titleId = useId()
  const descriptionId = useId()
  const cropName = shortCycleCrops.find(item => item.id === crop)?.name || 'Cultivo no identificado'
  const activeRisks = risks.filter(risk => risk.status !== 'antecedente_no_reconfirmado')
  const codes = activeRisks.map(risk => risk.code)
  const dry = codes.includes('falta_agua')
  const wet = codes.includes('exceso_humedad')
  const heat = codes.includes('calor')
  const limited = !stage || informationType === 'historical'
  const [leaves, size] = stageSizes[stage] || [0, 0]
  const leafColor = heat || dry ? '#9bad64' : '#419768'
  const soilColor = wet ? '#537478' : dry ? '#c5a079' : '#947e65'
  const caption = displayMode === 'illustrative' && !limited
    ? 'Viñeta demostrativa: no representa una etapa observada ni una predicción del motor agrícola.'
    : limited ? 'Etapa no confirmada: se muestra un símbolo neutro, no una planta observada.'
      : labelStageSource(stageSource)
  const type = labelInformation(informationType)
  const period = selectedPeriod?.period_start
    ? selectedPeriod.period_start === selectedPeriod.period_end
      ? selectedPeriod.period_start
      : `${selectedPeriod.period_start} al ${selectedPeriod.period_end}`
    : null

  return <figure className="plant-2d rounded-xl border border-line bg-white p-4 sm:p-5" data-crop={crop} data-stage={limited ? 'no_confirmada' : stage} data-mode={displayMode} data-risks={codes.join(',')}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h4 className="font-bold text-ink">{cropName} · {limited ? 'Etapa no confirmada' : `${labelStage(stage)} (${displayMode === 'illustrative' ? 'ilustrativa' : 'observada'})`}</h4>
        <p className="text-xs text-muted">{type}{period ? ` · ${period}` : ''}</p>
      </div>
      <span className="rounded-full border border-line bg-paper px-2 py-1 text-xs font-semibold">Ilustración 2D</span>
    </div>
    <svg className="plant-2d-canvas mt-4 w-full rounded-xl" viewBox="0 0 320 260" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
      <title id={titleId}>{`Ilustración de ${cropName}: ${limited ? 'etapa no confirmada' : labelStage(stage) + (displayMode === 'illustrative' ? ' ilustrativa' : ' observada')}`}</title>
      <desc id={descriptionId}>{`${type}. ${caption} ${codes.length ? `Indicadores: ${codes.map(labelRisk).join(', ')}.` : 'Sin alertas activas identificadas.'}`}</desc>
      <rect width="320" height="260" rx="16" fill="#edf7ef" />
      <circle cx="267" cy="42" r="24" fill={heat ? '#f6b66d' : '#fff6ce'} opacity=".8" />
      <path d="M 0 188 Q 80 181 160 190 Q 240 180 320 188 L 320 260 L 0 260 Z" fill={soilColor} className="plant-2d-soil" />
      <path d="M 0 188 Q 80 181 160 190 Q 240 180 320 188" fill="none" stroke="#7b6b55" strokeWidth="2" />
      {wet && <g data-indicator="wet" fill="#b8e4e6" stroke="#4e8496" strokeWidth="2">
        <path d="M 55 202 Q 49 211 55 215 Q 61 211 55 202 Z" /><path d="M 267 212 Q 261 222 267 226 Q 273 222 267 212 Z" />
      </g>}
      {dry && <path data-indicator="dry" d="M 61 201 l 11 8 -6 8 14 6 M 243 205 l -9 8 8 7 -7 7" fill="none" stroke="#745a47" strokeWidth="2" />}
      {heat && <path data-indicator="heat" d="M 241 91 q -5 -7 0 -14 t 0 -14 M 257 99 q -5 -7 0 -14 t 0 -14" fill="none" stroke="#ce774a" strokeWidth="2" />}
      {limited ? <g data-shape="neutral">
        <ellipse cx="160" cy="188" rx="13" ry="7" fill="#948778" />
        <path d="M 160 185 Q 156 173 156 162 M 157 169 Q 145 164 144 153 M 157 169 Q 166 157 173 154" fill="none" stroke="#8ea99a" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 3" />
        <path d="M 144 153 Q 134 149 134 144 Q 147 143 144 153 M 173 154 Q 177 143 186 145 Q 186 153 173 154" fill="#b4c9ba" opacity=".6" />
      </g> : stage === 'siembra' ? <g data-shape="seed"><ellipse cx="160" cy="194" rx="13" ry="7" fill="#8e6550" stroke="#674d41" strokeWidth="2" /></g>
        : stage === 'germinacion' ? <g data-shape="sprout">
          <ellipse cx="160" cy="193" rx="11" ry="6" fill="#8e6550" />
          <path d="M 160 188 Q 157 180 161 174 Q 169 173 171 167" fill="none" stroke="#38815d" strokeWidth="3" strokeLinecap="round" />
          <path d="M 171 167 Q 179 158 184 162 Q 181 171 171 167" fill="#6dad78" />
        </g> : <g data-shape={crop}>
          {crop === 'rabano' && (stage === 'desarrollo_avanzado' || stage === 'posible_cosecha') && <g data-indicator="root">
            <path d="M 140 192 Q 136 216 160 231 Q 184 215 180 192 Z" fill="#df6883" stroke="#ac4963" strokeWidth="2" />
            <path d="M 160 230 Q 157 238 163 248" fill="none" stroke="#d4be9d" strokeWidth="2" />
          </g>}
          <g className="plant-2d-growth" style={{ transform: `translate(160px, 188px) scale(${size})` }}>
            <path d="M 0 0 Q -4 -39 0 -76" fill="none" stroke="#367d58" strokeWidth="4" strokeLinecap="round" />
            {leafAngles.slice(0, leaves).map((_, index) => <LeafShape key={index} crop={leafPaths[crop] ? crop : 'espinaca'} index={index} color={leafColor} droop={heat || dry} />)}
          </g>
        </g>}
    </svg>
    <figcaption className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
      <p>{caption}</p>
      {risks.length ? <ul className="flex flex-wrap gap-2" aria-label="Indicadores de riesgo">{risks.map((risk, index) =>
        <li key={`${risk.code}-${index}`} className="rounded-full border border-line bg-paper px-2 py-1">{labelRisk(risk.code)} · {labelRiskStatus(risk.status)}</li>)}</ul>
        : <p>Sin alertas activas identificadas; esto no confirma condiciones favorables.</p>}
      {missing.length > 0 && <p>Información incompleta: {missing.map(labelMissing).join(', ')}. Verifique en campo.</p>}
      {isIllustrative && <p>Visualización 2D ilustrativa, no fotografía de la parcela. No infiere mortalidad ni diagnostica enfermedades.</p>}
    </figcaption>
  </figure>
}

export function SimulationVisualPanel({ result }) {
  const [selectedKey, setSelectedKey] = useState(null)
  const [displayMode, setDisplayMode] = useState('observed')
  const rows = result.results || []
  const selected = rows.find(row => row.period_start === selectedKey) || rows[0] || null
  const weekly = result.weather.resolution === 'weekly'
  const historical = result.weather.information_type === 'historical'
  const demonstration = illustrationForPeriod(result, selected)
  const stage = visualStageForPeriod(result, selected, displayMode)
  const age = selected?.days_since_sowing
  const observedStage = result.initial_state?.stage
  const observationDate = result.initial_state?.observed_on

  return <section className="rounded-xl border border-line bg-paper p-3 sm:p-4" aria-label="Visualización 2D del cultivo">
    <h4 className="mb-2 font-bold">Evolución visual por {historical ? 'referencia' : weekly ? 'semana' : 'día'}</h4>
    <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Modo de visualización">
      <button type="button" aria-pressed={displayMode === 'observed'} onClick={() => setDisplayMode('observed')}
        className={`rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf ${displayMode === 'observed' ? 'border-leaf bg-mint text-ink' : 'border-line bg-white text-muted'}`}>Estado observado</button>
      <button type="button" aria-pressed={displayMode === 'illustrative'} onClick={() => setDisplayMode('illustrative')}
        className={`rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf ${displayMode === 'illustrative' ? 'border-leaf bg-mint text-ink' : 'border-line bg-white text-muted'}`}>Evolución ilustrativa</button>
    </div>
    {historical ? <p className="mb-3 text-sm text-muted">Solo hay referencia histórica. No se dibuja una trayectoria futura del cultivo.</p>
      : <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={weekly ? 'Seleccionar semana del escenario' : 'Seleccionar día del pronóstico'}>
        {rows.map((row, index) => <button key={row.period_start} type="button" aria-pressed={selected === row}
          onClick={() => setSelectedKey(row.period_start)}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf ${selected === row ? 'border-leaf bg-mint text-ink' : 'border-line bg-white text-muted'}`}>
          {weekly ? `Semana ${index + 1} · ${row.period_start} al ${row.period_end}` : `Día ${index + 1} · ${row.period_start}`}
        </button>)}
      </div>}
    <div className="mb-3 space-y-1 text-sm text-muted">
      <p><strong className="text-ink">Edad desde la siembra:</strong> {age ? weekly ? `${age.start}–${age.end} días en este bloque` : `${age.end} días` : 'sin período futuro disponible'}.</p>
      <p><strong className="text-ink">Última etapa observada:</strong> {observedStage ? `${labelStage(observedStage)} (${observationDate || 'fecha no disponible'})` : 'ninguna registrada'}.</p>
      <p>{displayMode === 'illustrative' ? demonstration.reason : selected ? labelStageSource(selected.stage_source) : 'Sin resultados futuros para confirmar una etapa.'}</p>
    </div>
    <PlantSimulation2D crop={result.crop.id} stage={stage} displayMode={displayMode}
      stageSource={displayMode === 'illustrative' ? 'demostrativo' : selected?.stage_source}
      risks={historical ? [] : selected?.risks || []} missing={selected?.missing || result.missing || []}
      informationType={result.weather.information_type} selectedPeriod={historical ? null : selected} isIllustrative />
    <p className="mt-3 text-xs leading-relaxed text-muted">Esta ilustración muestra una evolución orientativa del cultivo. No representa un crecimiento confirmado ni garantiza la fecha de cosecha. {result.crop.sources?.length ? <>Fuente agronómica: {result.crop.sources.map(source => <a key={source} href={source} target="_blank" rel="noreferrer" className="ml-1 underline">Consultar referencia</a>)}. </> : 'Sin referencias agronómicas disponibles. '}La escala gráfica no es un modelo fenológico validado; las alertas meteorológicas tampoco diagnostican enfermedades.</p>
  </section>
}
