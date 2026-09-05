import { localizedValue } from './landing-content.js'
import { publicLandingImageUrl } from './landing-api.js'

const create = (tag, className = '') => {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

const textValue = (value, locale = 'es') => String(localizedValue(value, locale) ?? '')

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character])
}

function safeLocalizedHtml(value, highlight) {
  const text = String(value ?? '')
  const marked = String(highlight ?? '')
  if (!marked) return escapeHtml(text)
  const index = text.toLocaleLowerCase().indexOf(marked.toLocaleLowerCase())
  if (index < 0) return escapeHtml(text)
  return `${escapeHtml(text.slice(0, index))}<em>${escapeHtml(text.slice(index, index + marked.length))}</em>${escapeHtml(text.slice(index + marked.length))}`
}

function setLocalized(node, value, locale = 'es') {
  const es = textValue(value, 'es')
  const en = textValue(value, 'en') || es
  node.dataset.es = escapeHtml(es)
  node.dataset.en = escapeHtml(en)
  node.textContent = locale === 'en' ? en : es
  return node
}

function setLocalizedTitle(node, value, highlight, locale = 'es') {
  const es = textValue(value, 'es')
  const en = textValue(value, 'en') || es
  const esHighlight = textValue(highlight, 'es')
  const enHighlight = textValue(highlight, 'en') || esHighlight
  node.dataset.es = safeLocalizedHtml(es, esHighlight)
  node.dataset.en = safeLocalizedHtml(en, enHighlight)

  const current = locale === 'en' ? en : es
  const marked = locale === 'en' ? enHighlight : esHighlight
  const index = marked ? current.toLocaleLowerCase().indexOf(marked.toLocaleLowerCase()) : -1
  if (index < 0) {
    node.textContent = current
    return node
  }
  node.append(document.createTextNode(current.slice(0, index)))
  const emphasis = create('em')
  emphasis.textContent = current.slice(index, index + marked.length)
  node.append(emphasis, document.createTextNode(current.slice(index + marked.length)))
  return node
}

function localizedNode(tag, value, locale, className = '') {
  return setLocalized(create(tag, className), value, locale)
}

function titleNode(tag, content, locale, className = '') {
  return setLocalizedTitle(create(tag, className), content.title, content.highlight, locale)
}

function eyebrow(value, locale, prefix = '') {
  const node = create('p', 'eyebrow')
  if (prefix) node.append(document.createTextNode(`${prefix} / `))
  node.append(localizedNode('b', value, locale))
  return node
}

function linkNode(link, locale, className = '') {
  const node = create('a', className)
  node.href = String(link?.href || '#')
  setLocalized(node, link?.label || '', locale)
  if (/^https?:\/\//i.test(node.href) || String(link?.href || '').startsWith('http')) {
    node.target = '_blank'
    node.rel = 'noopener'
  }
  return node
}

function imageNode(image, locale, className = '') {
  const node = create('img', className)
  const path = String(image?.path || '')
  node.src = publicLandingImageUrl(path)
  node.alt = textValue(image?.alt || '', locale)
  node.loading = 'lazy'
  let usedFallback = false
  node.addEventListener('error', () => {
    const fallback = String(image?.fallback || '')
    if (fallback && !usedFallback) {
      usedFallback = true
      node.src = publicLandingImageUrl(fallback)
      return
    }
    node.hidden = true
  })
  return node
}

function renderHero(content, locale) {
  const section = create('section', 'hero')
  section.id = content.id || 'inicio'
  const copy = create('div', 'hero-copy')
  copy.append(eyebrow(content.eyebrow, locale))
  copy.append(titleNode('h1', content, locale))
  copy.append(localizedNode('p', content.description, locale, 'lede'))

  const actions = create('div', 'cta-row')
  if (content.primaryButton?.label) actions.append(linkNode(content.primaryButton, locale, 'button'))
  if (content.secondaryButton?.label) actions.append(linkNode(content.secondaryButton, locale, 'text-link'))
  copy.append(actions)

  const art = create('div', 'hero-art')
  if (content.image?.path) {
    const picture = create('picture')
    const image = imageNode(content.image, locale)
    image.fetchPriority = 'high'
    picture.append(image)
    art.append(picture)
  }
  art.append(create('div', 'orbit orbit-one'), create('div', 'orbit orbit-two'))
  const location = create('div', 'location')
  location.append(document.createTextNode(`● ${content.location || 'LA VEGA'} `))
  const suffix = create('small')
  suffix.textContent = content.locationSuffix || '↗ GLOBAL'
  location.append(suffix)
  art.append(location)

  const hint = create('div', 'scroll-hint')
  hint.append(create('span'), localizedNode('b', content.scrollHint || { es: 'EXPLORA', en: 'EXPLORE' }, locale))
  section.append(copy, art, hint)
  return section
}

