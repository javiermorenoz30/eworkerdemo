import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import ignore from 'ignore'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

const mappings = [
  ['/wp-content/uploads/2025/05/Equipo-eWorker-C.jpg', 'assets/Equipo-eWorker-C.jpg'],
  ['/wp-content/uploads/2025/05/Noticias-eworker360-c.jpg', 'assets/Noticias-eworker360-c.jpg'],
  ['/wp-content/uploads/2025/06/c-Empleadodelano-eworker360.jpg', 'assets/c-Empleadodelano-eworker360.jpg'],
  ['/wp-content/uploads/2025/06/c-Mas-de-eWorker.jpg', 'assets/c-Mas-de-eWorker.jpg'],
]

test('published homepage uses local image URLs instead of removed WordPress paths', async () => {
  const filter = ignore().add(await read('.assetsignore'))

  for (const [, asset] of mappings) {
    await access(new URL(asset, root))
    assert.equal(filter.ignores(asset), false, `${asset} must be published`)
  }

  const builtHtml = await read('dist/index.html')

  for (const [legacy, asset] of mappings) {
    assert.equal(builtHtml.includes(legacy), false, `${legacy} must not be present in the published homepage`)
    assert.equal(builtHtml.includes(`/${asset}`), true, `/${asset} must be referenced by the published homepage`)
  }
})
