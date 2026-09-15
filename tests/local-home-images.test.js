import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import ignore from 'ignore'

const root = new URL('../', import.meta.url)
const rootPath = fileURLToPath(root)
const read = (path) => readFile(new URL(path, root), 'utf8')
const run = promisify(execFile)

const mappings = [
  ['/wp-content/uploads/2025/05/Equipo-eWorker-C.jpg', 'assets/Equipo-eWorker-C.jpg'],
  ['/wp-content/uploads/2025/05/Noticias-eworker360-c.jpg', 'assets/Noticias-eworker360-c.jpg'],
  ['/wp-content/uploads/2025/06/c-Empleadodelano-eworker360.jpg', 'assets/c-Empleadodelano-eworker360.jpg'],
  ['/wp-content/uploads/2025/06/c-Mas-de-eWorker.jpg', 'assets/c-Mas-de-eWorker.jpg'],
]

test('homepage images publish locally and at the legacy WordPress paths', async () => {
  const filter = ignore().add(await read('.assetsignore'))

  for (const [legacy, asset] of mappings) {
    const legacyFile = legacy.slice(1)
    await access(new URL(asset, root))
    await access(new URL(legacyFile, root))
    assert.equal(filter.ignores(asset), false, `${asset} must be published`)
    assert.equal(filter.ignores(legacyFile), false, `${legacyFile} must be published`)
    assert.deepEqual(
      await readFile(new URL(asset, root)),
      await readFile(new URL(legacyFile, root)),
      `${legacyFile} must mirror ${asset}`,
    )
  }

  await run(process.execPath, ['scripts/build-assets.js'], { cwd: rootPath })
  const builtHtml = await read('dist/index.html')

  for (const [legacy, asset] of mappings) {
    assert.equal(builtHtml.includes(legacy), false, `${legacy} must not be present in the published homepage`)
    assert.equal(builtHtml.includes(`/${asset}`), true, `/${asset} must be referenced by the published homepage`)
  }
})
