import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server
let PlantSimulation2D
let SimulationVisualPanel

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ;({ PlantSimulation2D, SimulationVisualPanel } = await server.ssrLoadModule('/src/pages/PlantSimulation2D.jsx'))
})

after(async () => { if (server) await server.close() })

function plant(crop = 'cilantro', stage = 'desarrollo_vegetativo', risks = [], other = {}) {
  return renderToStaticMarkup(createElement(PlantSimulation2D, {
    crop, stage, risks, informationType: 'forecast', selectedPeriod: { period_start: '2026-11-15', period_end: '2026-11-15' },
    stageSource: 'observacion_confirmada', ...other,
  }))
}

function panel(days, type = 'forecast', resolution = 'daily') {
  const rows = type === 'historical' ? [] : Array.from({ length: days === 45 ? 7 : days }, (_, index) => ({
    period_start: `2026-11-${String(index + 15).padStart(2, '0')}`,
    period_end: `2026-11-${String(index + (days === 45 ? 21 : 15)).padStart(2, '0')}`,
    stage: 'emergencia', stage_source: 'observacion_confirmada',
    risks: [], missing: [],
  }))
  return renderToStaticMarkup(createElement(SimulationVisualPanel, {
    result: { crop: { id: 'rabano' }, weather: { information_type: type, resolution }, results: rows, missing: [] },
  }))
}

test('renderiza SVG accesible, leyenda y datos del periodo seleccionado', () => {
  const html = plant()
  assert.match(html, /<svg[^>]+role="img"[^>]+aria-labelledby=/)
  assert.match(html, /<title[^>]*>Ilustración de Cilantro/)
  assert.match(html, /<desc/)
  assert.match(html, /Visualización 2D ilustrativa/)
  assert.match(html, /2026-11-15/)
  assert.doesNotMatch(html, /planta muerta|enfermedad confirmada/)
})

test('cada cultivo tiene un contorno de hojas distinto; raíz ilustrativa solo en rábano avanzado', () => {
  const crops = ['cilantro', 'rabano', 'rucula', 'lechuga_hoja', 'espinaca']
  const silhouettes = crops.map(crop => {
    const html = plant(crop, 'desarrollo_avanzado')
    assert.match(html, new RegExp(`data-shape="${crop}"`))
    assert.equal(html.includes('data-indicator="root"'), crop === 'rabano')
    return html.match(/class="plant-2d-leaf"[^>]*><path d="([^"]+)"/)?.[1]
  })
  assert.equal(new Set(silhouettes).size, 5)
})

test('siembra, germinación, emergencia y etapas avanzadas cambian solamente según etapa recibida', () => {
  assert.match(plant('cilantro', 'siembra'), /data-shape="seed"/)
  assert.match(plant('cilantro', 'germinacion'), /data-shape="sprout"/)
  const emergence = plant('cilantro', 'emergencia')
  const advanced = plant('cilantro', 'desarrollo_avanzado')
  assert.equal((emergence.match(/class="plant-2d-leaf"/g) || []).length, 2)
  assert.equal((advanced.match(/class="plant-2d-leaf"/g) || []).length, 5)
})

test('riesgo de calor cambia hojas e indicador sin diagnosticar enfermedad o muerte', () => {
  const normal = plant()
  const heat = plant('cilantro', 'desarrollo_vegetativo', [{ code: 'calor', status: 'posible' }])
  assert.match(heat, /data-indicator="heat"/)
  assert.match(heat, /#9bad64/)
  assert.match(heat, /Posible calor/)
  assert.doesNotMatch(normal, /data-indicator="heat"/)
})

test('suelo seco observado cambia suelo, postura y advertencia', () => {
  const html = plant('rucula', 'crecimiento_inicial', [{ code: 'falta_agua', status: 'observado_en_fecha' }])
  assert.match(html, /data-indicator="dry"/)
  assert.match(html, /#c5a079/)
  assert.match(html, /Suelo seco registrado/)
})

test('exceso de humedad observado presenta gotas y suelo distinto', () => {
  const html = plant('espinaca', 'desarrollo_vegetativo', [{ code: 'exceso_humedad', status: 'observado_en_fecha' }])
  assert.match(html, /data-indicator="wet"/)
  assert.match(html, /#537478/)
  assert.match(html, /Encharcamiento registrado/)
})

test('antecedentes no reconfirmados no alteran visualmente la planta futura', () => {
  const html = plant('cilantro', 'desarrollo_vegetativo', [{ code: 'falta_agua', status: 'antecedente_no_reconfirmado' }])
  assert.doesNotMatch(html, /data-indicator="dry"/)
  assert.match(html, /antecedente, no confirmado ahora/)
})

test('etapa desconocida y faltantes presentan símbolo neutro sin estado favorable', () => {
  const html = plant('espinaca', null, [], { missing: ['soil_moisture_model_percent'], stageSource: 'no_determinada' })
  assert.match(html, /data-stage="no_confirmada"/)
  assert.match(html, /data-shape="neutral"/)
  assert.match(html, /Información incompleta/)
  assert.match(html, /esto no confirma condiciones favorables/)
  assert.doesNotMatch(html, /data-shape="espinaca"/)
})

test('4 días: botones diarios y primero seleccionado sin inventar etapas', () => {
  const html = panel(4)
  assert.equal((html.match(/aria-pressed="/g) || []).length, 4)
  assert.match(html, /aria-pressed="true"[^>]*>Día 1 · 2026-11-15/)
  assert.match(html, /Día 4 · 2026-11-18/)
  assert.match(html, /Seleccionar día del pronóstico/)
})

test('7 días: siete botones diarios, fecha y estructura accesible', () => {
  const html = panel(7)
  assert.equal((html.match(/aria-pressed="/g) || []).length, 7)
  assert.match(html, /Día 7 · 2026-11-21/)
  assert.match(html, /role="group"/)
})

test('45 días: siete bloques semanales, no botones de días inexistentes', () => {
  const html = panel(45, 'subseasonal_forecast', 'weekly')
  assert.equal((html.match(/aria-pressed="/g) || []).length, 7)
  assert.match(html, /Semana 7 · 2026-11-21 al 2026-11-27/)
  assert.match(html, /Escenario subestacional por semanas/)
  assert.doesNotMatch(html, /Día 7/)
})

test('histórico: no dibuja pronóstico futuro ni botones sintéticos', () => {
  const html = panel(45, 'historical', 'historical_month')
  assert.doesNotMatch(html, /aria-pressed=/)
  assert.match(html, /Referencia histórica; no pronóstico/)
  assert.match(html, /Solo hay referencia histórica/)
  assert.match(html, /data-shape="neutral"/)
})

test('SimulatorPage integra el componente con el resultado sin alterar el panel meteorológico', async () => {
  await server.ssrLoadModule('/src/pages/SimulatorPage.jsx')
  const source = await readFile(new URL('./SimulatorPage.jsx', import.meta.url), 'utf8')
  assert.match(source, /<SimulationVisualPanel result=\{result\}/)
  assert.match(source, /Contexto meteorológico/)
  assert.match(source, /parcels\/\$\{id\}\/simulator-weather\//)
})
