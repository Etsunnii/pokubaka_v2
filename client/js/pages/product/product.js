import { get } from '../../functions/logic/fetch.js'
import { createSlug } from '../../functions/logic/slugify.js'

const NO_IMAGE_SRC = '/assets/images/no-image.svg'
const SITE_ORIGIN = 'https://pokubaka.ru'
const urlParams = window.location.pathname.split('/')
const categorySlug = decodeURIComponent(urlParams[1] || '')

const escapeHtml = value =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')

const stripText = value =>
	String(value || '')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()

const truncateText = (value, maxLength = 160) => {
	const text = stripText(value)
	return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}\u2026` : text
}

const setMetaByName = (name, content) => {
	let meta = document.querySelector(`meta[name="${name}"]`)
	if (!meta) {
		meta = document.createElement('meta')
		meta.setAttribute('name', name)
		document.head.append(meta)
	}
	meta.setAttribute('content', content)
}

const setMetaByProperty = (property, content) => {
	let meta = document.querySelector(`meta[property="${property}"]`)
	if (!meta) {
		meta = document.createElement('meta')
		meta.setAttribute('property', property)
		document.head.append(meta)
	}
	meta.setAttribute('content', content)
}

const setCanonical = href => {
	let link = document.querySelector('link[rel="canonical"]')
	if (!link) {
		link = document.createElement('link')
		link.setAttribute('rel', 'canonical')
		document.head.append(link)
	}
	link.setAttribute('href', href)
}

const updateCategorySeo = categoryInfo => {
	const categoryName = stripText(categoryInfo.name)
	const title = `${categoryName} - \u043a\u0443\u043f\u0438\u0442\u044c \u0432 PokuBaka`
	const description = truncateText(
		categoryInfo.desc ||
			`\u041a\u0443\u043f\u0438\u0442\u044c ${categoryName} \u0432 PokuBaka. \u0426\u0438\u0444\u0440\u043e\u0432\u044b\u0435 \u0442\u043e\u0432\u0430\u0440\u044b \u0441 \u043c\u043e\u043c\u0435\u043d\u0442\u0430\u043b\u044c\u043d\u043e\u0439 \u0432\u044b\u0434\u0430\u0447\u0435\u0439 \u043f\u043e\u0441\u043b\u0435 \u043e\u043f\u043b\u0430\u0442\u044b.`
	)
	const url = `${SITE_ORIGIN}/${createSlug(categoryName)}`

	document.title = title
	setMetaByName('description', description)
	setCanonical(url)
	setMetaByProperty('og:type', 'website')
	setMetaByProperty('og:title', title)
	setMetaByProperty('og:description', description)
	setMetaByProperty('og:url', url)
	setMetaByProperty('og:image', `${SITE_ORIGIN}/assets/icons/128x128.png`)
	setMetaByName('twitter:title', title)
	setMetaByName('twitter:description', description)
	setMetaByName('twitter:image', `${SITE_ORIGIN}/assets/icons/128x128.png`)
}

const showPage = () => {
	const loadingOverlay = document.getElementById('loadingOverlay')
	const contentContainer = document.getElementById('contentContainer')

	loadingOverlay.classList.add('hidden')
	contentContainer.classList.add('visible')
}

const getEmptyCategoryMarkup = () => `
	<div class="empty-search">
		<div class="empty-search__icon" aria-hidden="true">
			<svg viewBox="0 0 28 28" role="img" focusable="false">
				<circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" stroke-width="1.8" />
				<circle cx="11" cy="12" r="1.2" fill="currentColor" />
				<circle cx="17" cy="12" r="1.2" fill="currentColor" />
				<path d="M10.5 18.2c1.8-1.7 5.2-1.7 7 0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
			</svg>
		</div>
		<h2 class="empty-search__title">\u0412 \u044d\u0442\u043e\u0439 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0442\u043e\u0432\u0430\u0440\u043e\u0432</h2>
		<p class="empty-search__text">\u0417\u0430\u0433\u043b\u044f\u043d\u0438\u0442\u0435 \u043f\u043e\u0437\u0436\u0435 \u2014 \u043c\u044b \u0440\u0435\u0433\u0443\u043b\u044f\u0440\u043d\u043e \u043e\u0431\u043d\u043e\u0432\u043b\u044f\u0435\u043c \u0430\u0441\u0441\u043e\u0440\u0442\u0438\u043c\u0435\u043d\u0442</p>
	</div>
`

const renderLoadError = message => {
	const productTitleElem = document.getElementById('productTitle')
	const itemsContainer = document.getElementById('itemsContainer')
	if (productTitleElem) productTitleElem.textContent = '\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438'
	if (itemsContainer) {
		itemsContainer.innerHTML = `<div class="load-error">${escapeHtml(message)}</div>`
	}
}

try {
	const categoryInfo = await get(`/categories/name/${encodeURIComponent(categorySlug)}`)
	console.log(categoryInfo)

	if (!categoryInfo || !categoryInfo.name) {
		renderLoadError('\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430 \u0438\u043b\u0438 \u0431\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430.')
	} else {
		const productTitleElem = document.getElementById('productTitle')
		const itemsContainer = document.getElementById('itemsContainer')
		const descriptionTitle = document.getElementById('descriptionTitle')
		const descriptionContainer = document.getElementById('descriptionContainer')
		const currentCategorySlug = createSlug(categoryInfo.name)

		updateCategorySeo(categoryInfo)
		productTitleElem.textContent = `${categoryInfo.name}`

		if (Array.isArray(categoryInfo.items) && categoryInfo.items.length) {
			for (let item of categoryInfo.items) {
				const newItemElem = document.createElement('a')
				newItemElem.href = `/${currentCategorySlug}/${createSlug(item.name)}`
				newItemElem.setAttribute('aria-label', `Купить ${item.name}`)
				newItemElem.classList.add('category__product', 'category-product')
				newItemElem.innerHTML = `
					<div class="category__product-img__container">
						<img src="${escapeHtml(item.img || NO_IMAGE_SRC)}" class="category-product__img" alt="${escapeHtml(item.name)}" width="300" height="400" loading="lazy" decoding="async" />
					</div>
					<p class="category-product__category">${escapeHtml(categoryInfo.type || categoryInfo.name || '')}</p>
					<h3 class="category-product__name">${escapeHtml(item.name)}</h3>
					<div class="category-product__price-row">
						<span class="category-product__price">${escapeHtml(`${Array.isArray(item.durations) && item.durations.length ? '\u041e\u0442 ' : ''}${item.price} \u20bd`)}</span>
						${item.oldPrice ? `<span class="category-product__old-price">${escapeHtml(`${item.oldPrice} \u20bd`)}</span>` : ''}
					</div>
				`
				itemsContainer.append(newItemElem)
			}
		} else {
			itemsContainer.innerHTML = getEmptyCategoryMarkup()
		}

		descriptionTitle.textContent = `${categoryInfo.descTitle || ''}`
		const paragraphs = String(categoryInfo.desc || '').split('\n')
		for (let parag of paragraphs) {
			const newDescElem = document.createElement('p')
			newDescElem.classList.add('description__text')
			newDescElem.textContent = `${parag}`
			descriptionContainer.append(newDescElem)
		}
	}
} catch (error) {
	console.error(error)
	renderLoadError('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435, \u0447\u0442\u043e backend \u0437\u0430\u043f\u0443\u0449\u0435\u043d \u0438 \u0431\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430.')
} finally {
	showPage()
}
