import { bindPageLoaderLinks } from './pageLoader.js?v=20260709-faq-blocked'

const navLinks = Array.from(document.querySelectorAll('.header [data-nav]'))

const getLocationNav = () => {
	const path = window.location.pathname
	const hash = window.location.hash

	if (hash === '#bestSellers') return 'catalog'
	if (path === '/catalog' || path.endsWith('/catalog.html') || path === '/categories' || path.endsWith('/categories.html')) return 'catalog'
	if (path === '/faq' || path.endsWith('/faq.html')) return 'faq'
	if (path === '/news' || path.endsWith('/news.html')) return 'news'
	if (path === '/' || path.endsWith('/index.html')) return 'home'

	return 'catalog'
}

const setActiveNav = activeKey => {
	navLinks.forEach(link => {
		const isActive = link.dataset.nav === activeKey
		link.classList.toggle('active', isActive)

		if (isActive) {
			link.setAttribute('aria-current', link.tagName === 'A' ? 'page' : 'true')
		} else {
			link.removeAttribute('aria-current')
		}
	})
}

navLinks.forEach(link => {
	link.addEventListener('click', () => {
		const key = link.dataset.nav
		if (!key) return

		setActiveNav(key)
	})
})

window.addEventListener('hashchange', () => {
	setActiveNav(getLocationNav())
})

setActiveNav(getLocationNav())

bindPageLoaderLinks('.header [data-nav]:not([data-nav="news"]):not([data-nav="faq"])')
