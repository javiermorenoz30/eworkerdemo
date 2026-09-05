import { copyFile, lstat, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = resolve(root, 'dist')
if (!output.startsWith(resolve(root) + sep)) throw new Error('Invalid output directory')
const rules = await readFile(new URL('../.assetsignore', import.meta.url), 'utf8')
const paths = rules.split(/\r?\n/).filter(line => line.startsWith('!/') && !line.endsWith('/')).map(line => line.slice(2))
for (const path of paths) {
  if (!resolve(root, path).startsWith(resolve(root) + sep)) throw new Error(`Invalid asset: ${path}`)
  const info = await lstat(resolve(root, path))
  if (!info.isFile() || info.size > 25 * 1024 * 1024) throw new Error(`Invalid or oversized asset: ${path}`)
}
// Recreate only the fixed, generated directory to remove stale published files.
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
for (const path of [...paths, '.assetsignore']) {
  const target = resolve(output, path)
  await mkdir(dirname(target), { recursive: true })
  await copyFile(resolve(root, path), target)
}
console.log(`Prepared ${paths.length} public files in dist/`)
