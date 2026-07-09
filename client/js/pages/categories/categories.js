import { get } from '../../functions/logic/fetch.js'
import { createSlug } from '../../functions/logic/slugify.js'

const productsContainer = document.getElementById('categoriesProducts')
const filtersContainer = document.getElementById('categoriesFilters')
const searchInput = document.getElementById('categoriesSearch')
const NO_IMAGE_SRC = '/assets/images/no-image.svg'

const state = {
	items: [],
	categories: [],
	selectedType: 'all',
	selectedCategoryId: '',
	search: '',
}

const escapeHtml = value =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')

const showPage = () => {
	document.getElementById('loadingOverlay')?.classList.add('hidden')
	document.getElementById('contentContainer')?.classList.add('visible')
}

const getCategoryName = category => String(category?.name || '').trim()
const getCategoryType = category => String(category?.type || category?.name || '').trim()

const getItemPrice = item => {
	if (Array.isArray(item.durations) && item.durations.length) {
		const [, durationPrice] = String(item.durations[0] || '').split('|')
		return durationPrice || item.price || 0
	}

	return item.price || 0
}

const getItemImage = item => item.customImage || item.img || item.image || NO_IMAGE_SRC

const categoryById = () => new Map(state.categories.map(category => [Number(category.id), category]))

const getItemCategory = item => categoryById().get(Number(item.categoryId)) || item.category || null

const getItemUrl = item => {
	const category = getItemCategory(item)
	const itemSlug = createSlug(item.name)

	return category?.name
		? `/${createSlug(category.name)}/${itemSlug}`
		: `/search/item/${item.id}`
}

const getTypes = () => {
	const typeSet = new Set()
	state.categories.forEach(category => {
		const type = getCategoryType(category)
		if (type) typeSet.add(type)
	})

	return ['all', ...Array.from(typeSet)]
}

const updateUrl = () => {
	const url = new URL(window.location.href)

	if (state.selectedType === 'all') {
		url.searchParams.delete('category')
	} else {
		url.searchParams.set('category', state.selectedType)
	}

	if (state.selectedCategoryId) {
		const selectedCategory = state.categories.find(category => String(category.id) === String(state.selectedCategoryId))
		url.searchParams.set('categoryId', state.selectedCategoryId)
		if (selectedCategory) url.searchParams.set('subcategory', getCategoryName(selectedCategory))
	} else {
		url.searchParams.delete('categoryId')
		url.searchParams.delete('subcategory')
	}

	if (state.search) {
		url.searchParams.set('search', state.search)
	} else {
		url.searchParams.delete('search')
	}

	history.replaceState(null, '', url)
}

const renderFilters = () => {
	if (!filtersContainer) return

	filtersContainer.innerHTML = getTypes().map(type => {
		const label = type === 'all' ? 'Все' : type

		return `
			<button class="categories-filter${state.selectedType === type ? ' is-active' : ''}" type="button" data-category-type="${escapeHtml(type)}">
				${escapeHtml(label)}
			</button>
		`
	}).join('')
}

const getFilteredItems = () => {
	const categories = categoryById()

	return state.items.filter(item => {
		const category = categories.get(Number(item.categoryId)) || item.category || null
		const categoryName = getCategoryName(category)
		const categoryType = getCategoryType(category)
		const categoryIdMatch = !state.selectedCategoryId || Number(item.categoryId) === Number(state.selectedCategoryId)
		const typeMatch = state.selectedType === 'all' || categoryType === state.selectedType
		const haystack = [
			item.name,
			item.desc,
			item.description,
			categoryName,
			categoryType,
		].join(' ').toLowerCase()
		const searchMatch = !state.search || haystack.includes(state.search)

		return categoryIdMatch && typeMatch && searchMatch
	})
}

const renderEmpty = () => `
	<div class="categories-empty">
		<h2 class="categories-empty__title">Ничего не найдено</h2>
		<p class="categories-empty__text">Попробуйте изменить запрос или выбрать другую категорию.</p>
	</div>
`