function renderMetrics(content, locale) {
  const section = create('section', 'metrics')
  for (const item of content.items || []) {
    const article = create('article', item.variant || '')
    const strong = create('strong')
    strong.textContent = String(item.value ?? '')
    article.append(strong, localizedNode('span', item.label, locale))
    section.append(article)
  }
  return section
}

function renderRoutes(content, locale) {
  const section = create('section', 'split-section')
  const intro = create('div', 'section-intro')
  intro.append(eyebrow(content.eyebrow, locale, '01'), titleNode('h2', content, locale))
  const grid = create('div', 'route-grid')
  for (const item of content.items || []) {
    const card = create('a', `route-card ${item.variant || ''}`.trim())
    card.href = item.link?.href || '#'
    const number = create('span')
    number.textContent = item.number || ''
    card.append(number, localizedNode('h3', item.title, locale), localizedNode('p', item.description, locale), localizedNode('b', item.link?.label, locale))
    grid.append(card)
  }
  section.append(intro, grid)
  return section
}

function renderServices(content, locale) {
  const fragment = document.createDocumentFragment()
  const section = create('section', 'services section-pad')
  section.id = content.id || 'servicios'
  section.append(eyebrow(content.eyebrow, locale, '02'))
  const heading = create('div', 'section-title')
  heading.append(titleNode('h2', content, locale), localizedNode('p', content.description, locale))
  section.append(heading)
  const grid = create('div', 'service-grid')
  for (const item of content.items || []) {
    const article = create('article', item.variant || '')
    const number = create('b')
    number.textContent = item.number || item.icon || ''
    article.append(number, localizedNode('h3', item.title, locale), localizedNode('p', item.description, locale))
    grid.append(article)
  }
  section.append(grid)
  fragment.append(section)

  if (content.details?.length) {
    const details = create('section', 'service-detail-strip')
    for (const item of content.details) {
      const article = create('article')
      article.append(localizedNode('b', item.title, locale), localizedNode('p', item.description, locale))
      details.append(article)
    }
    fragment.append(details)
  }
  return fragment
}

function renderObjectives(content, locale) {
  const section = create('section', 'objectives section-pad')
  section.id = content.id || 'objetivos'
  section.append(eyebrow(content.eyebrow, locale, '05'), titleNode('h2', content, locale))
  const list = create('div', 'objective-list')
  for (const item of content.items || []) {
    const article = create('article')
    const icon = create('span')
    icon.textContent = item.icon || item.number || '•'
    const body = create('div')
    body.append(localizedNode('h3', item.title, locale), localizedNode('p', item.description, locale))
    article.append(icon, body)
    list.append(article)
  }
  section.append(list)
  return section
}

function renderTimeline(content, locale) {
  const section = create('section', 'timeline section-pad')
  section.id = content.id || 'recursos'
  section.append(eyebrow(content.eyebrow, locale, '07'))
  const grid = create('div', 'timeline-grid')
  for (const item of content.items || []) {
    const article = create('article')
    const value = create('b')
    value.textContent = item.value || item.icon || ''
    article.append(value, localizedNode('h3', item.title, locale), localizedNode('p', item.description, locale))
    grid.append(article)
  }
  section.append(grid)
  return section
}

function renderCards(content, locale) {
  if (content.variant === 'services') return renderServices(content, locale)
  if (content.variant === 'objectives') return renderObjectives(content, locale)
  if (content.variant === 'timeline') return renderTimeline(content, locale)
  return renderServices({ ...content, variant: 'services' }, locale)
}

function renderBusiness(content, locale) {
  const section = create('section', 'business-section section-pad')
  section.id = content.id || 'empresas'
  const body = create('div')
  body.append(eyebrow(content.eyebrow, locale, '03'), titleNode('h2', content, locale), localizedNode('p', content.description, locale, 'lede'))
  if (content.bullets?.length) {
    const list = create('ul', 'checklist')
    for (const item of content.bullets) {
      const li = localizedNode('li', item.text || item, locale)
      list.append(li)
    }
    body.append(list)
  }
  const process = create('aside', 'process-card')
  process.append(localizedNode('p', content.methodTitle || { es: 'NUESTRO MÉTODO', en: 'OUR METHOD' }, locale))
  if (content.steps?.length) {
    const list = create('ol')
    content.steps.forEach((step, index) => {
      const li = create('li')
      const number = create('span')
      number.textContent = String(index + 1).padStart(2, '0')
      li.append(number, localizedNode('b', step.text || step, locale))
      list.append(li)
    })
    process.append(list)
  }
  if (content.button?.label) process.append(linkNode(content.button, locale, 'button button-outline'))
  section.append(body, process)
  return section
}

