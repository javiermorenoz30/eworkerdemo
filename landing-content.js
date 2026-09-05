export const localized = (es = '', en = '') => ({ es, en })

export function localizedValue(value, locale = 'es') {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object' || Array.isArray(value)) return value
  if (locale === 'en') return value.en || value.es || ''
  return value.es || value.en || ''
}

const text = (key, label) => ({ key, label, type: 'text' })
const localizedText = (key, label) => ({ key, label, type: 'localizedText' })
const localizedTextarea = (key, label) => ({ key, label, type: 'localizedTextarea' })
const image = (key, label) => ({ key, label, type: 'image' })
const localizedLink = (key, label) => ({ key, label, type: 'localizedLink' })
const array = (key, label, itemFields) => ({ key, label, type: 'array', itemFields })

export const LANDING_TEMPLATES = {
  hero: {
    label: 'Portada',
    fields: [
      localizedText('eyebrow', 'Texto pequeño'),
      localizedText('title', 'Título'),
      localizedText('highlight', 'Palabras destacadas'),
      localizedTextarea('description', 'Descripción'),
      localizedLink('primaryButton', 'Botón principal'),
      localizedLink('secondaryButton', 'Enlace secundario'),
      image('image', 'Foto principal'),
    ],
    defaults: {
      eyebrow: localized('NUEVA SECCIÓN', 'NEW SECTION'),
      title: localized('Título de portada', 'Hero title'),
      highlight: localized('', ''),
      description: localized('', ''),
      primaryButton: { label: localized('Conocer más', 'Learn more'), href: '#contacto' },
      secondaryButton: { label: localized('', ''), href: '' },
      image: { path: '', alt: localized('', '') },
    },
  },
  metrics: {
    label: 'Métricas',
    fields: [
      array('items', 'Métricas', [
        text('value', 'Valor'),
        localizedText('label', 'Descripción'),
      ]),
    ],
    defaults: {
      items: [
        { value: '100+', label: localized('Dato destacado', 'Featured metric') },
      ],
    },
  },
  cards: {
    label: 'Tarjetas / Servicios',
    fields: [
      localizedText('eyebrow', 'Texto pequeño'),
      localizedText('title', 'Título'),
      localizedText('highlight', 'Palabras destacadas'),
      localizedTextarea('description', 'Descripción'),
      array('items', 'Tarjetas', [
        text('icon', 'Icono o número'),
        localizedText('title', 'Título'),
        localizedTextarea('description', 'Descripción'),
      ]),
    ],
    defaults: {
      variant: 'services',
      eyebrow: localized('SERVICIOS', 'SERVICES'),
      title: localized('Nuestros servicios', 'Our services'),
      highlight: localized('', ''),
      description: localized('', ''),
      items: [
        { icon: '01', title: localized('Nuevo servicio', 'New service'), description: localized('', '') },
      ],
    },
  },
  text_image: {
    label: 'Texto + imagen',
    fields: [
      image('image', 'Foto'),
      localizedText('eyebrow', 'Texto pequeño'),
      localizedText('title', 'Título'),
      localizedText('highlight', 'Palabras destacadas'),
      localizedTextarea('description', 'Descripción'),
      array('bullets', 'Puntos destacados', [
        localizedText('text', 'Texto'),
      ]),
      localizedLink('button', 'Botón'),
    ],
    defaults: {
      variant: 'general',
      image: { path: '', alt: localized('', '') },
      eyebrow: localized('', ''),
      title: localized('Título de sección', 'Section title'),
      highlight: localized('', ''),
      description: localized('', ''),
      bullets: [],
      button: { label: localized('', ''), href: '' },
    },
  },
  routes: {
    label: 'Dos opciones',
    fields: [
      localizedText('eyebrow', 'Texto pequeño'),
      localizedText('title', 'Título'),
      localizedText('highlight', 'Palabras destacadas'),
      array('items', 'Opciones', [
        localizedText('title', 'Título'),
        localizedTextarea('description', 'Descripción'),
        localizedLink('link', 'Enlace'),
      ]),
    ],
    defaults: {
      eyebrow: localized('ELIGE TU RUTA', 'CHOOSE YOUR PATH'),
      title: localized('¿Qué necesitas?', 'What do you need?'),
      highlight: localized('', ''),
      items: [
        { number: '01', variant: 'business', title: localized('Primera opción', 'First option'), description: localized('', ''), link: { label: localized('Ver más', 'Learn more'), href: '#contacto' } },
        { number: '02', variant: 'talent', title: localized('Segunda opción', 'Second option'), description: localized('', ''), link: { label: localized('Ver más', 'Learn more'), href: '#contacto' } },
      ],
    },
  },
  jobs: {
    label: 'Vacantes',
    fields: [
      localizedText('eyebrow', 'Texto pequeño'),
      localizedText('title', 'Título'),
      localizedText('highlight', 'Palabras destacadas'),
      localizedTextarea('description', 'Descripción'),
      array('items', 'Vacantes', [
        text('area', 'Área'),
        localizedText('title', 'Puesto'),
        localizedTextarea('description', 'Detalles'),
      ]),
      localizedTextarea('note', 'Nota final'),
    ],
    defaults: {
      eyebrow: localized('VACANTES', 'JOBS'),
      title: localized('Oportunidades disponibles', 'Open opportunities'),
      highlight: localized('', ''),
      description: localized('', ''),
      filters: [{ value: 'all', label: localized('Todas', 'All') }],
      items: [],
      note: localized('', ''),
    },
  },
  gallery: {
    label: 'Galería / Recursos',
    fields: [
      localizedText('eyebrow', 'Texto pequeño'),
      localizedText('title', 'Título'),
      localizedText('highlight', 'Palabras destacadas'),
      localizedTextarea('description', 'Descripción'),
      array('items', 'Elementos', [
        image('image', 'Foto'),
        localizedText('title', 'Título'),
        localizedTextarea('description', 'Descripción'),
        localizedLink('link', 'Enlace'),
      ]),
    ],
    defaults: {
      variant: 'resources',
      eyebrow: localized('RECURSOS', 'RESOURCES'),
      title: localized('Galería', 'Gallery'),
      highlight: localized('', ''),
      description: localized('', ''),
      items: [],
    },
  },
  testimonials: {
    label: 'Testimonios / Logos',
    fields: [
      localizedText('eyebrow', 'Texto pequeño'),
      localizedText('title', 'Título'),
      array('items', 'Testimonios', [
        image('image', 'Foto o logo'),
        localizedTextarea('quote', 'Testimonio'),
        localizedText('name', 'Nombre'),
      ]),
    ],
    defaults: {
      eyebrow: localized('TESTIMONIOS', 'TESTIMONIALS'),
      title: localized('Lo que dicen de nosotros', 'What people say about us'),
      items: [],
    },
  },
  cta: {
    label: 'Llamado a la acción',
    fields: [
      localizedText('eyebrow', 'Texto pequeño'),
      localizedText('title', 'Título'),
      localizedText('highlight', 'Palabras destacadas'),
      localizedTextarea('description', 'Descripción'),
      array('perks', 'Beneficios', [localizedText('text', 'Texto')]),
      localizedLink('button', 'Botón'),
    ],
    defaults: {
      variant: 'general',
      eyebrow: localized('', ''),
      title: localized('¿Listo para comenzar?', 'Ready to get started?'),
      highlight: localized('', ''),
      description: localized('', ''),
      perks: [],
      button: { label: localized('Contactar', 'Contact'), href: '#contacto' },
    },
  },
  contact: {
    label: 'Contacto',
    fields: [
      localizedText('eyebrow', 'Texto pequeño'),
      localizedText('title', 'Título'),
      localizedText('highlight', 'Palabras destacadas'),
      localizedTextarea('address', 'Dirección'),
      array('details', 'Datos de contacto', [
        text('label', 'Texto'),
        text('href', 'Destino'),
      ]),
    ],
    defaults: {
      id: 'contacto',
      eyebrow: localized('CONVERSEMOS', "LET'S TALK"),
      title: localized('Hablemos', "Let's talk"),
      highlight: localized('', ''),
      address: localized('', ''),
      details: [],
    },
  },
  faq: {
    label: 'Preguntas frecuentes',
    fields: [
      localizedText('eyebrow', 'Texto pequeño'),
      localizedText('title', 'Título'),
      localizedText('highlight', 'Palabras destacadas'),
      array('items', 'Preguntas', [
        localizedText('question', 'Pregunta'),
        localizedTextarea('answer', 'Respuesta'),
      ]),
    ],
    defaults: {
      eyebrow: localized('FAQ', 'FAQ'),
      title: localized('Preguntas frecuentes', 'Frequently asked questions'),
      highlight: localized('', ''),
      items: [],
    },
  },
}

