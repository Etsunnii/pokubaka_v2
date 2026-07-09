const LOADER_ID = 'page-transition-loader'
const LOADER_STYLE_ID = 'page-transition-loader-styles'

const ensureLoaderStyles = () => {
	if (document.getElementById(LOADER_STYLE_ID)) return

	const style = document.createElement('style')
	style.id = LOADER_STYLE_ID
	style.textContent = `
		.page-transition-loader {
			position: fixed;
			inset: 0;
			z-index: 2147483000;
			display: grid;
			place-items: center;
			background: rgba(0, 0, 0, 0.84);
			opacity: 0;
			visibility: hidden;
			pointer-events: none;
			transition: opacity 160ms cubic-bezier(0.23, 1, 0.32, 1),
				visibility 160ms step-end;
			backdrop-filter: blur(3px);
		}

		.page-transition-loader.is-visible {
			opacity: 1;
			visibility: visible;
			pointer-events: auto;
			transition: opacity 160ms cubic-bezier(0.23, 1, 0.32, 1),
				visibility 0ms step-start;
		}

		.page-transition-loader__content {
			display: grid;
			justify-items: center;
			gap: 14px;
			color: #fff;
			font-size: 15px;
			font-weight: 700;
		}

		.page-transition-loader__spinner {
			width: 48px;
			height: 48px;
			border: 4px solid rgba(255, 70, 70, 0.2);
			border-top-color: #ff4242;
			border-radius: 50%;
			animation: page-transition-spin 620ms linear infinite;
			box-shadow: 0 0 24px rgba(255, 42, 42, 0.2);
		}

		@keyframes page-transition-spin {
			to {
				transform: rotate(360deg);
			}
		}

		@media (prefers-reduced-motion: reduce) {
			.page-transition-loader,
			.page-transition-loader.is-visible {
				transition-duration: 0ms;
			}

			.page-transition-loader__spinner {
				animation: none;
				border-color: rgba(255, 70, 70, 0.35);
				border-top-color: #ff4242;
			}
		}
	`
	document.head.append(style)
}

const ensureLoader = () => {
	ensureLoaderStyles()

	let loader = document.getElementById(LOADER_ID)
	if (loader) return loader

	loader = document.createElement('div')
	loader.id = LOADER_ID
	loader.className = 'page-transition-loader'
	loader.setAttribute('role', 'status')
	loader.setAttribute('aria-live', 'polite')
	loader.setAttribute('aria-label', 'Загрузка страницы')
	loader.innerHTML = `
		<div class="page-transition-loader__content">
			<span class="page-transition-loader__spinner" aria-hidden="true"></span>
			<span>Загрузка...</span>
		</div>
	`
	document.body.append(loader)
	return loader
}

export const showPageLoader = () => {
	const loader = ensureLoader()
	requestAnimationFrame(() => loader.classList.add('is-visible'))
}

export const hidePageLoader = () => {
	document.getElementById(LOADER_ID)?.classList.remove('is-visible')
}

const shouldShowForLink = (event, link) => {
	if (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey ||
		link.target === '_blank' ||
		link.hasAttribute('download')
	) {
		return false
	}

	const url = new URL(link.href, window.location.href)
	if (url.origin !== window.location.origin) return false
	if (url.pathname === '/faq' || url.pathname.endsWith('/faq.html')) return false
	if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) return false

	return true
}

export const bindPageLoaderLinks = (selector, root = document) => {
	root.addEventListener('click', event => {
		const link = event.target.closest(selector)
		if (!link || !root.contains(link) || !shouldShowForLink(event, link)) return
		showPageLoader()
	})
}

window.addEventListener('pageshow', hidePageLoader)
