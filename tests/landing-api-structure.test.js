import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('landing API exposes public, draft, publishing and media operations', async () => {
  const api = await read('landing-api.js')
  for (const name of [
    'getPublishedLanding',
    'getDraftLanding',
    'saveDraft',
    'publishDraft',
    'uploadLandingImage',
    'removeLandingImage',
    'publicLandingImageUrl',
  ]) {
    assert.match(api, new RegExp(`export (?:async )?function ${name}\\b`), `missing ${name}`)
  }
  assert.match(api, /from\(['"]landing_versions['"]\)/)
  assert.match(api, /from\(['"]landing_sections['"]\)/)
  assert.match(api, /rpc\(['"]save_landing_draft['"]/)
  assert.match(api, /rpc\(['"]publish_landing['"]\)/)
  assert.match(api, /storage\.from\(['"]landing-media['"]\)/)
})

test('image uploads use generated safe paths and reject unsupported files before upload', async () => {
  const api = await read('landing-api.js')
  assert.match(api, /safeExtension\(file\.name\)/)
  assert.match(api, /crypto\.randomUUID\(\)/)
  assert.match(api, /10 \* 1024 \* 1024/)
  for (const extension of ['jpg', 'jpeg', 'png', 'webp', 'gif']) assert.match(api, new RegExp(`['"]${extension}['"]`))
  assert.match(api, /cacheControl:\s*['"]31536000['"]/)
  assert.match(api, /upsert:\s*false/)
})

test('image removal checks references and never deletes bundled or external images', async () => {
  const api = await read('landing-api.js')
  assert.match(api, /landing_media_is_referenced/)
  assert.match(api, /reason:\s*['"]in-use['"]/)
  assert.match(api, /startsWith\(['"]assets\/['"]\)/)
  assert.match(api, /\^https\?:/)
  assert.match(api, /\.remove\(\[path\]\)/)
})
