import { get } from '../../functions/logic/fetch.js'
import { createSlug } from '../../functions/logic/slugify.js'

const categoryContainer = document.getElementById('categoryContainer')
const bestSellersSection = document.getElementById('bestSellers')
const NO_IMAGE_SRC = '/assets/images/no-image.svg'

const escapeHtml = value =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')

const showPage = () => {
	const loadingOverlay = document.getElementById('loadingOverlay')
	const contentContainer = document.getElementById('contentContainer')

	loadingOverlay.classList.add('hidden')
	contentContainer.classList.add('visible')
}

document.querySelectorAll('.js-go-to-popular').forEach(button => button.addEventListener('click', () => {
	const target = bestSellersSection || document.getElementById('bestSellers')

	target?.scrollIntoView({
		behavior: 'smooth',
		block: 'start',
	})

	if (target) {
		history.replaceState(null, '', '#bestSellers')
	}
}))

// Получаем все категории
const renderLoadError = (message = 'Не удалось загрузить товары') => {
	if (!categoryContainer) return

	categoryContainer.innerHTML = `
		<section class="category">
			<div class="container">
				<div class="load-error">${message}</div>
			</div>
		</section>
	`
}

const attachCategoryClicks = () => {
	const categoryProducts = document.querySelectorAll('.category__product[data-category-name]')
	for (let product of categoryProducts) {
		product.addEventListener('click', () => {
			const categoryName = product.getAttribute('data-category-name')
			window.location.href = `/${categoryName}`
		})
	}
}

const getItemPrice = item => {
	if (Array.isArray(item.durations) && item.durations.length) {
		const [, durationPrice] = String(item.durations[0] || '').split('|')
		return durationPrice || item.price || 0
	}
	return item.price || 0
}

const renderBestSellerPrice = item => `${Array.isArray(item.durations) && item.durations.length ? 'От ' : ''}${getItemPrice(item)} ₽`

const getBestSellerUrl = item => {
	const category = item.category
	const itemSlug = createSlug(item.name)
	return category?.name
		? `/${createSlug(category.name)}/${itemSlug}`
		: `/search/item/${item.id}`
}

const getBestSellerImage = product =>
	product.bestSellerAvatar ||
	product.customImage ||
	product.img ||
	product.image ||
	NO_IMAGE_SRC

const renderBestSellers = products => {
	const section = document.getElementById('bestSellers')
	const grid = document.getElementById('bestSellersGrid')
	if (!section || !grid) return

	if (!products.length) {
		section.hidden = true
		grid.innerHTML = ''
		return
	}

	section.hidden = false
	grid.innerHTML = products.map(product => `
		<a class="best-sellers__item" href="${escapeHtml(getBestSellerUrl(product))}">
			<span class="best-sellers__image-wrap">
				<img class="best-sellers__image" src="${escapeHtml(getBestSellerImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy" />
			</span>
			<span class="best-sellers__info">
				<span class="best-sellers__name">${escapeHtml(product.name)}</span>
				<span class="best-sellers__category">${escapeHtml(product.category?.type || product.category?.name || '')}</span>
			</span>
			<span class="best-sellers__price">${escapeHtml(renderBestSellerPrice(product))}</span>
		</a>
	`).join('')
}

const loadBestSellers = async () => {
	try {
		const data = await get('/best-sellers')
		renderBestSellers(Array.isArray(data.products) ? data.products : [])
	} catch (error) {
		console.error(error)
		renderBestSellers([])
	}
}

const getEmptySearchMarkup = () => `
	<div class="empty-search">
		<div class="empty-search__icon" aria-hidden="true">
			<svg viewBox="0 0 28 28" role="img" focusable="false">
				<circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" stroke-width="1.8" />
				<circle cx="11" cy="12" r="1.2" fill="currentColor" />
				<circle cx="17" cy="12" r="1.2" fill="currentColor" />
				<path d="M10.5 18.2c1.8-1.7 5.2-1.7 7 0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
			</svg>
		</div>
		<h2 class="empty-search__title">В этой категории пока нет товаров</h2>
		<p class="empty-search__text">Загляните позже — мы регулярно обновляем ассортимент</p>
	</div>
`

