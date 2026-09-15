import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import ignore from 'ignore'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

const images = [
  'assets/Equipo-eWorker-C.jpg',
  'assets/Noticias-eworker360-c.jpg',
  'assets/c-Empleadodelano-eworker360.jpg',
  'assets/c-Mas-de-eWorker.jpg',
]

test('homepage images are local, present, and published by Cloudflare', async () => {
  const html = await read('index.html')
  const filter = ignore().add(await read('.assetsignore'))

  assert.doesNotMatch(html, /\/wp-content\/uploads\//i)

  for (const path of images) {
    await access(new URL(path, root))
    assert.equal(filter.ignores(path), false, `${path} must be published`)
    assert.match(html, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})
