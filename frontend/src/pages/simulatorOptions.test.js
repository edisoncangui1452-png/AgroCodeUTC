import assert from 'node:assert/strict'
import test from 'node:test'
import { fertilizerSlots, observationDays, shortCycleCrops } from './simulatorOptions.js'

test('fase 3 ofrece exclusivamente los cinco cultivos del motor', () => {
  assert.deepEqual(shortCycleCrops.map(item => item.id), ['cilantro', 'rabano', 'rucula', 'lechuga_hoja', 'espinaca'])
  assert.equal(new Set(shortCycleCrops.map(item => item.id)).size, 5)
})

test('solo ofrece las tres modalidades solicitadas y diez espacios sin productos', () => {
  assert.deepEqual(observationDays, [4, 7, 45])
  assert.deepEqual(fertilizerSlots, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})