function renderCulture(content, locale) {
  const section = create('section', 'culture section-pad')
  section.id = content.id || 'nosotros'
  if (content.image?.path) {
    const photo = create('div', 'team-photo')
    photo.append(imageNode(content.image, locale))
    const caption = create('span')
    caption.textContent = content.imageCaption || ''
    photo.append(caption)
    section.append(photo)
  }
  const body = create('div')
  body.append(eyebrow(content.eyebrow, locale, '04'), titleNode('h2', content, locale), localizedNode('p', content.description, locale))
  if (content.vision?.text) {
    const vision = create('p', 'vision')
    const label = localizedNode('b', content.vision.label, locale)
    vision.append(label, document.createTextNode(' '), localizedNode('span', content.vision.text, locale))
    body.append(vision)
  }
  if (content.values?.length) {
    const values = create('div', 'values')
    content.values.forEach((value) => {
      const chip = create('span')
      chip.textContent = typeof value === 'string' ? value : textValue(value, locale)
      values.append(chip)
    })
    body.append(values)
  }
  section.append(body)
  return section
}

function renderTextImage(content, locale) {
  if (content.variant === 'culture') return renderCulture(content, locale)
  return renderBusiness(content, locale)
}

function renderJobs(content, locale) {
  const section = create('section', 'jobs section-pad')
  section.id = content.id || 'vacantes'
  section.append(eyebrow(content.eyebrow, locale, '06'))
  const heading = create('div', 'section-title')
  heading.append(titleNode('h2', content, locale), localizedNode('p', content.description, locale))
  section.append(heading)

  const tools = create('div', 'job-tools')
  const searchLabel = create('label')
  searchLabel.append(localizedNode('span', { es: 'Buscar oportunidad', en: 'Search opportunities' }, locale))
  const search = create('input')
  search.id = 'job-search'
  search.type = 'search'
  search.placeholder = 'Atención al cliente, ventas…'
  searchLabel.append(search)
  tools.append(searchLabel)
  const filters = content.filters?.length ? content.filters : [{ value: 'all', label: { es: 'Todas', en: 'All' } }]
  filters.forEach((filter, index) => {
    const button = localizedNode('button', filter.label || filter.value, locale, `filter${index === 0 ? ' active' : ''}`)
    button.type = 'button'
    button.dataset.filter = filter.value || 'all'
    tools.append(button)
  })
  section.append(tools)

  const list = create('div', 'job-list')
  list.id = 'job-list'
  for (const item of content.items || []) {
    const article = create('article')
    article.dataset.area = item.area || ''
    const body = create('div')
    if (item.badge) body.append(localizedNode('span', item.badge, locale))
    body.append(localizedNode('h3', item.title, locale), localizedNode('p', item.description, locale))
    const apply = create('a', 'round-link')
    apply.href = item.href || 'application.html'
    apply.textContent = '↗'
    apply.setAttribute('aria-label', `${locale === 'en' ? 'Apply to' : 'Aplicar a'} ${textValue(item.title, locale)}`)
    article.append(body, apply)
    list.append(article)
  }
  section.append(list)
  if (content.note) section.append(localizedNode('p', content.note, locale, 'jobs-note'))
  return section
}

function renderCta(content, locale) {
  const section = create('section', `${content.variant === 'employment' ? 'employment' : 'employment'} section-pad`)
  section.id = content.id || 'aplicar'
  const copy = create('div', 'employment-copy')
  copy.append(eyebrow(content.eyebrow, locale, '06'), titleNode('h2', content, locale), localizedNode('p', content.description, locale))
  if (content.perks?.length) {
    const perks = create('div', 'application-perks')
    for (const perk of content.perks) {
      const span = create('span')
      span.append(document.createTextNode('✓ '), localizedNode('b', perk.text || perk, locale))
      perks.append(span)
    }
    copy.append(perks)
  }
  if (content.button?.label) copy.append(linkNode(content.button, locale, 'button'))
  section.append(copy)
  return section
}

function renderGallery(content, locale) {
  const section = create('section', 'news section-pad')
  section.id = content.id || 'noticias'
  const heading = create('div', 'news-heading')
  heading.append(eyebrow(content.eyebrow, locale, '08'), titleNode('h2', content, locale), localizedNode('p', content.description, locale))
  section.append(heading)
  const grid = create('div', 'news-grid')
  for (const item of content.items || []) {
    const article = create('article', 'news-card')
    if (item.image?.path) article.append(imageNode(item.image, locale))
    const body = create('div')
    if (item.meta) {
      const meta = create('span')
      meta.textContent = item.meta
      body.append(meta)
    }
    body.append(localizedNode('h3', item.title, locale), localizedNode('p', item.description, locale))
    if (item.link?.label) body.append(linkNode(item.link, locale, 'news-link'))
    article.append(body)
    grid.append(article)
  }
  section.append(grid)
  return section
}