const renderProducts = () => {
	if (!productsContainer) return

	const categories = categoryById()
	const items = getFilteredItems()

	if (!items.length) {
		productsContainer.innerHTML = renderEmpty()
		return
	}

	productsContainer.innerHTML = items.map(item => {
		const category = categories.get(Number(item.categoryId)) || item.category || null
		const price = `${Array.isArray(item.durations) && item.durations.length ? 'От ' : ''}${getItemPrice(item)} ₽`

		return `
			<a class="categories-card" href="${escapeHtml(getItemUrl(item))}">
				<span class="categories-card__image-wrap">
					<img class="categories-card__image" src="${escapeHtml(getItemImage(item))}" alt="${escapeHtml(item.name)}" width="300" height="400" loading="lazy" decoding="async" />
				</span>
				<span class="categories-card__body">
					<span class="categories-card__category">${escapeHtml(getCategoryType(category))}</span>
					<span class="categories-card__name">${escapeHtml(item.name)}</span>
					<span class="categories-card__price-row">
						<span class="categories-card__price">${escapeHtml(price)}</span>
						${item.oldPrice ? `<span class="categories-card__old-price">${escapeHtml(`${item.oldPrice} ₽`)}</span>` : ''}
					</span>
				</span>
			</a>
		`
	}).join('')
}

const renderAll = () => {
	renderFilters()
	renderProducts()
	updateUrl()
}

const applyInitialParams = () => {
	const params = new URLSearchParams(window.location.search)
	const category = params.get('category')
	const categoryId = params.get('categoryId')
	const subcategory = params.get('subcategory')
	const search = params.get('search') || ''
	const types = getTypes()

	if (category && types.includes(category)) {
		state.selectedType = category
	}

	if (categoryId) {
		const selectedCategory = state.categories.find(item => Number(item.id) === Number(categoryId))
		if (selectedCategory) {
			state.selectedCategoryId = String(selectedCategory.id)
			state.selectedType = getCategoryType(selectedCategory) || state.selectedType
		}
	}

	if (!state.selectedCategoryId && subcategory) {
		const selectedCategory = state.categories.find(item => getCategoryName(item).toLowerCase() === subcategory.trim().toLowerCase())
		if (selectedCategory) {
			state.selectedCategoryId = String(selectedCategory.id)
			state.selectedType = getCategoryType(selectedCategory) || state.selectedType
		}
	}

	state.search = search.trim().toLowerCase()
	if (searchInput) searchInput.value = search
}

const ensureGuideLightbox = () => {
	let lightbox = document.getElementById('catalogGuideLightbox')
	if (lightbox) return lightbox

	lightbox = document.createElement('div')
	lightbox.className = 'catalog-guide-lightbox'
	lightbox.id = 'catalogGuideLightbox'
	lightbox.hidden = true
	lightbox.innerHTML = `
		<button class="catalog-guide-lightbox__close" type="button" aria-label="Закрыть">×</button>
		<img class="catalog-guide-lightbox__image" alt="" />
	`
	document.body.append(lightbox)

	const closeLightbox = () => {
		lightbox.hidden = true
		document.body.classList.remove('catalog-guide-lightbox-open')
	}

	lightbox.addEventListener('click', event => {
		if (
			event.target === lightbox ||
			event.target.closest('.catalog-guide-lightbox__close')
		) {
			closeLightbox()
		}
	})

	document.addEventListener('keydown', event => {
		if (event.key === 'Escape' && !lightbox.hidden) closeLightbox()
	})

	return lightbox
}

const setupGuideLightbox = () => {
	document.addEventListener('click', event => {
		const button = event.target.closest('[data-guide-lightbox]')
		if (!button) return

		const lightbox = ensureGuideLightbox()
		const image = lightbox.querySelector('.catalog-guide-lightbox__image')
		image.src = button.dataset.guideLightbox
		lightbox.hidden = false
		document.body.classList.add('catalog-guide-lightbox-open')
	})
}

filtersContainer?.addEventListener('click', event => {
	const button = event.target.closest('[data-category-type]')
	if (!button) return

	state.selectedType = button.dataset.categoryType || 'all'
	state.selectedCategoryId = ''
	renderAll()
})

searchInput?.addEventListener('input', event => {
	state.search = event.target.value.trim().toLowerCase()
	renderAll()
})

setupGuideLightbox()

try {
	const [categories, items] = await Promise.all([
		get('/categories'),
		get('/items'),
	])

	state.categories = Array.isArray(categories) ? categories : []
	state.items = Array.isArray(items) ? items : []
	applyInitialParams()
	renderAll()
} catch (error) {
	console.error(error)
	if (productsContainer) {
		productsContainer.innerHTML = `
			<div class="categories-error">
				<h2 class="categories-empty__title">Каталог временно не загрузился</h2>
				<p class="categories-empty__text">Попробуйте обновить страницу чуть позже.</p>
			</div>
		`
	}
} finally {
	showPage()
}
