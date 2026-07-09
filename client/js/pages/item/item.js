import { get } from '../../functions/logic/fetch.js'
import { createSlug } from '../../functions/logic/slugify.js'

const RUB = '\u20bd'
const SITE_ORIGIN = 'https://pokubaka.ru'
const TEXTS = {
	outOfStock: '\u041d\u0435\u0442 \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438',
	instantDelivery: '\u041c\u043e\u043c\u0435\u043d\u0442\u0430\u043b\u044c\u043d\u0430\u044f \u0432\u044b\u0434\u0430\u0447\u0430 \u0442\u043e\u0432\u0430\u0440\u0430 \u043f\u043e\u0441\u043b\u0435 \u043e\u043f\u043b\u0430\u0442\u044b',
	notFound: '\u0422\u043e\u0432\u0430\u0440 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d',
	loadError: '\u0422\u043e\u0432\u0430\u0440 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d \u0438\u043b\u0438 \u0431\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430.',
	copied: '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e',
	emailRequired: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 email',
	emailInvalid: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 email',
}

const urlParams = window.location.pathname.split('/')
const categorySlug = decodeURIComponent(urlParams[1] || '')
const isIdRoute = urlParams[2] === 'item' && urlParams[3]
const productId = isIdRoute ? decodeURIComponent(urlParams[3]) : null
const productSlug = !isIdRoute && urlParams[2]
	? decodeURIComponent(urlParams[2])
	: null

const itemInfo = isIdRoute
	? await get(`/items/${productId}`)
	: await get(`/categories/name/${encodeURIComponent(categorySlug)}/items/name/${encodeURIComponent(productSlug)}`)

const formatRichText = value =>
	String(value || '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim()

const stripText = value =>
	formatRichText(value)
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

const getAbsoluteUrl = value => {
	try {
		return new URL(value || '/assets/icons/128x128.png', SITE_ORIGIN).href
	} catch {
		return `${SITE_ORIGIN}/assets/icons/128x128.png`
	}
}

const updateItemSeo = item => {
	const categoryName = stripText(item.category?.name || categorySlug.replace(/-/g, ' '))
	const itemName = stripText(item.name)
	const title = `${itemName} - \u043a\u0443\u043f\u0438\u0442\u044c \u0432 PokuBaka`
	const description = truncateText(
		item.desc ||
		`\u041a\u0443\u043f\u0438\u0442\u044c ${itemName}${categoryName ? ` \u0432 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 ${categoryName}` : ''}. \u041c\u043e\u043c\u0435\u043d\u0442\u0430\u043b\u044c\u043d\u0430\u044f \u0432\u044b\u0434\u0430\u0447\u0430 \u0442\u043e\u0432\u0430\u0440\u0430 \u043f\u043e\u0441\u043b\u0435 \u043e\u043f\u043b\u0430\u0442\u044b.`
	)
	const url = `${SITE_ORIGIN}/${createSlug(categoryName)}/${createSlug(itemName)}`
	const image = getAbsoluteUrl(item.img)

	document.title = title
	setMetaByName('description', description)
	setCanonical(url)
	setMetaByProperty('og:type', 'product')
	setMetaByProperty('og:title', title)
	setMetaByProperty('og:description', description)
	setMetaByProperty('og:url', url)
	setMetaByProperty('og:image', image)
	setMetaByName('twitter:title', title)
	setMetaByName('twitter:description', description)
	setMetaByName('twitter:image', image)
}
const escapeHtml = value =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')

const isValidEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())

const setEmailError = (emailInput, message = '') => {
	const error = document.getElementById('paymentEmailError')
	if (error) {
		error.textContent = message
		error.hidden = !message
	}

	emailInput?.classList.toggle('input-error', Boolean(message))
}

const validatePaymentEmail = () => {
	const emailInput = document.getElementById('email')
	if (!emailInput) return true

	const email = emailInput.value.trim()
	if (!email) {
		setEmailError(emailInput, TEXTS.emailRequired)
		emailInput.focus()
		return false
	}

	if (!isValidEmail(email)) {
		setEmailError(emailInput, TEXTS.emailInvalid)
		emailInput.focus()
		return false
	}

	setEmailError(emailInput)
	return true
}

