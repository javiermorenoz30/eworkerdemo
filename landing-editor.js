import {
  LANDING_TEMPLATES,
  createSection,
  duplicateSection,
  localizedValue,
  moveSection,
  normalizeSectionPositions,
  removeSection,
} from './landing-content.js'
import {
  getDraftLanding,
  publishDraft,
  publicLandingImageUrl,
  removeLandingImage,
  saveDraft,
  uploadLandingImage,
} from './landing-api.js'

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const ANCHOR_DEFAULTS = { hero: 'inicio', jobs: 'vacantes', contact: 'contacto', cta: 'aplicar' }

const create = (tag, className = '') => {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

function getAtPath(root, path = []) {
  return path.reduce((value, key) => value?.[key], root)
}

function setAtPath(root, path = [], value) {
  if (!path.length) return
  let cursor = root
  path.slice(0, -1).forEach((key, index) => {
    const nextKey = path[index + 1]
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = typeof nextKey === 'number' ? [] : {}
    cursor = cursor[key]
  })
  cursor[path.at(-1)] = value
}

function blankValue(field) {
  if (field.type === 'localizedText' || field.type === 'localizedTextarea') return { es: '', en: '' }
  if (field.type === 'localizedLink') return { label: { es: '', en: '' }, href: '' }
  if (field.type === 'image') return { path: '', alt: { es: '', en: '' } }
  if (field.type === 'array') return []
  return ''
}

function blankArrayItem(itemFields = []) {
  return Object.fromEntries(itemFields.map((field) => [field.key, blankValue(field)]))
}

function collectImagePaths(value, paths = new Set()) {
  if (!value || typeof value !== 'object') return paths
  if (!Array.isArray(value) && typeof value.path === 'string' && value.path) paths.add(value.path)
  Object.values(value).forEach((child) => {
    if (child && typeof child === 'object') collectImagePaths(child, paths)
  })
  return paths
}

function injectStyles() {
  if (document.getElementById('landing-editor-styles')) return
  const style = create('style')
  style.id = 'landing-editor-styles'
  style.textContent = `
    .landing-editor-shell{display:grid;gap:18px}
    .landing-editor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:24px;border:1px solid var(--line);border-radius:16px;background:#fff}
    .landing-editor-head h2{margin:4px 0 8px}.landing-editor-head p{margin:0;color:#69748d;line-height:1.6}
    .landing-editor-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
    .landing-editor-status{display:inline-flex;align-items:center;min-height:36px;padding:0 11px;border-radius:999px;background:#f2f5fb;color:#62708d;font-size:11px;font-weight:800}
    .landing-editor-status.dirty{background:#fff7df;color:#8a6719}.landing-editor-status.published{background:#eaf8f2;color:#23785b}
    .landing-editor-note{min-height:20px;margin:0;color:#66728d;font-size:12px}
    .landing-sections{display:grid;gap:12px}
    .landing-section-card{border:1px solid var(--line);border-radius:16px;background:#fff;overflow:hidden}
    .landing-section-card.is-dragging{opacity:.45}.landing-section-card.is-drop-target{outline:2px solid #5969d8;outline-offset:2px}
    .landing-section-summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:13px;align-items:center;padding:16px 18px}
    .landing-drag{border:0;background:transparent;color:#8a95ad;font-size:18px;cursor:grab}.landing-drag:active{cursor:grabbing}
    .landing-section-copy b,.landing-section-copy small{display:block}.landing-section-copy b{color:#16254c;font-size:14px}.landing-section-copy small{margin-top:4px;color:#7a859d}
    .landing-section-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.landing-mini{border:1px solid #dbe0ec;border-radius:8px;background:#fff;padding:7px 9px;color:#43516e;font-size:11px;font-weight:800;cursor:pointer}
    .landing-mini:hover{border-color:#8e98b4}.landing-mini.danger{color:#a63d4e}
    .landing-section-menu{position:relative}.landing-section-menu summary{list-style:none}.landing-section-menu summary::-webkit-details-marker{display:none}
    .landing-section-menu[open] .landing-menu-pop{display:grid}.landing-menu-pop{display:none;position:absolute;right:0;z-index:5;min-width:145px;margin-top:6px;padding:7px;border:1px solid #dfe4ef;border-radius:10px;background:#fff;box-shadow:0 15px 35px rgba(34,48,82,.14)}
    .landing-menu-pop button{border:0;background:transparent;padding:9px;text-align:left;color:#46536e;font-weight:700;cursor:pointer}.landing-menu-pop button:hover{background:#f5f7fb}
    .landing-section-editor{border-top:1px solid var(--line);padding:18px;background:#fbfcff}.landing-section-editor[hidden]{display:none}
    .landing-language-tabs{display:flex;gap:7px;margin-bottom:16px}.landing-language-tabs button{border:1px solid #d9dfed;border-radius:999px;background:#fff;padding:8px 13px;color:#5f6b84;font-weight:800;cursor:pointer}
    .landing-language-tabs button.active{border-color:#5969d8;background:#eef0ff;color:#3342a5}
    .landing-section-card[data-editor-locale="es"] [data-localized-locale="en"],.landing-section-card[data-editor-locale="en"] [data-localized-locale="es"]{display:none!important}
    .landing-fields{display:grid;gap:14px}.landing-field{display:grid;gap:7px}.landing-field>span,.landing-array-title{color:#56627d;font-size:11px;font-weight:800}
    .landing-field input,.landing-field textarea,.landing-field select{width:100%;border:1px solid #d8deeb;border-radius:9px;background:#fff;padding:10px 11px;color:#17264d;font:inherit}.landing-field textarea{min-height:92px;resize:vertical}
    .landing-group{display:grid;gap:12px;padding:14px;border:1px solid #e2e6f0;border-radius:12px;background:#fff}
    .landing-array{display:grid;gap:10px}.landing-array-item{display:grid;gap:11px;padding:13px;border:1px solid #e2e6f0;border-radius:11px;background:#fff}.landing-array-item-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
    .landing-image-box{display:grid;grid-template-columns:120px minmax(0,1fr);gap:14px;align-items:center}.landing-image-preview{width:120px;height:86px;object-fit:cover;border-radius:10px;border:1px solid #dfe4ee;background:#f1f3f8}
    .landing-image-empty{display:grid;place-items:center;width:120px;height:86px;border:1px dashed #cdd4e2;border-radius:10px;color:#8a94a9;font-size:11px;text-align:center}
    .landing-image-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.landing-image-actions label{display:inline-flex;align-items:center;cursor:pointer}.landing-image-actions input[type=file]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
    .landing-add-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:17px;border:1px dashed #ccd4e4;border-radius:14px;background:#fafbfe}.landing-add-row select{min-width:220px;border:1px solid #d8deeb;border-radius:9px;background:#fff;padding:10px}
    .landing-editor-legacy{display:none!important}
    .landing-preview-banner{position:fixed;left:50%;top:12px;z-index:2147483647;transform:translateX(-50%);padding:9px 15px;border-radius:999px;background:#fff6d9;color:#6d5618;box-shadow:0 10px 30px rgba(0,0,0,.18);font:800 12px/1.2 Manrope,system-ui,sans-serif}
    @media(max-width:900px){.landing-editor-head{display:grid}.landing-editor-actions{justify-content:flex-start}.landing-section-summary{grid-template-columns:auto minmax(0,1fr)}.landing-section-tools{grid-column:2}.landing-image-box{grid-template-columns:1fr}.landing-image-preview,.landing-image-empty{width:100%;height:180px}}
  `
  document.head.append(style)
}

function makeButton(label, action, className = 'landing-mini') {
  const button = create('button', className)
  button.type = 'button'
  button.textContent = label
  button.dataset.sectionAction = action
  return button
}

function createTextField(section, path, label, { textarea = false } = {}) {
  const wrapper = create('label', 'landing-field')
  const caption = create('span')
  caption.textContent = label
  const input = create(textarea ? 'textarea' : 'input')
  input.value = String(getAtPath(section.content, path) ?? '')
  input.dataset.sectionId = section.id
  input.dataset.fieldPath = JSON.stringify(path)
  wrapper.append(caption, input)
  return wrapper
}

function createLocalizedField(section, path, label, { textarea = false } = {}) {
  const group = create('div', 'landing-group')
  const caption = create('span', 'landing-array-title')
  caption.textContent = label
  group.append(caption)
  for (const [locale, localeLabel] of [['es', 'Español'], ['en', 'English']]) {
    const wrapper = create('label', 'landing-field')
    wrapper.dataset.localizedLocale = locale
    const language = create('span')
    language.textContent = localeLabel
    const input = create(textarea ? 'textarea' : 'input')
    input.value = String(getAtPath(section.content, [...path, locale]) ?? '')
    input.dataset.sectionId = section.id
    input.dataset.fieldPath = JSON.stringify([...path, locale])
    wrapper.append(language, input)
    group.append(wrapper)
  }
  return group
}

function createLinkField(section, path, label) {
  const group = create('div', 'landing-group')
  const caption = create('span', 'landing-array-title')
  caption.textContent = label
  group.append(caption)
  group.append(createLocalizedField(section, [...path, 'label'], 'Texto del enlace'))
  group.append(createTextField(section, [...path, 'href'], 'Destino'))
  return group
}

function createImageField(section, path, label) {
  const value = getAtPath(section.content, path) || {}
  const group = create('div', 'landing-group')
  const caption = create('span', 'landing-array-title')
  caption.textContent = label
  group.append(caption)

  const box = create('div', 'landing-image-box')
  const imagePath = String(value.path || '')
  if (imagePath) {
    const image = create('img', 'landing-image-preview')
    image.src = publicLandingImageUrl(imagePath)
    image.alt = String(localizedValue(value.alt, 'es') || '')
    box.append(image)
  } else {
    const empty = create('div', 'landing-image-empty')
    empty.textContent = 'Sin foto'
    box.append(empty)
  }

  const actions = create('div', 'landing-image-actions')
  const uploadLabel = create('label', 'landing-mini')
  uploadLabel.textContent = imagePath ? 'Cambiar foto' : 'Subir foto'
  const input = create('input')
  input.type = 'file'
  input.accept = 'image/jpeg,image/png,image/webp,image/gif'
  input.dataset.sectionId = section.id
  input.dataset.imagePath = JSON.stringify(path)
  uploadLabel.append(input)
  actions.append(uploadLabel)

  if (imagePath) {
    const remove = create('button', 'landing-mini danger')
    remove.type = 'button'
    remove.textContent = 'Eliminar foto'
    remove.dataset.sectionId = section.id
    remove.dataset.imageRemove = JSON.stringify(path)
    actions.append(remove)
  }
  box.append(actions)
  group.append(box)
  group.append(createLocalizedField(section, [...path, 'alt'], 'Descripción de la foto'))
  return group
}

function createArrayField(section, field, basePath = []) {
  const path = [...basePath, field.key]
  const values = getAtPath(section.content, path) || []
  const group = create('div', 'landing-array')
  const title = create('span', 'landing-array-title')
  title.textContent = field.label
  group.append(title)

  values.forEach((_, index) => {
    const item = create('div', 'landing-array-item')
    const head = create('div', 'landing-array-item-head')
    const label = create('b')
    label.textContent = `${field.label} ${index + 1}`
    const remove = create('button', 'landing-mini danger')
    remove.type = 'button'
    remove.textContent = 'Eliminar'
    remove.setAttribute('data-array-remove', 'true')
    remove.dataset.sectionId = section.id
    remove.dataset.arrayKey = field.key
    remove.dataset.arrayIndex = String(index)
    head.append(label, remove)
    item.append(head)
    field.itemFields.forEach((itemField) => item.append(createField(section, itemField, [...path, index])))
    group.append(item)
  })

  const add = create('button', 'landing-mini')
  add.type = 'button'
  add.textContent = `+ Agregar ${field.label.toLowerCase()}`
  add.setAttribute('data-array-add', 'true')
  add.dataset.sectionId = section.id
  add.dataset.arrayKey = field.key
  group.append(add)
  return group
}

function createField(section, field, basePath = []) {
  const path = [...basePath, field.key]
  if (field.type === 'localizedText') return createLocalizedField(section, path, field.label)
  if (field.type === 'localizedTextarea') return createLocalizedField(section, path, field.label, { textarea: true })
  if (field.type === 'localizedLink') return createLinkField(section, path, field.label)
  if (field.type === 'image') return createImageField(section, path, field.label)
  if (field.type === 'array') return createArrayField(section, field, basePath)
  return createTextField(section, path, field.label)
}

function templateArrayField(sectionType, key) {
  return LANDING_TEMPLATES[sectionType]?.fields?.find((field) => field.type === 'array' && field.key === key)
}

function ensureUniqueAnchor(section, allSections) {
  const fallback = ANCHOR_DEFAULTS[section.type]
  const desired = String(section.content?.id || fallback || '')
  if (!desired) return section
  const used = new Set(allSections.filter((item) => item.id !== section.id).map((item) => String(item.content?.id || ANCHOR_DEFAULTS[item.type] || '')).filter(Boolean))
  if (!used.has(desired)) {
    section.content.id = desired
    return section
  }
  section.content.id = `${desired}-${section.id.slice(0, 8)}`
  return section
}

export async function initLandingEditor() {
  const contentView = document.getElementById('content')
  if (!contentView) return

  injectStyles()
  document.querySelector('.notice')?.remove()
  document.querySelector('.readiness')?.remove()

  const sidebarLabel = document.querySelector('.sidebar-bottom small')
  if (sidebarLabel) sidebarLabel.textContent = 'eWorker360 Dominicana'
  const accessNote = document.querySelector('.access-note')
  if (accessNote) accessNote.textContent = 'La persona recibirá un correo para crear su contraseña y entrar al panel.'
  const settingsCopy = document.querySelector('#settings .section-heading p:last-child')
  if (settingsCopy) settingsCopy.textContent = 'Configura dónde recibirá el equipo los avisos del sitio.'
  const viewMeta = document.getElementById('view-meta')
  if (viewMeta) viewMeta.textContent = 'Solicitudes, mensajes y contenido del sitio.'

  contentView.querySelector('.section-heading')?.classList.add('landing-editor-legacy')
  document.getElementById('content-form')?.classList.add('landing-editor-legacy')

  const shell = create('div', 'landing-editor-shell')
  shell.id = 'landing-editor'
  shell.innerHTML = `
    <section class="landing-editor-head">
      <div>
        <p class="eyebrow">PÁGINA PRINCIPAL</p>
        <h2>Editar página principal</h2>
        <p>Cambia textos, fotos y secciones. Nada se muestra al público hasta que pulses Publicar.</p>
      </div>
      <div class="landing-editor-actions">
        <span id="landing-editor-status" class="landing-editor-status">Cargando borrador…</span>
        <button type="button" class="ghost" id="landing-save">Guardar borrador</button>
        <button type="button" class="ghost" id="landing-preview">Vista previa</button>
        <button type="button" class="primary" id="landing-publish">Publicar</button>
      </div>
    </section>
    <p id="landing-editor-note" class="landing-editor-note" aria-live="polite"></p>
    <div id="landing-sections" class="landing-sections"></div>
    <div class="landing-add-row">
      <select id="landing-template-select" aria-label="Plantilla de nueva sección"></select>
      <button type="button" class="primary" id="landing-add">+ Agregar sección</button>
    </div>
  `
  contentView.prepend(shell)

  const status = document.getElementById('landing-editor-status')
  const note = document.getElementById('landing-editor-note')
  const list = document.getElementById('landing-sections')
  const templateSelect = document.getElementById('landing-template-select')
  const saveButton = document.getElementById('landing-save')
  const previewButton = document.getElementById('landing-preview')
  const publishButton = document.getElementById('landing-publish')
  const addButton = document.getElementById('landing-add')

  Object.entries(LANDING_TEMPLATES).forEach(([value, template]) => {
    const option = create('option')
    option.value = value
    option.textContent = template.label
    templateSelect.append(option)
  })

  let sections = []
  let dirty = false
  let busy = false
  let dragSectionId = null
  const openSections = new Set()
  const localeBySection = new Map()
  const orphanMedia = new Set()

  const setStatus = (text, className = '') => {
    status.textContent = text
    status.className = `landing-editor-status${className ? ` ${className}` : ''}`
  }

  const setNote = (text = '') => {
    note.textContent = text
  }

  const markDirty = () => {
    dirty = true
    setStatus('Cambios sin guardar', 'dirty')
    setNote('Guarda el borrador para poder revisarlo en Vista previa.')
  }

  const setBusy = (value) => {
    busy = value
    saveButton.disabled = value
    previewButton.disabled = value
    publishButton.disabled = value
    addButton.disabled = value
  }

  const rememberMedia = (value) => {
    collectImagePaths(value).forEach((path) => orphanMedia.add(path))
  }

  const cleanupMedia = async () => {
    for (const path of [...orphanMedia]) {
      try {
        const result = await removeLandingImage(path)
        if (result?.removed || result?.reason === 'managed-elsewhere') orphanMedia.delete(path)
      } catch {
        // Cleanup is best-effort; references remain protected by the API.
      }
    }
  }

  function currentSection(sectionId) {
    return sections.find((section) => section.id === sectionId)
  }

  function renderSections() {
    list.replaceChildren()

    if (!sections.length) {
      const empty = create('div', 'card')
      empty.style.padding = '24px'
      empty.textContent = 'No hay secciones en el borrador. Agrega una plantilla para comenzar.'
      list.append(empty)
      return
    }

    sections.forEach((section, index) => {
      const template = LANDING_TEMPLATES[section.type]
      if (!template) return
      const card = create('section', 'landing-section-card')
      card.dataset.sectionId = section.id
      card.dataset.editorLocale = localeBySection.get(section.id) || 'es'
      card.draggable = true

      const summary = create('div', 'landing-section-summary')
      const drag = create('button', 'landing-drag')
      drag.type = 'button'
      drag.textContent = '⋮⋮'
      drag.title = 'Arrastra para reordenar'
      drag.setAttribute('aria-label', 'Arrastra para reordenar')

      const copy = create('div', 'landing-section-copy')
      const title = create('b')
      title.textContent = template.label
      const subtitle = create('small')
      subtitle.textContent = String(localizedValue(section.content?.title || section.content?.eyebrow, 'es') || (section.visible === false ? 'Oculta' : 'Visible'))
      copy.append(title, subtitle)

      const tools = create('div', 'landing-section-tools')
      const up = makeButton('↑', 'move-up')
      up.title = 'Mover arriba'
      up.disabled = index === 0
      const down = makeButton('↓', 'move-down')
      down.title = 'Mover abajo'
      down.disabled = index === sections.length - 1
      const visible = makeButton(section.visible === false ? 'Mostrar' : 'Ocultar', 'toggle-visible')
      const edit = makeButton(openSections.has(section.id) ? 'Cerrar' : 'Editar', 'edit')
      const menu = create('details', 'landing-section-menu')
      const menuButton = create('summary', 'landing-mini')
      menuButton.textContent = '•••'
      const pop = create('div', 'landing-menu-pop')
      const duplicate = makeButton('Duplicar', 'duplicate', '')
      const remove = makeButton('Eliminar', 'delete', 'danger')
      pop.append(duplicate, remove)
      menu.append(menuButton, pop)
      tools.append(up, down, visible, edit, menu)
      summary.append(drag, copy, tools)
      card.append(summary)

      const editor = create('div', 'landing-section-editor')
      editor.hidden = !openSections.has(section.id)
      const tabs = create('div', 'landing-language-tabs')
      for (const [locale, label] of [['es', 'Español'], ['en', 'English']]) {
        const button = create('button', card.dataset.editorLocale === locale ? 'active' : '')
        button.type = 'button'
        button.textContent = label
        button.dataset.sectionLocale = locale
        button.dataset.sectionId = section.id
        tabs.append(button)
      }
      const fields = create('div', 'landing-fields')
      template.fields.forEach((field) => fields.append(createField(section, field)))
      editor.append(tabs, fields)
      card.append(editor)
      list.append(card)
    })
  }

  function mutateSection(action, sectionId) {
    const section = currentSection(sectionId)
    if (!section) return

    if (action === 'edit') {
      if (openSections.has(sectionId)) openSections.delete(sectionId)
      else openSections.add(sectionId)
      renderSections()
      return
    }
    if (action === 'move-up') sections = moveSection(sections, sectionId, -1)
    if (action === 'move-down') sections = moveSection(sections, sectionId, 1)
    if (action === 'toggle-visible') {
      section.visible = section.visible === false
      sections = normalizeSectionPositions(sections)
    }
    if (action === 'duplicate') {
      sections = duplicateSection(sections, sectionId)
      const copy = sections[sections.findIndex((item) => item.id === sectionId) + 1]
      if (copy) {
        ensureUniqueAnchor(copy, sections)
        openSections.add(copy.id)
      }
    }
    if (action === 'delete') {
      if (!window.confirm(`¿Eliminar la sección "${LANDING_TEMPLATES[section.type]?.label || section.type}" del borrador?`)) return
      rememberMedia(section.content)
      sections = removeSection(sections, sectionId)
      openSections.delete(sectionId)
      localeBySection.delete(sectionId)
    }
    markDirty()
    renderSections()
  }

  list.addEventListener('click', (event) => {
    const localeButton = event.target.closest('[data-section-locale]')
    if (localeButton) {
      localeBySection.set(localeButton.dataset.sectionId, localeButton.dataset.sectionLocale)
      renderSections()
      return
    }

    const imageRemove = event.target.closest('[data-image-remove]')
    if (imageRemove) {
      const section = currentSection(imageRemove.dataset.sectionId)
      if (!section) return
      const path = JSON.parse(imageRemove.dataset.imageRemove)
      const current = getAtPath(section.content, path) || {}
      if (current.path) orphanMedia.add(current.path)
      setAtPath(section.content, path, { ...current, path: '' })
      markDirty()
      renderSections()
      return
    }

    const arrayAdd = event.target.closest('[data-array-add]')
    if (arrayAdd) {
      const section = currentSection(arrayAdd.dataset.sectionId)
      const field = section && templateArrayField(section.type, arrayAdd.dataset.arrayKey)
      if (!section || !field) return
      const values = getAtPath(section.content, [field.key]) || []
      values.push(blankArrayItem(field.itemFields))
      setAtPath(section.content, [field.key], values)
      markDirty()
      renderSections()
      return
    }

    const arrayRemove = event.target.closest('[data-array-remove]')
    if (arrayRemove) {
      const section = currentSection(arrayRemove.dataset.sectionId)
      if (!section) return
      const field = templateArrayField(section.type, arrayRemove.dataset.arrayKey)
      if (!field) return
      const values = [...(getAtPath(section.content, [field.key]) || [])]
      const index = Number(arrayRemove.dataset.arrayIndex)
      rememberMedia(values[index])
      values.splice(index, 1)
      setAtPath(section.content, [field.key], values)
      markDirty()
      renderSections()
      return
    }

    const actionButton = event.target.closest('[data-section-action]')
    if (actionButton) mutateSection(actionButton.dataset.sectionAction, actionButton.closest('[data-section-id]')?.dataset.sectionId)
  })

  list.addEventListener('input', (event) => {
    const target = event.target
    if (!target.dataset.fieldPath || !target.dataset.sectionId) return
    const section = currentSection(target.dataset.sectionId)
    if (!section) return
    setAtPath(section.content, JSON.parse(target.dataset.fieldPath), target.value)
    markDirty()
  })

  list.addEventListener('change', async (event) => {
    const input = event.target
    if (!input.dataset.imagePath || !input.dataset.sectionId || !input.files?.[0]) return
    const section = currentSection(input.dataset.sectionId)
    if (!section) return
    const path = JSON.parse(input.dataset.imagePath)
    const current = getAtPath(section.content, path) || {}
    input.disabled = true
    setNote('Subiendo foto…')
    try {
      const uploaded = await uploadLandingImage(input.files[0])
      if (current.path) orphanMedia.add(current.path)
      setAtPath(section.content, path, { ...current, path: uploaded.path })
      markDirty()
      setNote('Foto lista en el borrador. Guarda para conservar el cambio.')
      renderSections()
    } catch (error) {
      setNote(error?.message || 'No se pudo subir la foto.')
      input.disabled = false
    }
  })

  list.addEventListener('dragstart', (event) => {
    const card = event.target.closest('[data-section-id]')
    if (!card) return
    dragSectionId = card.dataset.sectionId
    card.classList.add('is-dragging')
    event.dataTransfer?.setData('text/plain', dragSectionId)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  })

  list.addEventListener('dragover', (event) => {
    const card = event.target.closest('[data-section-id]')
    if (!card || card.dataset.sectionId === dragSectionId) return
    event.preventDefault()
    card.classList.add('is-drop-target')
  })

  list.addEventListener('dragleave', (event) => {
    event.target.closest('[data-section-id]')?.classList.remove('is-drop-target')
  })

  list.addEventListener('drop', (event) => {
    const target = event.target.closest('[data-section-id]')
    if (!target || !dragSectionId || target.dataset.sectionId === dragSectionId) return
    event.preventDefault()
    const from = sections.findIndex((section) => section.id === dragSectionId)
    const to = sections.findIndex((section) => section.id === target.dataset.sectionId)
    if (from >= 0 && to >= 0) {
      sections = moveSection(sections, dragSectionId, to - from)
      markDirty()
      renderSections()
    }
    dragSectionId = null
  })

  list.addEventListener('dragend', () => {
    dragSectionId = null
    list.querySelectorAll('.is-dragging,.is-drop-target').forEach((node) => node.classList.remove('is-dragging', 'is-drop-target'))
  })

  async function persistDraft() {
    if (busy) return false
    setBusy(true)
    setStatus('Guardando…')
    setNote('')
    try {
      await saveDraft(sections)
      dirty = false
      setStatus('Borrador guardado')
      setNote('Borrador guardado. Puedes abrir Vista previa o seguir editando.')
      await cleanupMedia()
      return true
    } catch (error) {
      setStatus('No guardado', 'dirty')
      setNote(error?.message || 'No se pudo guardar el borrador.')
      return false
    } finally {
      setBusy(false)
    }
  }

  saveButton.addEventListener('click', persistDraft)

  previewButton.addEventListener('click', async () => {
    const previewWindow = window.open('', '_blank')
    if (previewWindow) previewWindow.opener = null
    const ready = dirty ? await persistDraft() : true
    if (!ready) {
      previewWindow?.close()
      return
    }
    if (previewWindow) previewWindow.location.href = 'index.html?preview=draft'
    else window.open('index.html?preview=draft', '_blank', 'noopener')
  })

  publishButton.addEventListener('click', async () => {
    if (!window.confirm('¿Publicar este borrador en la página principal?')) return
    if (dirty && !(await persistDraft())) return
    setBusy(true)
    setStatus('Publicando…')
    setNote('')
    try {
      await publishDraft()
      dirty = false
      setStatus('Publicado', 'published')
      setNote('La página principal ya muestra esta versión.')
      await cleanupMedia()
    } catch (error) {
      setStatus('Borrador guardado')
      setNote(error?.message || 'No se pudo publicar. El sitio público no cambió.')
    } finally {
      setBusy(false)
    }
  })

  addButton.addEventListener('click', () => {
    const section = createSection(templateSelect.value)
    sections.push(section)
    sections = normalizeSectionPositions(sections)
    ensureUniqueAnchor(section, sections)
    openSections.add(section.id)
    localeBySection.set(section.id, 'es')
    markDirty()
    renderSections()
  })

  setBusy(true)
  try {
    const draft = await getDraftLanding()
    sections = normalizeSectionPositions(draft?.sections || [])
    setStatus('Borrador guardado')
    setNote('Edita una sección o agrega una nueva.')
    renderSections()
  } catch (error) {
    setStatus('No disponible', 'dirty')
    setNote(error?.message || 'No se pudo cargar el borrador.')
  } finally {
    setBusy(false)
  }
}
