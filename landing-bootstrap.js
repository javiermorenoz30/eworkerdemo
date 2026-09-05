import { getDraftLanding, getPublishedLanding } from './landing-api.js'
import { renderLanding } from './landing-renderer.js'

function showDraftPreviewBanner() {
  if (document.querySelector('.landing-preview-banner')) return
  const banner = document.createElement('div')
  banner.className = 'landing-preview-banner'
  banner.textContent = 'Vista previa del borrador'
  banner.style.cssText = 'position:fixed;left:50%;top:12px;z-index:2147483647;transform:translateX(-50%);padding:9px 15px;border-radius:999px;background:#fff6d9;color:#6d5618;box-shadow:0 10px 30px rgba(0,0,0,.18);font:800 12px/1.2 system-ui,sans-serif'
  document.body.append(banner)

  let robots = document.querySelector('meta[name="robots"]')
  if (!robots) {
    robots = document.createElement('meta')
    robots.name = 'robots'
    document.head.append(robots)
  }
  robots.content = 'noindex,nofollow'
}

export async function bootPublishedLanding() {
  const root = document.querySelector('main')
  if (!root) return false
  const preview = new URLSearchParams(window.location.search).get('preview') === 'draft'

  try {
    const landing = preview ? await getDraftLanding() : await getPublishedLanding()
    const sections = Array.isArray(landing?.sections) ? landing.sections : []
    if (!sections.length) return false
    renderLanding(root, sections, { locale: document.documentElement.lang === 'en' ? 'en' : 'es' })
    root.dataset.landingSource = preview ? 'draft-preview' : 'published'
    if (preview) showDraftPreviewBanner()
    return true
  } catch (error) {
    console.warn(`No pudimos cargar ${preview ? 'el borrador' : 'el contenido publicado'}. Se mantiene la versión incluida en la página.`, error)
    root.dataset.landingSource = 'fallback'
    return false
  }
}