const setupHeaderSearch = (items, categories) => {
	const searchForm = document.querySelector('.header-search')
	const searchInput = document.querySelector('.header-search__input')
	if (!searchForm || !searchInput || !categoryContainer) return

	const originalContent = categoryContainer.innerHTML
	const categoryById = new Map(categories.map(category => [category.id, category]))
	const state = {
		selectedCategoryId: null,
		searchQuery: '',
	}

	const renderDefaultContent = () => {
		categoryContainer.innerHTML = originalContent
		attachCategoryClicks()
	}

	const renderItemResults = (title, results) => {

		categoryContainer.innerHTML = `
			<section class="category">
				<div class="category__title-block">
					<div class="container">
						<h2 class="category__title">${escapeHtml(title)}</h2>
					</div>
				</div>
				<div class="container">
					<div class="category__content"></div>
				</div>
			</section>
		`

		const contentBlock = categoryContainer.querySelector('.category__content')
		if (!results.length) {
			contentBlock.innerHTML = getEmptySearchMarkup()
			return
		}

		results.forEach(item => {
			const category = categoryById.get(item.categoryId)
			const categorySlug = category ? createSlug(category.name) : ''
			const itemSlug = createSlug(item.name)
			const newItemElem = document.createElement('div')
			newItemElem.classList.add('category__product', 'category-product')
			newItemElem.innerHTML = `
				<div class="category__product-img__container">
					<img src="${escapeHtml(item.img || NO_IMAGE_SRC)}" class="category-product__img" alt="${escapeHtml(item.name)}" />
				</div>
				<p class="category-product__category">${escapeHtml(category?.type || category?.name || '')}</p>
				<h3 class="category-product__name">${escapeHtml(item.name)}</h3>
				<div class="category-product__price-row">
					<span class="category-product__price">${escapeHtml(`${Array.isArray(item.durations) && item.durations.length ? 'От ' : ''}${getItemPrice(item)} ₽`)}</span>
					${item.oldPrice ? `<span class="category-product__old-price">${escapeHtml(`${item.oldPrice} ₽`)}</span>` : ''}
				</div>
			`
			newItemElem.addEventListener('click', () => {
				window.location.href = categorySlug
					? `/${categorySlug}/${itemSlug}`
					: `/search/item/${item.id}`
			})
			contentBlock.append(newItemElem)
		})
	}

	const getFilteredItems = () => items.filter(item => {
		const categoryMatch =
			!state.selectedCategoryId || Number(item.categoryId) === Number(state.selectedCategoryId)
		const searchMatch =
			!state.searchQuery || String(item.name || '').toLowerCase().includes(state.searchQuery)

		return categoryMatch && searchMatch
	})

	const filterProducts = () => {
		state.searchQuery = searchInput.value.trim().toLowerCase()
		if (!state.searchQuery && !state.selectedCategoryId) {
			renderDefaultContent()
			return
		}

		const selectedCategory = categoryById.get(Number(state.selectedCategoryId))
		const title = state.searchQuery
			? 'Результаты поиска'
			: selectedCategory?.name || 'Товары'
		renderItemResults(title, getFilteredItems())
	}

	const urlSearch = new URLSearchParams(window.location.search).get('search')
	if (urlSearch) searchInput.value = urlSearch
	const urlCategoryId = new URLSearchParams(window.location.search).get('categoryId')
	if (urlCategoryId) state.selectedCategoryId = Number(urlCategoryId)

	searchInput.addEventListener('input', filterProducts)
	searchForm.addEventListener('submit', event => {
		event.preventDefault()
		filterProducts()
	})

	window.addEventListener('headerCatalog:select', event => {
		event.preventDefault()
		state.selectedCategoryId = Number(event.detail?.categoryId) || null
		searchInput.value = ''
		const url = new URL(window.location.href)
		if (state.selectedCategoryId) {
			url.searchParams.set('categoryId', state.selectedCategoryId)
		} else {
			url.searchParams.delete('categoryId')
		}
		url.searchParams.delete('search')
		window.history.pushState({}, '', url)
		filterProducts()
	})

	filterProducts()
}

try {
	await loadBestSellers()
} catch (error) {
	console.error(error)
	renderBestSellers([])
} finally {
	showPage()
}
