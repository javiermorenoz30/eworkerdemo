import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin integrates the simple landing editor and removes technical status panels', async () => {
  const admin = await read('admin.js')
  const editor = await read('landing-editor.js')

  assert.match(admin, /import \{ initLandingEditor \} from ['"]\.\/landing-editor\.js['"]/)
  assert.match(admin, /await initLandingEditor\(\)/)
  assert.doesNotMatch(admin, /Datos compartidos y protegidos por Supabase/)
  assert.doesNotMatch(admin, /Valores compartidos de administración/)
  assert.match(editor, /Editar página principal/)
  assert.match(editor, /Guardar borrador/)
  assert.match(editor, /Vista previa/)
  assert.match(editor, /Publicar/)
  assert.match(editor, /querySelector\(['"]\.notice['"]\)\?\.remove/)
  assert.match(editor, /querySelector\(['"]\.readiness['"]\)\?\.remove/)
})

test('landing editor uses approved templates and supports section management', async () => {
  const editor = await read('landing-editor.js')
  for (const name of ['LANDING_TEMPLATES','createSection','fieldsForSection','moveSection','duplicateSection','removeSection','getDraftLanding','saveDraft','publishDraft']) {
    assert.match(editor, new RegExp(`\\b${name}\\b`), `missing ${name}`)
  }
  for (const action of ['move-up','move-down','toggle-visible','duplicate','delete','edit']) {
    assert.match(editor, new RegExp(action), `missing section action ${action}`)
  }
  assert.match(editor, /draggable\s*=\s*true/)
  assert.match(editor, /dragstart/)
  assert.match(editor, /drop/)
})

test('landing editor supports Spanish, English, arrays and direct image management', async () => {
  const editor = await read('landing-editor.js')
  assert.match(editor, /Español/)
  assert.match(editor, /English/)
  assert.match(editor, /localizedText/)
  assert.match(editor, /localizedTextarea/)
  assert.match(editor, /localizedLink/)
  assert.match(editor, /localizedArray/)
  assert.match(editor, /field\.type === ['"]group['"]/)
  assert.match(editor, /data-localized-array-add/)
  assert.match(editor, /data-localized-array-remove/)
  assert.match(editor, /data-array-add/)
  assert.match(editor, /data-array-remove/)
  assert.match(editor, /uploadLandingImage/)
  assert.match(editor, /removeLandingImage/)
  assert.match(editor, /input\.type = ['"]file['"]/)
  assert.match(editor, /image\/jpeg,image\/png,image\/webp,image\/gif/)
  assert.match(editor, /Cambiar foto|Subir foto/)
  assert.match(editor, /Eliminar foto/)
})

test('preview loads the authenticated draft while normal visitors load published content', async () => {
  const bootstrap = await read('landing-bootstrap.js')
  assert.match(bootstrap, /getDraftLanding/)
  assert.match(bootstrap, /getPublishedLanding/)
  assert.match(bootstrap, /URLSearchParams/)
  assert.match(bootstrap, /preview.*draft/)
  assert.match(bootstrap, /Vista previa del borrador/)
})

test('editor cannot save or publish before the initial draft has loaded successfully', async () => {
  const editor = await read('landing-editor.js')
  assert.match(editor, /let loaded = false/)
  assert.match(editor, /if \(!loaded \|\| busy\) return false/)
  assert.match(editor, /loaded = true/)
})

test('editor locks editable controls while loading or saving', async () => {
  const editor = await read('landing-editor.js')
  assert.match(editor, /querySelectorAll\(['"]input, textarea, select, button['"]\)/)
  assert.match(editor, /control\.disabled = value/)
})

test('edits made around a save cannot be incorrectly marked clean', async () => {
  const editor = await read('landing-editor.js')
  assert.match(editor, /let revision = 0/)
  assert.match(editor, /revision \+= 1/)
  assert.match(editor, /const savingRevision = revision/)
  assert.match(editor, /revision === savingRevision/)
})
