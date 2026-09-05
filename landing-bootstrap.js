import { getPublishedLanding } from './landing-api.js'
import { renderLanding } from './landing-renderer.js'

export async function bootPublishedLanding() {
  const root = document.querySelector('main')
  if (!root) return false

  try {
    const landing = await getPublishedLanding()
    const sections = Array.isArray(landing?.sections) ? landing.sections : []
    if (!sections.length) return false
    renderLanding(root, sections, { locale: document.documentElement.lang === 'en' ? 'en' : 'es' })
    root.dataset.landingSource = 'published'
    return true
  } catch (error) {
    console.warn('No pudimos cargar el contenido publicado. Se mantiene la versión incluida en la página.', error)
    root.dataset.landingSource = 'fallback'
    return false
  }
}
