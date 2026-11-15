import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

test('English translations preserve values and recognize saved server messages', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { translate } = await server.ssrLoadModule('/src/i18n.jsx')
    assert.equal(translate('Mi historial'), 'Mi historial')
    assert.equal(translate('Mi historial', 'en'), 'My history')
    assert.equal(translate('Semana {index} · {start} al {end}', 'en',
      { index: 1, start: '2026-11-15', end: '2026-11-21' }),
    'Week 1 · 2026-11-15 to 2026-11-21')
    assert.equal(translate('Último cultivo registrado: Haba.', 'en'), 'Last recorded crop: Haba.')
    assert.equal(translate('Texto del usuario sin traducir', 'en'), 'Texto del usuario sin traducir')
  } finally {
    await server.close()
  }
})

test('Every literal translation key used by the interface has an English entry', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { hasEnglishTranslation } = await server.ssrLoadModule('/src/i18n.jsx')
    function files(directory) {
      return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name)
        return entry.isDirectory() ? files(path) : entry.name.endsWith('.jsx') && entry.name !== 'i18n.jsx' ? [path] : []
      })
    }
    const missing = files('src').flatMap(path => [...readFileSync(path, 'utf8').matchAll(/\bt\('([^']+)'/g)]
      .map(match => ({ path, key: match[1] })).filter(item => !hasEnglishTranslation(item.key)))
    assert.deepEqual(missing, [])
  } finally {
    await server.close()
  }
})
