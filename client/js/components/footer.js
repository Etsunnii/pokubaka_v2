import { get } from '../functions/logic/fetch.js'
import { createSlug } from '../functions/logic/slugify.js'

const footerCategories = document.getElementById('footerCategories')

const escapeHtml = value =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')

const isHomePage = () => {
	const path = window.location.pathname
	return path === '/' || path === '/index.html' || path.endsWith('/index.html')
}

const getCategoryName = category => String(category?.name || '').trim()

const getFooterCategories = categories =>
	(Array.isArray(categories) ? categories : [])
		.filter(category => getCategoryName(category))
		.sort((a, b) => {
			const orderA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER
			const orderB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER
			return orderA - orderB || Number(a.id || 0) - Number(b.id || 0)
		})
		.slice(0, 4)

const dispatchFooterCategory = categoryId => {
	const event = new CustomEvent('headerCatalog:select', {
		cancelable: true,
		detail: {
			categoryId: categoryId || null,
		},
	})

	return window.dispatchEvent(event)
}

const scrollToTop = () => {
	window.scrollTo({
		top: 0,
		behavior: 'smooth',
	})
}

const handleCategoryClick = categoryId => {
	const shouldNavigate = dispatchFooterCategory(categoryId)

	if (isHomePage() && !shouldNavigate) {
		scrollToTop()
		return
	}

	const url = new URL('/catalog', window.location.origin)
	if (categoryId) url.searchParams.set('categoryId', categoryId)
	window.location.href = url.toString()
}

const renderFooterCategories = categories => {
	if (!footerCategories) return

	const footerItems = getFooterCategories(categories)
	if (!footerItems.length) {
		footerCategories.innerHTML = '<span class="shop-footer__empty">Категорий пока нет</span>'
		return
	}

	footerCategories.innerHTML = footerItems
		.map(category => `
			<a
				class="shop-footer__link shop-footer__link--category"
				href="/${escapeHtml(createSlug(getCategoryName(category)))}"
				data-footer-category-id="${escapeHtml(category.id)}"
			>
				${escapeHtml(getCategoryName(category))}
			</a>
		`)
		.join('')
}

const initFooter = async () => {
	if (!footerCategories) return

	try {
		const categories = await get('/categories')
		renderFooterCategories(categories)
	} catch (error) {
		console.error('Footer categories load error:', error)
		if (footerCategories) {
			footerCategories.innerHTML = '<span class="shop-footer__empty">Не удалось загрузить категории</span>'
		}
	}
}

initFooter()
