import { bootPublishedLanding } from './landing-bootstrap.js'

const scheduleNonCritical = () => {
  const runNonCritical = () => {
    const html = document.documentElement
    const button = document.querySelector('#language')

    const normalizeArrowText = (scope = document) => {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
      const textNodes = []
      while (walker.nextNode()) textNodes.push(walker.currentNode)
      textNodes.forEach((node) => { node.nodeValue = node.nodeValue.replace(/↗(?!︎)/gu, '↗︎') })
    }

    normalizeArrowText()

    const menuToggle = document.querySelector('#menu-toggle')
    const mainNav = document.querySelector('#main-nav')
    if (menuToggle && mainNav && !menuToggle.dataset.menuReady) {
      const closeMenu = () => {
        mainNav.classList.remove('menu-open')
        menuToggle.classList.remove('is-open')
        menuToggle.setAttribute('aria-expanded', 'false')
        menuToggle.setAttribute('aria-label', 'Abrir menú')
      }
      menuToggle.addEventListener('click', () => {
        const open = mainNav.classList.toggle('menu-open')
        menuToggle.classList.toggle('is-open', open)
        menuToggle.setAttribute('aria-expanded', String(open))
        menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú')
      })
      mainNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu))
      menuToggle.dataset.menuReady = 'true'
    }

    const original = new Map([...document.querySelectorAll('[data-es]')].map((node) => [node, node.innerHTML]))
    let locale = 'es'

    function changeLanguage() {
      locale = locale === 'es' ? 'en' : 'es'
      html.lang = locale
      if (button) button.textContent = locale === 'es' ? 'EN' : 'ES'
      document.querySelectorAll('[data-es]').forEach((node) => {
        node.innerHTML = node.dataset[locale] || original.get(node)
      })
      normalizeArrowText()
      document.querySelectorAll('[data-alt-es]').forEach((image) => {
        image.alt = locale === 'es'
          ? image.dataset.altEs || ''
          : image.dataset.altEn || image.dataset.altEs || ''
      })
    }

    button?.addEventListener('click', changeLanguage)

    document.querySelectorAll('.filter').forEach((filter) => filter.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach((item) => item.classList.remove('active'))
      filter.classList.add('active')
      document.querySelectorAll('#job-list article').forEach((job) => {
        job.hidden = filter.dataset.filter !== 'all' && job.dataset.area !== filter.dataset.filter
      })
    }))

    const jobSearch = document.querySelector('#job-search')
    jobSearch?.addEventListener('input', (event) => {
      const query = event.target.value.toLowerCase()
      document.querySelectorAll('#job-list article').forEach((job) => {
        job.hidden = !job.textContent.toLowerCase().includes(query)
      })
    })

    document.querySelectorAll('.audience').forEach((audience) => audience.addEventListener('click', () => {
      document.querySelectorAll('.audience').forEach((item) => item.classList.remove('active'))
      audience.classList.add('active')
      const audienceInput = document.querySelector('[name=audience]')
      if (audienceInput) audienceInput.value = audience.dataset.audience
    }))

    const contactForm = document.querySelector('#contact-form')
    if (contactForm) {
      contactForm.addEventListener('submit', async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const submit = form.querySelector('button[type="submit"]')
        const note = document.querySelector('#form-note')
        const values = Object.fromEntries(new FormData(form).entries())
        const id = crypto.randomUUID()

        if (submit) submit.disabled = true
        if (note) note.textContent = locale === 'es' ? 'Enviando mensaje…' : 'Sending message…'

        try {
          const { notifySubmission, submitBusinessLead, submitContactMessage } = await import('./data-api.js')
          let notificationType

          if (values.audience === 'Empresa') {
            await submitBusinessLead({
              id,
              company_name: '',
              contact_name: values.name,
              email: values.email,
              subject: values.subject,
              message: values.message,
            })
            notificationType = 'business_lead'
          } else {
            await submitContactMessage({
              id,
              name: values.name,
              email: values.email,
              subject: values.subject,
              message: values.message,
            })
            notificationType = 'contact_message'
          }

          if (note) {
            note.textContent = locale === 'es'
              ? 'Gracias. Tu mensaje fue enviado al equipo de eWorker360.'
              : 'Thank you. Your message was sent to the eWorker360 team.'
          }
          form.reset()
          document.querySelectorAll('.audience').forEach((item) => {
            item.classList.toggle('active', item.dataset.audience === 'Empresa')
          })
          const audienceInput = form.querySelector('[name=audience]')
          if (audienceInput) audienceInput.value = 'Empresa'

          try {
            await notifySubmission(notificationType, id)
          } catch {
            // El mensaje ya quedó guardado. El correo es una notificación secundaria.
          }
        } catch {
          if (note) {
            note.textContent = locale === 'es'
              ? 'No pudimos enviar tu mensaje. Tus datos siguen en el formulario; inténtalo nuevamente.'
              : 'We could not send your message. Your information is still in the form; please try again.'
          }
        } finally {
          if (submit) submit.disabled = false
        }
      })
    }

    const employmentForm = document.querySelector('#employment-form')
    if (employmentForm) {
      const employmentSection = employmentForm.closest('.employment')
      employmentForm.style.display = 'none'
      employmentSection?.classList.add('form-launcher')
      const copy = employmentSection?.querySelector('.employment-copy')
      if (copy && !copy.querySelector('.application-launch')) {
        const launch = document.createElement('a')
        launch.className = 'button application-launch'
        launch.href = 'application.html'
        launch.target = '_blank'
        launch.rel = 'noopener'
        launch.textContent = locale === 'es' ? 'Abrir formulario de solicitud ↗︎' : 'Open application form ↗︎'
        copy.append(launch)
      }
    }

    document.querySelectorAll('.job-list .round-link').forEach((link) => {
      link.href = 'application.html'
      link.target = '_blank'
      link.rel = 'noopener'
    })

    const mainNavigation = document.querySelector('.site-header nav')
    const jobsNavigationLink = mainNavigation?.querySelector('a[href="#vacantes"]')
    if (mainNavigation && jobsNavigationLink && !mainNavigation.querySelector('.application-nav-link')) {
      const applicationNavigationLink = document.createElement('a')
      applicationNavigationLink.className = 'application-nav-link'
      applicationNavigationLink.href = 'application.html'
      applicationNavigationLink.target = '_blank'
      applicationNavigationLink.rel = 'noopener'
      applicationNavigationLink.dataset.es = 'Aplicar'
      applicationNavigationLink.dataset.en = 'Apply'
      applicationNavigationLink.textContent = 'Aplicar'
      jobsNavigationLink.insertAdjacentElement('afterend', applicationNavigationLink)
    }

    const heroActions = document.querySelector('.hero .cta-row')
    if (heroActions && !heroActions.querySelector('.hero-apply')) {
      const heroApplicationLink = document.createElement('a')
      heroApplicationLink.className = 'text-link hero-apply'
      heroApplicationLink.href = 'application.html'
      heroApplicationLink.target = '_blank'
      heroApplicationLink.rel = 'noopener'
      heroApplicationLink.dataset.es = 'Completa tu solicitud <span class="text-arrow" aria-hidden="true">↗︎</span>'
      heroApplicationLink.dataset.en = 'Complete your application <span class="text-arrow" aria-hidden="true">↗︎</span>'
      heroApplicationLink.innerHTML = heroApplicationLink.dataset.es
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
  }

  if ('requestIdleCallback' in window) window.requestIdleCallback(runNonCritical, { timeout: 1200 })
  else window.setTimeout(runNonCritical, 0)
}

async function startLanding() {
  await bootPublishedLanding()
  if (document.readyState === 'complete') scheduleNonCritical()
  else window.addEventListener('load', scheduleNonCritical, { once: true })
}

startLanding()