const getGuideSteps = value =>
	formatRichText(value)
		.split(/\r?\n/)
		.map(line => line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
		.filter(Boolean)

const renderGuide = guide => {
	const guideContainer = document.getElementById('itemGuideContainer')
	const guideSection = guideContainer?.closest('.guide')
	if (!guideContainer) return

	const steps = getGuideSteps(guide)
	if (!steps.length) {
		if (guideSection) guideSection.hidden = true
		return
	}

	if (guideSection) guideSection.hidden = false
	guideContainer.innerHTML = steps
		.map(step => `<li class="guide__elem">${escapeHtml(step)}</li>`)
		.join('')
}

const showPage = () => {
	const loadingOverlay = document.getElementById('loadingOverlay')
	const contentContainer = document.getElementById('contentContainer')

	loadingOverlay.classList.add('hidden')
	contentContainer.classList.add('visible')
}

if (itemInfo && itemInfo.name) {
	const itemTitleElem = document.getElementById('itemTitle')
	const itemBreadcrumbNameElem = document.getElementById('itemBreadcrumbName')
	const itemBreadcrumbCategoryElem = document.getElementById('itemBreadcrumbCategory')
	const itemBreadcrumbCategorySeparatorElem = document.getElementById('itemBreadcrumbCategorySeparator')
	const itemCategoryElem = document.getElementById('itemCategory')
	const itemPriceElem = document.getElementById('itemPrice')
	const itemDescElem = document.getElementById('itemDesc')
	const questionsContainer = document.getElementById('questionsContainer')
	const infoSpoiler = document.querySelector('.info__spoiler')
	const selectContainer = document.getElementById('selectContainer')
	const infoImg = document.querySelector('.info__img')
	const buyModalButton = document.querySelector('.info__btn-buymodal')
	const infoCalc = document.querySelector('.info__calc')

	let unitPrice = Number(itemInfo.price) || 0

	updateItemSeo(itemInfo)

	if (!itemInfo.count && buyModalButton) {
		buyModalButton.classList.add('stocksExpired')
		buyModalButton.disabled = true
		buyModalButton.textContent = TEXTS.outOfStock
	}

	const categoryName = itemInfo.category?.name || categorySlug.replace(/-/g, ' ')

	itemTitleElem.textContent = itemInfo.name
	if (itemBreadcrumbNameElem) itemBreadcrumbNameElem.textContent = itemInfo.name
	if (itemBreadcrumbCategoryElem) {
		if (categoryName.trim()) {
			itemBreadcrumbCategoryElem.textContent = categoryName
			itemBreadcrumbCategoryElem.href = `/${createSlug(categoryName)}`
			itemBreadcrumbCategoryElem.hidden = false
			if (itemBreadcrumbCategorySeparatorElem) itemBreadcrumbCategorySeparatorElem.hidden = false
		} else {
			itemBreadcrumbCategoryElem.hidden = true
			if (itemBreadcrumbCategorySeparatorElem) itemBreadcrumbCategorySeparatorElem.hidden = true
		}
	}
	itemCategoryElem.textContent = categoryName
	itemDescElem.textContent = formatRichText(itemInfo.desc)
	infoImg.setAttribute('src', itemInfo.img)
	infoImg.setAttribute('alt', itemInfo.name)
	renderGuide(itemInfo.guide)

	if (itemInfo.isDigisellerProduct) {
		const itemRemark = document.getElementById('itemRemark')
		if (itemRemark) itemRemark.textContent = TEXTS.instantDelivery
	}

	if (itemDescElem.scrollHeight <= itemDescElem.clientHeight + 4) {
		infoSpoiler.classList.add('hide')
		itemDescElem.classList.add('open')
	} else {
		infoSpoiler.classList.remove('hide', 'open')
		itemDescElem.classList.remove('open')
	}

	const formatPrice = value => {
		const number = Number(value) || 0
		return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.00$/, '')
	}

	const updateDisplayedPrice = () => {
		itemPriceElem.innerHTML = `${formatPrice(unitPrice)} <span class="info__price-currency">${RUB}</span>`
	}

	if (itemInfo.durations.length > 0) {
		infoCalc?.classList.add('info__calc--subscription')

		const select = document.createElement('select')
		select.classList.add('info__duration')
		select.setAttribute('id', 'durationSelect')

		itemInfo.durations.forEach(durationString => {
			const [duration, price] = durationString.split('|')
			const option = document.createElement('option')
			option.value = duration
			option.dataset.price = price
			option.textContent = duration
			select.appendChild(option)
		})

		select.addEventListener('change', () => {
			const selected = select.options[select.selectedIndex]
			unitPrice = Number(selected.dataset.price) || 0
			updateDisplayedPrice()
		})

		selectContainer.appendChild(select)

		const [, firstPrice] = itemInfo.durations[0].split('|')
		unitPrice = Number(firstPrice) || 0
	} else {
		unitPrice = Number(itemInfo.price) || 0
	}

	updateDisplayedPrice()

	if (itemInfo.questions && itemInfo.questions.length) {
		itemInfo.questions.forEach((q, index) => {
			const separatorIndex = q.indexOf('|')
			const question = separatorIndex === -1 ? q : q.slice(0, separatorIndex)
			const answer = separatorIndex === -1 ? '' : q.slice(separatorIndex + 1)
			const headingId = `questionHeading${index}`
			const collapseId = `questionCollapse${index}`
			const item = document.createElement('div')
			item.classList.add('accordion-item', 'questions__item')
			item.innerHTML = `
				<h2 class="accordion-header" id="${headingId}">
					<button
						class="accordion-button collapsed"
						type="button"
						data-bs-toggle="collapse"
						data-bs-target="#${collapseId}"
						aria-expanded="false"
						aria-controls="${collapseId}"
					>${escapeHtml(question)}</button>
				</h2>
				<div
					id="${collapseId}"
					class="accordion-collapse collapse"
					aria-labelledby="${headingId}"
					data-bs-parent="#questionsContainer"
				>
					<div class="accordion-body">${escapeHtml(answer)}</div>
				</div>
			`
			questionsContainer.appendChild(item)
		})
	}

	const savedOrderId = localStorage.getItem('orderId')
	if (savedOrderId) checkPaymentStatus(savedOrderId)

	async function handleBuyClick() {
		if (!validatePaymentEmail()) return

		const productId = itemInfo.id
		let orderType, price, duration

		if (itemInfo.durations.length === 0) {
			orderType = 'account'
			price = unitPrice
		} else {
			orderType = 'subs'
			price = unitPrice
			duration = document.getElementById('durationSelect').value
		}

		try {
			const email = document.getElementById('email').value
			const successUrl = window.location.href

			const response = await fetch('/api/create-order', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					productId,
					type: orderType,
					price: Math.round(Number(price) * 100),
					quantity: 1,
					duration: duration || null,
					email,
					successUrl,
				}),
			})

			const data = await response.json()

			if (data.success) {
				if (data.provider === 'digiseller') {
					window.localStorage.removeItem('orderId')
				} else {
					window.localStorage.setItem('orderId', data.orderId)
				}
				window.location.href = data.paymentUrl
			} else {
				document.querySelector('#errorPaymentModal .modal__title').textContent = data.message
				showErrorModal()
			}
		} catch (error) {
			console.error('Order create error:', error)
			showErrorModal()
		}
	}

	async function checkPaymentStatus(orderId) {
		try {
			const response = await fetch(`/api/order-status/${orderId}`)
			const data = await response.json()
			if (data.status === 'success') {
				document.querySelector('.paydItem').textContent = data.product
				showSuccessModal()
				localStorage.removeItem('orderId')
			} else if (data.status === 'failed') {
				localStorage.removeItem('orderId')
				showPendingModal()
			} else {
				resetToBuyButton()
			}
		} catch (error) {
			console.error('Order status error:', error)
		}
	}

	function fillPaymentForm(terminalKey, orderId, amount, successUrl) {
		document.getElementById('terminalKeyField').value = terminalKey
		document.getElementById('orderField').value = orderId
		document.getElementById('payAmount').value = amount
		document.getElementById('successURL').value = successUrl
	}

	function setupBuyButton() {
		const button = document.querySelector('.info__btn-buy')
		button.addEventListener('click', handleBuyClick)
	}

	document.getElementById('email')?.addEventListener('input', () => {
		setEmailError(document.getElementById('email'))
	})

	function resetToBuyButton() {
		setupBuyButton()
		localStorage.removeItem('orderId')
	}

	function showErrorModal() {
		new bootstrap.Modal(document.getElementById('errorPaymentModal')).show()
	}

	function showSuccessModal() {
		new bootstrap.Modal(document.getElementById('successPaymentModal')).show()
	}

	function showPendingModal() {
		new bootstrap.Modal(document.getElementById('pendingPaymentModal')).show()
	}

	setupBuyButton()
	showPage()
} else {
	console.log(TEXTS.notFound)
	const infoContent = document.querySelector('.info__content')
	if (infoContent) {
		infoContent.innerHTML = `<div class="load-error">${TEXTS.loadError}</div>`
	}
	showPage()
}

async function copyPaidItem() {
	const paidItem = document.querySelector('.paydItem')?.textContent || ''
	if (!paidItem.trim()) return
	try {
		await navigator.clipboard.writeText(paidItem)
		const button = document.getElementById('copyPaidItemBtn')
		if (button) {
			const oldText = button.textContent
			button.textContent = TEXTS.copied
			setTimeout(() => (button.textContent = oldText), 1500)
		}
	} catch (error) {
		console.error('Copy error:', error)
	}
}

document.getElementById('copyPaidItemBtn')?.addEventListener('click', copyPaidItem)

