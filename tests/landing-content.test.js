import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LANDING_TEMPLATES,
  createSection,
  duplicateSection,
  localized,
  localizedValue,
  moveSection,
  normalizeSectionPositions,
  removeSection,
} from '../landing-content.js'

test('English content falls back to Spanish', () => {
  assert.deepEqual(localized('Hola', 'Hello'), { es: 'Hola', en: 'Hello' })
  assert.equal(localizedValue({ es: 'Hola', en: '' }, 'en'), 'Hola')
  assert.equal(localizedValue({ es: 'Hola', en: 'Hello' }, 'en'), 'Hello')
  assert.equal(localizedValue({ es: 'Hola', en: 'Hello' }, 'es'), 'Hola')
})

test('moving sections always rewrites contiguous positions', () => {
  const source = [
    { id: 'a', position: 0 },
    { id: 'b', position: 1 },
    { id: 'c', position: 2 },
  ]
  assert.deepEqual(moveSection(source, 'b', -1).map(({ id, position }) => [id, position]), [
    ['b', 0], ['a', 1], ['c', 2],
  ])
  assert.deepEqual(normalizeSectionPositions([{ id: 'x', position: 8 }, { id: 'y', position: 2 }]).map((item) => item.position), [0, 1])
})

test('duplicating and removing sections are immutable and keep positions valid', () => {
  const source = [{ id: 'a', type: 'hero', position: 0, visible: true, content: { title: { es: 'X', en: '' } } }]
  const result = duplicateSection(source, 'a', 'copy')
  assert.equal(result[1].id, 'copy')
  assert.equal(result[1].position, 1)
  assert.deepEqual(result[1].content, result[0].content)
  assert.notEqual(result[1].content, result[0].content)
  assert.equal(source.length, 1)
  assert.deepEqual(removeSection(result, 'a').map(({ id, position }) => [id, position]), [['copy', 0]])
})

test('every approved landing template has safe editor fields and deterministic defaults', () => {
  const expected = ['hero', 'metrics', 'cards', 'text_image', 'routes', 'jobs', 'gallery', 'testimonials', 'cta', 'contact', 'faq']
  assert.deepEqual(Object.keys(LANDING_TEMPLATES), expected)

  for (const key of expected) {
    const template = LANDING_TEMPLATES[key]
    assert.equal(typeof template.label, 'string')
    assert.ok(Array.isArray(template.fields))
    assert.equal(typeof template.defaults, 'object')
    assert.doesNotMatch(JSON.stringify(template.fields), /html|javascript|json/i)

    const first = createSection(key, `id-${key}`)
    const second = createSection(key, `id-${key}`)
    assert.equal(first.id, `id-${key}`)
    assert.equal(first.type, key)
    assert.equal(first.position, 0)
    assert.equal(first.visible, true)
    assert.deepEqual(first, second)
    assert.notEqual(first.content, second.content)
  }
})