function clone(value) {
  return structuredClone(value)
}

export function normalizeSectionPositions(sections = []) {
  return clone(sections).map((section, position) => ({ ...section, position }))
}

export function moveSection(sections = [], id, delta) {
  const result = normalizeSectionPositions(sections)
  const from = result.findIndex((section) => section.id === id)
  if (from < 0 || !Number.isFinite(delta) || delta === 0) return result
  const to = Math.max(0, Math.min(result.length - 1, from + Math.trunc(delta)))
  if (from === to) return result
  const [section] = result.splice(from, 1)
  result.splice(to, 0, section)
  return normalizeSectionPositions(result)
}

export function duplicateSection(sections = [], id, newId = crypto.randomUUID()) {
  const result = normalizeSectionPositions(sections)
  const index = result.findIndex((section) => section.id === id)
  if (index < 0) return result
  const copy = clone(result[index])
  copy.id = newId
  result.splice(index + 1, 0, copy)
  return normalizeSectionPositions(result)
}

export function removeSection(sections = [], id) {
  return normalizeSectionPositions(sections.filter((section) => section.id !== id))
}

export function createSection(type, id = crypto.randomUUID()) {
  const template = LANDING_TEMPLATES[type]
  if (!template) throw new Error(`Plantilla desconocida: ${type}`)
  return {
    id,
    type,
    position: 0,
    visible: true,
    content: clone(template.defaults),
  }
}
