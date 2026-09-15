import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const root = new URL('../', import.meta.url)
const rootPath = fileURLToPath(root)
const read = (path) => readFile(new URL(path, root), 'utf8')
const run = promisify(execFile)

const spanishAddress = 'Calle Basilio Gil número 17 San Antonio, próximo a la avenida Pedro A Rivera, provincia de La Vega, República Dominicana'
const englishAddress = '17 Basilio Gil Street, San Antonio, near Pedro A Rivera Avenue, La Vega Province, Dominican Republic'

test('published public pages use the current La Vega address', async () => {
  await run(process.execPath, ['scripts/build-assets.js'], { cwd: rootPath })

  const homepage = await read('dist/index.html')
  const spanish = await read('dist/es/index.html')
  const english = await read('dist/en/index.html')
  const faq = await read('dist/faq.html')

  assert.equal(homepage.includes(spanishAddress), true)
  assert.equal(homepage.includes(englishAddress), true)
  assert.equal(spanish.includes('Calle Basilio Gil número 17'), true)
  assert.equal(english.includes('Calle Basilio Gil número 17'), true)
  assert.equal(faq.includes(spanishAddress), true)

  for (const html of [homepage, spanish, english, faq]) {
    assert.equal(html.includes('Calle Hostos'), false)
    assert.equal(html.includes('Plaza Quezada'), false)
  }
})