function renderTestimonials(content, locale) {
  const section = create('section', 'news section-pad testimonials')
  const heading = create('div', 'news-heading')
  heading.append(eyebrow(content.eyebrow, locale), localizedNode('h2', content.title, locale))
  section.append(heading)
  const grid = create('div', 'news-grid')
  for (const item of content.items || []) {
    const article = create('article', 'news-card')
    if (item.image?.path) article.append(imageNode(item.image, locale))
    const body = create('div')
    body.append(localizedNode('p', item.quote, locale), localizedNode('h3', item.name, locale))
    article.append(body)
    grid.append(article)
  }
  section.append(grid)
  return section
}

function renderContact(content, locale) {
  const section = create('section', 'contact')
  section.id = content.id || 'contacto'
  const details = create('div')
  details.append(eyebrow(content.eyebrow, locale), titleNode('h2', content, locale), localizedNode('p', content.address, locale))
  const links = create('div', 'contact-details')
  for (const item of content.details || []) {
    const link = create('a')
    link.href = item.href || '#'
    link.textContent = item.label || ''
    if (/^https?:\/\//i.test(item.href || '')) {
      link.target = '_blank'
      link.rel = 'noopener'
    }
    links.append(link)
  }
  details.append(links)

  const form = create('form')
  form.id = 'contact-form'
  const switcher = create('div', 'form-switch')
  const business = localizedNode('button', { es: 'Soy una empresa', en: "I'm a business" }, locale, 'audience active')
  business.type = 'button'
  business.dataset.audience = 'Empresa'
  const talent = localizedNode('button', { es: 'Busco empleo', en: "I'm looking for work" }, locale, 'audience')
  talent.type = 'button'
  talent.dataset.audience = 'Talento'
  switcher.append(business, talent)
  form.append(switcher)

  const hidden = create('input')
  hidden.type = 'hidden'
  hidden.name = 'audience'
  hidden.value = 'Empresa'
  form.append(hidden)

  const fields = [
    ['name', 'text', { es: 'Nombre', en: 'Name' }],
    ['email', 'email', { es: 'Email', en: 'Email' }],
    ['subject', 'text', { es: 'Asunto', en: 'Subject' }],
  ]
  for (const [name, type, labelValue] of fields) {
    const label = create('label')
    label.append(localizedNode('span', labelValue, locale))
    const input = create('input')
    input.name = name
    input.type = type
    input.required = true
    label.append(input)
    form.append(label)
  }
  const messageLabel = create('label')
  messageLabel.append(localizedNode('span', { es: '¿Cómo podemos ayudarte?', en: 'How can we help?' }, locale))
  const textarea = create('textarea')
  textarea.name = 'message'
  textarea.rows = 3
  textarea.required = true
  messageLabel.append(textarea)
  form.append(messageLabel)

  const consent = create('label', 'consent')
  const checkbox = create('input')
  checkbox.type = 'checkbox'
  checkbox.required = true
  consent.append(checkbox, document.createTextNode(' '), localizedNode('span', { es: 'Acepto el aviso de privacidad.', en: 'I accept the privacy notice.' }, locale))
  form.append(consent)

  const submit = localizedNode('button', { es: 'Enviar mensaje', en: 'Send message' }, locale, 'button')
  submit.type = 'submit'
  form.append(submit)
  const note = create('p', 'form-note')
  note.id = 'form-note'
  note.setAttribute('aria-live', 'polite')
  form.append(note)
  section.append(details, form)
  return section
}

function renderFaq(content, locale) {
  const section = create('section', 'faq section-pad')
  section.append(eyebrow(content.eyebrow, locale, '07'), titleNode('h2', content, locale))
  for (const item of content.items || []) {
    const details = create('details')
    details.append(localizedNode('summary', item.question, locale), localizedNode('p', item.answer, locale))
    section.append(details)
  }
  return section
}

const renderers = {
  'hero': renderHero,
  'metrics': renderMetrics,
  'cards': renderCards,
  'text_image': renderTextImage,
  'routes': renderRoutes,
  'jobs': renderJobs,
  'gallery': renderGallery,
  'testimonials': renderTestimonials,
  'cta': renderCta,
  'contact': renderContact,
  'faq': renderFaq,
}

export function renderLanding(root, sections = [], { locale = 'es' } = {}) {
  if (!root) throw new Error('No encontramos el contenedor de la página principal.')
  const fragment = document.createDocumentFragment()
  const ordered = [...sections].filter((section) => section?.visible !== false).sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
  for (const section of ordered) {
    const renderer = renderers[section.type]
    if (!renderer) continue
    fragment.append(renderer(section.content || {}, locale))
  }
  root.replaceChildren(fragment)
}
