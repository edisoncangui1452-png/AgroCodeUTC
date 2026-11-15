import assert from 'node:assert/strict'
import test from 'node:test'
import { fertilizerSlots, observationDays, shortCycleCrops } from './simulatorOptions.js'

test('fase 1 ofrece cinco cultivos distintos del catálogo de referencia', () => {
  assert.deepEqual(shortCycleCrops, ['Lechuga', 'Zanahoria', 'Rábano', 'Arveja', 'Repollo'])
  assert.equal(new Set(shortCycleCrops).size, 5)
})

test('solo ofrece las tres modalidades solicitadas y diez espacios sin productos', () => {
  assert.deepEqual(observationDays, [4, 7, 45])
  assert.deepEqual(fertilizerSlots, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})
