const html = document.documentElement
const button = document.querySelector('#language')
const menuToggle = document.querySelector('#menu-toggle'); const mainNav = document.querySelector('#main-nav'); menuToggle?.addEventListener('click',()=>{const open=mainNav.classList.toggle('menu-open');menuToggle.setAttribute('aria-expanded',String(open))}); mainNav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{mainNav.classList.remove('menu-open');menuToggle?.setAttribute('aria-expanded','false')}))
const original = new Map([...document.querySelectorAll('[data-es]')].map((node) => [node, node.innerHTML]))
let locale = 'es'
function changeLanguage() { locale = locale === 'es' ? 'en' : 'es'; html.lang = locale; button.textContent = locale === 'es' ? 'EN' : 'ES'; document.querySelectorAll('[data-es]').forEach((node) => { node.innerHTML = node.dataset[locale] || original.get(node) }); document.querySelectorAll('.hero-art img').forEach((image) => { image.alt = locale === 'es' ? 'Profesional dominicana conectada a una red global de oportunidades' : 'Dominican professional connected to a global opportunity network' }) }
button.addEventListener('click', changeLanguage)
document.querySelectorAll('.filter').forEach((filter) => filter.addEventListener('click', () => { document.querySelectorAll('.filter').forEach((item) => item.classList.remove('active')); filter.classList.add('active'); document.querySelectorAll('#job-list article').forEach((job) => { job.hidden = filter.dataset.filter !== 'all' && job.dataset.area !== filter.dataset.filter }) }))
document.querySelector('#job-search').addEventListener('input', (event) => { const query = event.target.value.toLowerCase(); document.querySelectorAll('#job-list article').forEach((job) => { job.hidden = !job.textContent.toLowerCase().includes(query) }) })
document.querySelectorAll('.audience').forEach((audience) => audience.addEventListener('click', () => { document.querySelectorAll('.audience').forEach((item) => item.classList.remove('active')); audience.classList.add('active'); document.querySelector('[name=audience]').value = audience.dataset.audience }))
document.querySelector('#contact-form').addEventListener('submit', (event) => { event.preventDefault(); document.querySelector('#form-note').textContent = locale === 'es' ? 'Gracias. Tu mensaje está listo para ser enviado al equipo de eWorker360.' : 'Thank you. Your message is ready to be sent to the eWorker360 team.'; event.currentTarget.reset() })
const employmentForm = document.querySelector('#employment-form')
if (employmentForm) {
  employmentForm.style.display = 'none'
  employmentForm.closest('.employment').classList.add('form-launcher')
  const launch = document.createElement('a')
  launch.className = 'button'
  launch.href = 'application.html'
  launch.target = '_blank'
  launch.rel = 'noopener'
  launch.textContent = locale === 'es' ? 'Abrir formulario de solicitud ↗' : 'Open application form ↗'
  employmentForm.closest('.employment').querySelector('.employment-copy').append(launch)
}
document.querySelectorAll('.job-list .round-link').forEach((link) => { link.href = 'application.html'; link.target = '_blank'; link.rel = 'noopener' })
const mainNavigation = document.querySelector('.site-header nav')
const jobsNavigationLink = mainNavigation?.querySelector('a[href="#vacantes"]')
if (mainNavigation && jobsNavigationLink) {
  const applicationNavigationLink = document.createElement('a')
  applicationNavigationLink.href = 'application.html'
  applicationNavigationLink.target = '_blank'
  applicationNavigationLink.rel = 'noopener'
  applicationNavigationLink.dataset.es = 'Aplicar'
  applicationNavigationLink.dataset.en = 'Apply'
  applicationNavigationLink.textContent = 'Aplicar'
  jobsNavigationLink.insertAdjacentElement('afterend', applicationNavigationLink)
}
const heroActions = document.querySelector('.hero .cta-row')
if (heroActions) {
  const heroApplicationLink = document.createElement('a')
  heroApplicationLink.className = 'text-link hero-apply'
  heroApplicationLink.href = 'application.html'
  heroApplicationLink.target = '_blank'
  heroApplicationLink.rel = 'noopener'
  heroApplicationLink.dataset.es = 'Completa tu solicitud'
  heroApplicationLink.dataset.en = 'Complete your application'
  heroApplicationLink.innerHTML = 'Completa tu solicitud <b>↗</b>'
  heroActions.append(heroApplicationLink)
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (!reducedMotion) {
  const revealSections = document.querySelectorAll('.metrics, .split-section, .services, .business-section, .culture, .objectives, .jobs, .employment, .timeline, .news, .contact, .faq')
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    })
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' })

  revealSections.forEach((section, index) => {
    section.classList.add('reveal')
    section.style.setProperty('--reveal-delay', `${(index % 3) * 85}ms`)
    revealObserver.observe(section)
  })

  const hero = document.querySelector('.hero')
  if (hero) {
    const field = document.createElement('div')
    field.className = 'motion-particles'
    Array.from({ length: 13 }).forEach((_, index) => {
      const particle = document.createElement('i')
      particle.style.left = `${11 + ((index * 17) % 79)}%`
      particle.style.top = `${13 + ((index * 29) % 70)}%`
      particle.style.setProperty('--motion-x', `${index % 2 ? 24 : -18}px`)
      particle.style.setProperty('--motion-y', `${-20 - ((index % 4) * 13)}px`)
      particle.style.setProperty('--motion-duration', `${7 + (index % 4) * 1.4}s`)
      particle.style.setProperty('--motion-delay', `${-(index % 5)}s`)
      field.append(particle)
    })
    hero.prepend(field)
    hero.addEventListener('pointermove', (event) => {
      const bounds = hero.getBoundingClientRect()
      const x = (event.clientX - bounds.left) / bounds.width - 0.5
      const y = (event.clientY - bounds.top) / bounds.height - 0.5
      hero.style.setProperty('--pointer-x', `${Math.round(x * 68)}px`)
      hero.style.setProperty('--pointer-y', `${Math.round(y * 54)}px`)
      hero.style.setProperty('--art-x', `${Math.round(x * -16)}px`)
      hero.style.setProperty('--art-y', `${Math.round(y * -12)}px`)
    })
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--pointer-x', '0px')
      hero.style.setProperty('--pointer-y', '0px')
      hero.style.setProperty('--art-x', '0px')
      hero.style.setProperty('--art-y', '0px')
    })
  }

  const objectives = document.querySelector('.objective-list')
  if (objectives) {
    const objectivesObserver = new IntersectionObserver((entries, observer) => {
      if (!entries[0].isIntersecting) return
      objectives.classList.add('is-active')
      observer.unobserve(objectives)
    }, { threshold: 0.18 })
    objectivesObserver.observe(objectives)
  }
}

