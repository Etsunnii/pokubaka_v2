// РџСЂРѕРІРµСЂРєР° РЅР°Р»РёС‡РёСЏ С‚РѕРєРµРЅР°
const checkAuth = () => {
	const token = getCookie('session_id')
	if (!token) {
		window.location.href = 'admin.html'
	}
}

// Функция для обновления статистики
const updateStatistics = () => {
	const totalProducts = items.length
	const totalCategories = categories.length
	const paidOrdersCount = orders.filter(order => order.status === 'paid').length
	const totalItemsSold = paidOrdersCount || items.reduce((acc, item) => acc + item.pay_count, 0)

	document.getElementById('totalProducts').innerText = totalProducts
	document.getElementById('totalCategories').innerText = totalCategories
	document.getElementById('totalItemsSold').innerText = totalItemsSold
}

const getCookie = name => {
	const value = `; ${document.cookie}`
	const parts = value.split(`; ${name}=`)
	if (parts.length === 2) return parts.pop().split(';').shift()
}

let items = []
let categories = []
let orders = []
let faqItems = []
let faqSections = []
let productFolders = []
let productPage = 1
let filteredItems = []
const PRODUCTS_PER_PAGE = 10

const DEFAULT_DIGISELLER_GUIDE = '\u041e\u043f\u043b\u0430\u0442\u0430 \u0438 \u0432\u044b\u0434\u0430\u0447\u0430 \u0442\u043e\u0432\u0430\u0440\u0430 \u043f\u0440\u043e\u0445\u043e\u0434\u044f\u0442 \u0447\u0435\u0440\u0435\u0437 Digiseller.'
const looksBrokenText = value => /Р|С|вЂ|в‚|�/.test(String(value || ''))
const normalizeGuide = value => {
	const text = String(value || '').trim()
	if (!text) return ''
	return looksBrokenText(text) && text.includes('Digiseller') ? DEFAULT_DIGISELLER_GUIDE : text
}

const showToast = (message, type) => {
	let bgColor

	if (type === 'success') {
		bgColor = 'background-color: #28a745; color: white;'
	} else if (type === 'danger') {
		bgColor = 'background-color: #dc3545; color: white;'
	} else {
		bgColor = 'background-color: #6c757d; color: white;'
	}

	const toastHTML = `
    <div class="toast align-items-center show" role="alert" aria-live="assertive" aria-atomic="true" style="${bgColor}">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>`

	document
		.getElementById('toastContainer')
		.insertAdjacentHTML('beforeend', toastHTML)

	setTimeout(() => {
		document.querySelector('.toast').remove()
	}, 5000)
}

const showPage = () => {
	setTimeout(() => {
		const loadingOverlay = document.getElementById('loadingOverlay')
		const contentContainer = document.getElementById('contentContainer')

		loadingOverlay.classList.add('hidden')
		contentContainer.classList.add('visible')
	}, 200)
}

const token = getCookie('session_id') // Получаем токен из куки

// Функции работы с товарами
const fetchProducts = async () => {
	const token = getCookie('session_id')
	const response = await fetch('/api/itemsAdmin', {
		headers: {	
			'Content-Type': 'application/json',
			authorization: token,
		},
	})
	items = await response.json()
	console.log(items)
	updateStatistics()
	filteredItems = getFilteredProducts()
	displayProducts(filteredItems)
	await loadAdminBestSellers()
	showPage()
}

// Функция отображения товаров

const getStockCount = item => item.digisellerProductId ? 'Digiseller' : (item.accountDetails || item.accounts || []).length

const formatDate = value => {
	if (!value) return 'Дата не указана'
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? 'Дата не указана' : date.toLocaleString()
}

const escapeHtml = value =>
	String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')

const bestSellersState = {
	products: [],
	items: [],
}

const normalizeBestSellerId = value => Number(value)

const normalizeBestSellerItems = value => {
	if (Array.isArray(value)) {
		return value
			.map(item => ({
				productId: normalizeBestSellerId(item?.productId ?? item?.id),
				avatar: String(item?.avatar || ''),
			}))
			.filter(item => Number.isInteger(item.productId) && item.productId > 0)
	}

	return []
}

const parseBestSellerJson = async response => {
	const text = await response.text()
	try {
		return text ? JSON.parse(text) : {}
	} catch {
		throw new Error('Сервер вернул HTML вместо JSON. Перезапустите backend и попробуйте снова.')
	}
}

const getBestSellerProductPrice = item => {
	if (Array.isArray(item.durations) && item.durations.length) {
		const firstDuration = String(item.durations[0] || '')
		const [, durationPrice] = firstDuration.split('|')
		return durationPrice || item.price || 0
	}

	return item.price || 0
}

const getBestSellerProductMeta = item => {
	const category = item.category?.name || item.category?.type || 'Без категории'
	const price = getBestSellerProductPrice(item)
	return `${category} · ${price} ₽`
}

const getBestSellerProductById = productId =>
	bestSellersState.products.find(product => String(product.id) === String(productId))

const getBestSellerPreview = (item, product) =>
	item.avatar ||
	product?.customImage ||
	product?.img ||
	product?.image ||
	'/assets/images/no-image.svg'

const setBestSellersMessage = (message, isError = false) => {
	const messageElement = document.getElementById('bestSellersMessage')
	if (!messageElement) return

	messageElement.textContent = message
	messageElement.style.color = isError ? '#ff8b8b' : '#8be28b'
}

const renderAdminBestSellers = () => {
	const allProductsContainer = document.getElementById('adminProductsForBestSellers')
	const selectedContainer = document.getElementById('adminSelectedBestSellers')
	if (!allProductsContainer || !selectedContainer) return

	const selectedSet = new Set(bestSellersState.items.map(item => String(item.productId)))

	allProductsContainer.innerHTML = bestSellersState.products.length
		? bestSellersState.products
				.map(product => {
					const id = normalizeBestSellerId(product.id)
					const selected = selectedSet.has(String(id))
					return `
						<article class="admin-best-sellers-item">
							<div class="admin-best-sellers-item__content">
								<strong class="admin-best-sellers-item__name">${escapeHtml(product.name)}</strong>
								<span class="admin-best-sellers-item__meta">${escapeHtml(getBestSellerProductMeta(product))}</span>
							</div>
							<button
								class="btn btn-primary btn-sm"
								type="button"
								data-best-seller-add="${id}"
								${selected ? 'disabled' : ''}
							>
								Добавить
							</button>
						</article>
					`
				})
				.join('')
		: '<p class="admin-best-sellers-empty">Товары пока не загружены.</p>'

	selectedContainer.innerHTML = bestSellersState.items.length
		? bestSellersState.items
				.map((item, index) => {
					const id = normalizeBestSellerId(item.productId)
					const product = getBestSellerProductById(id)
					if (!product) return ''
					const preview = getBestSellerPreview(item, product)

					return `
						<article class="admin-best-sellers-item">
							<div class="admin-best-sellers-item__preview">
								<img class="admin-best-sellers-item__avatar" src="${escapeHtml(preview)}" alt="${escapeHtml(product.name)}" />
							</div>
							<div class="admin-best-sellers-item__content">
								<strong class="admin-best-sellers-item__name">${index + 1}. ${escapeHtml(product.name)}</strong>
								<span class="admin-best-sellers-item__meta">${escapeHtml(getBestSellerProductMeta(product))}</span>
								<label class="admin-best-sellers-item__upload">
									Аватарка для Хит продаж
									<input
										type="file"
										accept="image/png,image/jpeg,image/webp"
										data-best-seller-avatar-input="${id}"
									/>
								</label>
							</div>
							<div class="admin-best-sellers-item__actions">
								<button class="btn btn-outline-light btn-sm" type="button" data-best-seller-up="${id}" ${index === 0 ? 'disabled' : ''}>
									Вверх
								</button>
								<button class="btn btn-outline-light btn-sm" type="button" data-best-seller-down="${id}" ${index === bestSellersState.items.length - 1 ? 'disabled' : ''}>
									Вниз
								</button>
								<button class="btn btn-outline-warning btn-sm" type="button" data-best-seller-avatar-delete="${id}" ${item.avatar ? '' : 'disabled'}>
									Удалить аватарку
								</button>
								<button class="btn btn-danger btn-sm" type="button" data-best-seller-remove="${id}">
									Убрать
								</button>
							</div>
						</article>
					`
				})
				.join('')
		: '<p class="admin-best-sellers-empty">Выберите товары для блока на главной.</p>'
}

async function loadAdminBestSellers() {
	try {
		const response = await fetch('/api/admin/best-sellers', {
			headers: {
				'Content-Type': 'application/json',
				authorization: getCookie('session_id'),
			},
		})
		const result = await response.json()
		if (!response.ok) {
			throw new Error(result.message || 'Не удалось загрузить хит продаж')
		}

		bestSellersState.products = Array.isArray(result.products) ? result.products : items
		bestSellersState.items = Array.isArray(result.items)
			? normalizeBestSellerItems(result.items)
			: normalizeBestSellerItems((result.selectedProductIds || []).map(productId => ({ productId })))
		renderAdminBestSellers()
	} catch (error) {
		console.error(error)
		bestSellersState.products = items
		renderAdminBestSellers()
		setBestSellersMessage(error.message || 'Не удалось загрузить хит продаж', true)
	}
}

const saveAdminBestSellers = async () => {
	try {
		const response = await fetch('/api/admin/best-sellers', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				authorization: getCookie('session_id'),
			},
			body: JSON.stringify({
				items: bestSellersState.items,
			}),
		})
		const result = await response.json()
		if (!response.ok || !result.success) {
			throw new Error(result.message || 'Не удалось сохранить хит продаж')
		}

		bestSellersState.items = Array.isArray(result.items)
			? normalizeBestSellerItems(result.items)
			: bestSellersState.items
		renderAdminBestSellers()
		setBestSellersMessage('Хит продаж сохранен.')
		showToast('Хит продаж сохранен', 'success')
	} catch (error) {
		console.error(error)
		setBestSellersMessage(error.message || 'Не удалось сохранить хит продаж', true)
		showToast('Ошибка при сохранении хита продаж', 'danger')
	}
}

const getProductFolderName = item => item.folder?.name || 'Без папки'

const populateProductFolderControls = () => {
	const folderFilter = document.getElementById('folderFilter')
	const moveToFolderSelect = document.getElementById('moveToFolderSelect')

	if (folderFilter) {
		const selectedValue = folderFilter.value
		folderFilter.innerHTML = '<option value="">Общий список</option><option value="__none">Без папки</option>'
		productFolders.forEach(folder => {
			const option = document.createElement('option')
			option.value = folder.id
			option.textContent = `${folder.name}${folder.count ? ` (${folder.count})` : ''}`
			folderFilter.appendChild(option)
		})
		folderFilter.value = Array.from(folderFilter.options).some(option => option.value === selectedValue)
			? selectedValue
			: ''
	}

	if (moveToFolderSelect) {
		const selectedValue = moveToFolderSelect.value
		moveToFolderSelect.innerHTML = '<option value="">Переместить в папку...</option><option value="__none">Без папки</option>'
		productFolders.forEach(folder => {
			const option = document.createElement('option')
			option.value = folder.id
			option.textContent = folder.name
			moveToFolderSelect.appendChild(option)
		})
		moveToFolderSelect.value = Array.from(moveToFolderSelect.options).some(option => option.value === selectedValue)
			? selectedValue
			: ''
	}

	updateDeleteSelectedButton()
}

const fetchProductFolders = async () => {
	try {
		const response = await fetch('/api/admin/product-folders', {
			headers: {
				'Content-Type': 'application/json',
				authorization: getCookie('session_id'),
			},
		})
		const result = await response.json()
		if (!response.ok || !result.success) {
			throw new Error(result.message || 'Не удалось загрузить папки')
		}

		productFolders = Array.isArray(result.folders) ? result.folders : []
		populateProductFolderControls()
	} catch (error) {
		console.error(error)
		showToast(error.message || 'Не удалось загрузить папки товаров', 'danger')
	}
}

const getFilteredProducts = () => {
	const searchInput = document.getElementById('searchInput')
	const categoryFilter = document.getElementById('categoryFilter')
	const folderFilter = document.getElementById('folderFilter')
	const searchTerm = String(searchInput?.value || '').toLowerCase()
	const selectedCategory = categoryFilter?.value || ''
	const selectedFolder = folderFilter?.value || ''

	return items.filter(item => {
		const matchesCategory = selectedCategory === '__none'
			? !item.categoryId
			: selectedCategory
				? item.categoryId === parseInt(selectedCategory)
				: true
		const matchesFolder = selectedFolder === '__none'
			? !item.folderId
			: selectedFolder
				? item.folderId === parseInt(selectedFolder)
				: true
		const matchesSearch =
			searchTerm.length > 2
				? String(item.name || '').toLowerCase().includes(searchTerm)
				: true

		return matchesCategory && matchesFolder && matchesSearch
	})
}

const applyProductFilters = ({ keepPage = false } = {}) => {
	if (!keepPage) productPage = 1
	filteredItems = getFilteredProducts()
	displayProducts(filteredItems)
}

const renderProductPagination = (totalItems, totalPages) => {
	const pagination = document.getElementById('productPagination')
	if (!pagination) return

	if (totalItems <= PRODUCTS_PER_PAGE) {
		pagination.innerHTML = ''
		return
	}

	const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
		.map(page => `
			<button
				class="btn btn-sm ${page === productPage ? 'btn-light' : 'btn-outline-light'} product-pagination__button"
				type="button"
				data-product-page="${page}"
			>
				${page}
			</button>
		`)
		.join('')

	pagination.innerHTML = `
		<button class="btn btn-sm btn-outline-light product-pagination__button" type="button" data-product-page="prev" ${productPage === 1 ? 'disabled' : ''}>
			Назад
		</button>
		<span class="product-pagination__info">Страница ${productPage} из ${totalPages}</span>
		${pages}
		<button class="btn btn-sm btn-outline-light product-pagination__button" type="button" data-product-page="next" ${productPage === totalPages ? 'disabled' : ''}>
			Вперед
		</button>
	`
}

const displayProducts = items => {
	const productList = document.getElementById('productList')
	const totalPages = Math.max(1, Math.ceil(items.length / PRODUCTS_PER_PAGE))
	if (productPage > totalPages) productPage = totalPages
	if (productPage < 1) productPage = 1

	const pageItems = items.slice(
		(productPage - 1) * PRODUCTS_PER_PAGE,
		productPage * PRODUCTS_PER_PAGE
	)
	const headers = `
	  <div class="product-headers">
		<label class="product-select-cell">
		  <input type="checkbox" id="selectAllProducts" aria-label="Выбрать все товары">
		</label>
		<span>ID</span>
		<span>Название</span>
		<span>Цена</span>
		<span>В наличии</span>
		<span>Покупок</span>
		<span>Папка</span>
		<span>Витрина</span>
		<span>Действия</span>
	  </div>
	  <hr class="header-divider">`
	productList.innerHTML = headers

	if (!pageItems.length) {
		productList.insertAdjacentHTML('beforeend', '<p class="admin-products-empty">Товары не найдены.</p>')
		setupProductSelectionControls()
		renderProductPagination(items.length, totalPages)
		return
	}

	pageItems.forEach(item => {
		const productRow = `
		<div class="product-row" data-id="${item.id}">
		  <label class="product-select-cell">
		    <input type="checkbox" class="product-select-checkbox" value="${item.id}" aria-label="Выбрать товар ${escapeHtml(item.name)}">
		  </label>
		  <span>${item.id}</span>
		  <span>${escapeHtml(item.name)}</span>
		  <span>${item.price}</span>
		  <span>${getStockCount(item)}</span>
		  <span>${item.pay_count}</span>
		  <span>${escapeHtml(getProductFolderName(item))}</span>
		  <span>${item.isVisible ? 'Видим' : 'Скрыт'}</span>
		  <button class="btn btn-danger btn-sm" onclick="removeItem(${item.id})">
			${deleteSVG}
		  </button>
		  <button class="btn btn-light btn-sm" onclick="openEditModal(${item.id})">
			${editSVG}
		  </button>
		</div>
		<hr class="item-divider">`
		productList.insertAdjacentHTML('beforeend', productRow)
	})

	setupProductSelectionControls()
	renderProductPagination(items.length, totalPages)

	const selectedCategory = document.getElementById('categoryFilter')?.value
	if (items.length <= PRODUCTS_PER_PAGE) {
		setupDragAndDrop(
			productList,
			'.product-row',
			async orderedIds => {
				try {
					const updates = orderedIds.map((id, index) => ({ id: Number(id), sortOrder: index }))
					const body = selectedCategory
						? { categoryId: Number(selectedCategory), updates }
						: { updates }

					const response = await fetch('/api/items/reorder', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							authorization: getCookie('session_id'),
						},
						body: JSON.stringify(body),
					})

					if (!response.ok) throw new Error('Не удалось сохранить порядок товаров')
					showToast('Порядок товаров сохранен', 'success')
					fetchProducts()
				} catch (e) {
					console.error(e)
					showToast('Ошибка при сохранении порядка товаров', 'danger')
				}
			},
			() => {
				const message = selectedCategory
					? 'Перетаскивание активно: сортируются товары выбранной категории'
					: 'Перетаскивание активно: сортируется общий список товаров'
				showToast(message, 'success')
			}
		)
	}
}

const getSelectedProductIds = () =>
	Array.from(document.querySelectorAll('.product-select-checkbox:checked'))
		.map(checkbox => Number(checkbox.value))
		.filter(id => Number.isInteger(id) && id > 0)

const updateDeleteSelectedButton = () => {
	const button = document.getElementById('deleteSelectedProductsBtn')
	const moveButton = document.getElementById('moveSelectedToFolderBtn')
	const moveSelect = document.getElementById('moveToFolderSelect')

	const selectedCount = getSelectedProductIds().length
	if (button) {
		button.disabled = selectedCount === 0
		button.textContent = selectedCount
			? `Удалить выбранное (${selectedCount})`
			: 'Удалить выбранное'
	}
	if (moveButton) {
		moveButton.disabled = selectedCount === 0 || !moveSelect?.value
		moveButton.textContent = selectedCount
			? `Переместить выбранные (${selectedCount})`
			: 'Переместить выбранные'
	}
}

const setupProductSelectionControls = () => {
	const selectAll = document.getElementById('selectAllProducts')
	const checkboxes = Array.from(document.querySelectorAll('.product-select-checkbox'))

	selectAll?.addEventListener('change', () => {
		checkboxes.forEach(checkbox => {
			checkbox.checked = selectAll.checked
		})
		updateDeleteSelectedButton()
	})

	checkboxes.forEach(checkbox => {
		checkbox.addEventListener('change', () => {
			if (selectAll) {
				selectAll.checked = checkboxes.length > 0 && checkboxes.every(item => item.checked)
				selectAll.indeterminate = checkboxes.some(item => item.checked) && !selectAll.checked
			}
			updateDeleteSelectedButton()
		})
	})

	updateDeleteSelectedButton()
}

// Функция для конвертации изображения в формат .webp
const convertToWebP = base64Image => {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.src = base64Image
		img.onload = function () {
			const canvas = document.createElement('canvas')
			const ctx = canvas.getContext('2d')
			canvas.width = img.width
			canvas.height = img.height
			ctx.drawImage(img, 0, 0)

			canvas.toBlob(function (blob) {
				if (blob) {
					const reader = new FileReader()
					reader.onloadend = function () {
						resolve(reader.result) // Base64 изображение в формате .webp
					}
					reader.readAsDataURL(blob)
				} else {
					reject('Ошибка конвертации в формат webp')
				}
			}, 'image/webp')
		}
		img.onerror = reject
	})
}

// Получаем чекбокс и контейнер для поля "Сроки"
const subscriptionCheckbox = document.getElementById('subscriptionCheckbox')
const durationsContainer = document.getElementById('durationsContainer')

// Обработчик для показа/скрытия поля "Сроки"
subscriptionCheckbox.addEventListener('change', function () {
	if (this.checked) {
		durationsContainer.style.display = 'block' // Показать поле
	} else {
		durationsContainer.style.display = 'none' // Скрыть поле
	}
})

const openAddModal = () => {
	document.getElementById('productModalLabel').innerText = 'Добавить товар'
	document.getElementById('productForm').reset()
	document.getElementById('itemId').value = ''
	document.getElementById('newAccounts').value = ''
	document.getElementById('guide').value = ''
	document.getElementById('hidden_img_input').value = ''
	document.getElementById('imagePreview').innerHTML = ''
	document.getElementById('isVisible').checked = true
	document.getElementById('subscriptionCheckbox').checked = false
	document.getElementById('durationsContainer').style.display = 'none'
	document.getElementById('costsContainer').innerHTML = ''
	renderAccountRows([])
	newItem = true
	const productModal = new bootstrap.Modal(
		document.getElementById('productModal')
	)
	productModal.show()
	populateCategorySelect() // Заполняем select с категориями
}

// Установка значений вопросов и ответов при редактировании товара
const openEditModal = id => {
	const item = items.find(item => item.id === id)
	populateModal(item)
	newItem = false

	const imagePreview = document.getElementById('imagePreview')
	if (item.img) {
		imagePreview.innerHTML = `<img src="${item.img}" alt="Текущее изображение товара" class="img-thumbnail" style="max-width: 200px;">`
	} else {
		imagePreview.innerHTML = ''
	}

	const hiddenImgInput = document.getElementById('hidden_img_input')
	hiddenImgInput.value = item.img || ''

	const modal = new bootstrap.Modal(document.getElementById('productModal'))
	modal.show()
	populateCategorySelect(item.categoryId) // Заполняем select с категориями и выбираем текущую категорию товара

	// Очищаем контейнер вопросов и добавляем вопросы из товара
	const questionsContainer = document.getElementById('questionsContainer')
	questionsContainer.innerHTML = '' // Очищаем вопросы
	if (item.questions) {
		item.questions.forEach(q => {
			const [question, answer] = q.split('|')
			addQuestionRow(question, answer) // Добавляем вопрос-ответ
		})
	}
}

const populateModal = item => {
	document.getElementById('itemId').value = item.id
	document.getElementById('name').value = item.name
	document.getElementById('desc').value = item.desc
	document.getElementById('guide').value = normalizeGuide(item.guide)
	document.getElementById('price').value = item.price
	document.getElementById('digisellerProductId').value = item.digisellerProductId || ''
	document.getElementById('isVisible').checked = item.isVisible !== false
	document.getElementById('newAccounts').value = ''
	renderAccountRows(item.accountDetails || (item.accounts || []).map((content, index) => ({ index, content })))
	if (item.durations.length) {
		document.getElementById('subscriptionCheckbox').checked = true
		document.getElementById('durationsContainer').style.display = 'block'
	}
	// Очищаем старые поля durations и создаём новые
	const container = document.getElementById('costsContainer')
	container.innerHTML = '' // очищаем контейнер перед добавлением полей

	item.durations.forEach(durationStr => {
		const [duration, price, digisellerProductId] = durationStr.split('|')
		addDurationRow(duration, price, digisellerProductId)
	})
}

const removeItem = id => {
	itemIdToDelete = id
	const modal = new bootstrap.Modal(
		document.getElementById('confirmDeleteModal')
	)
	modal.show()
}

document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
	if (itemIdToDelete !== null) {
		const token = getCookie('session_id')
		fetch(`/api/items/${itemIdToDelete}`, {
			method: 'DELETE',
			headers: {
				authorization: token,
			},
		})
			.then(response => response.json())
			.then(result => {
				if (result.success) {
					showToast('Товар успешно удален', 'success')
					fetchProducts()
				} else {
					showToast('Ошибка при удалении товара', 'danger')
				}
			})
			.catch(error => {
				console.error('Ошибка при удалении:', error)
				showToast('Ошибка при удалении товара', 'danger')
			})
			.finally(() => {
				const modal = bootstrap.Modal.getInstance(
					document.getElementById('confirmDeleteModal')
				)
				modal.hide()
				itemIdToDelete = null
			})
	}
})

document.getElementById('deleteSelectedProductsBtn')?.addEventListener('click', async () => {
	const selectedIds = getSelectedProductIds()
	if (!selectedIds.length) {
		showToast('Выберите товары для удаления', 'warning')
		return
	}

	const confirmed = window.confirm(`Удалить выбранные товары? Будет удалено: ${selectedIds.length}.`)
	if (!confirmed) return

	const button = document.getElementById('deleteSelectedProductsBtn')
	const token = getCookie('session_id')
	const oldText = button.textContent
	button.disabled = true
	button.textContent = 'Удаление...'

	try {
		const results = await Promise.all(
			selectedIds.map(id =>
				fetch(`/api/items/${id}`, {
					method: 'DELETE',
					headers: { authorization: token },
				}).then(response => response.json())
			)
		)
		const deleted = results.filter(result => result.success).length
		const failed = selectedIds.length - deleted

		if (deleted) {
			showToast(
				failed ? `Удалено: ${deleted}. Не удалось удалить: ${failed}` : `Удалено товаров: ${deleted}`,
				failed ? 'warning' : 'success'
			)
			await fetchProducts()
			await fetchCategories()
		} else {
			showToast('Не удалось удалить выбранные товары', 'danger')
		}
	} catch (error) {
		console.error('Ошибка при удалении выбранных товаров:', error)
		showToast('Ошибка при удалении выбранных товаров', 'danger')
	} finally {
		button.textContent = oldText
		updateDeleteSelectedButton()
	}
})

document.getElementById('showAllProductsBtn')?.addEventListener('click', async () => {
	const button = document.getElementById('showAllProductsBtn')
	const token = getCookie('session_id')
	button.disabled = true
	button.textContent = 'Включение...'

	try {
		const response = await fetch('/api/items-bulk/show-all', {
			method: 'POST',
			headers: { authorization: token },
		})
		const result = await response.json()
		if (result.success) {
			const skippedText = result.skippedWithoutCategory
				? ` Без категории пропущено: ${result.skippedWithoutCategory}.`
				: ''
			showToast(`Товары включены в витрину: ${result.updated}.${skippedText}`, 'success')
			await fetchProducts()
			await fetchCategories()
		} else {
			showToast('Ошибка при включении товаров в витрину', 'danger')
		}
	} catch (error) {
		console.error('Ошибка при массовом показе:', error)
		showToast('Ошибка при включении товаров в витрину', 'danger')
	} finally {
		button.disabled = false
		button.textContent = 'Показать все в витрине'
	}
})

document.getElementById('createProductFolderBtn')?.addEventListener('click', async () => {
	const input = document.getElementById('newProductFolderName')
	const name = input?.value.trim()
	if (!name) {
		showToast('Введите название папки', 'warning')
		return
	}

	try {
		const response = await fetch('/api/admin/product-folders', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				authorization: getCookie('session_id'),
			},
			body: JSON.stringify({ name }),
		})
		const result = await response.json()
		if (!response.ok || !result.success) {
			throw new Error(result.message || 'Не удалось создать папку')
		}

		input.value = ''
		showToast('Папка создана', 'success')
		await fetchProductFolders()
	} catch (error) {
		console.error(error)
		showToast(error.message || 'Не удалось создать папку', 'danger')
	}
})

document.getElementById('moveToFolderSelect')?.addEventListener('change', updateDeleteSelectedButton)

document.getElementById('moveSelectedToFolderBtn')?.addEventListener('click', async () => {
	const selectedIds = getSelectedProductIds()
	const moveSelect = document.getElementById('moveToFolderSelect')
	const folderValue = moveSelect?.value || ''

	if (!selectedIds.length) {
		showToast('Выберите товары для перемещения', 'warning')
		return
	}
	if (!folderValue) {
		showToast('Выберите папку назначения', 'warning')
		return
	}

	const button = document.getElementById('moveSelectedToFolderBtn')
	const oldText = button.textContent
	button.disabled = true
	button.textContent = 'Перемещение...'

	try {
		const response = await fetch('/api/admin/product-folders/move-items', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				authorization: getCookie('session_id'),
			},
			body: JSON.stringify({
				itemIds: selectedIds,
				folderId: folderValue === '__none' ? null : Number(folderValue),
			}),
		})
		const result = await response.json()
		if (!response.ok || !result.success) {
			throw new Error(result.message || 'Не удалось переместить товары')
		}

		showToast(`Товары перемещены: ${result.updated}`, 'success')
		await fetchProductFolders()
		await fetchProducts()
	} catch (error) {
		console.error(error)
		showToast(error.message || 'Не удалось переместить товары', 'danger')
	} finally {
		button.textContent = oldText
		updateDeleteSelectedButton()
	}
})

document.getElementById('productPagination')?.addEventListener('click', event => {
	const button = event.target.closest('[data-product-page]')
	if (!button) return

	const action = button.dataset.productPage
	const totalPages = Math.max(1, Math.ceil(filteredItems.length / PRODUCTS_PER_PAGE))

	if (action === 'prev') {
		productPage = Math.max(1, productPage - 1)
	} else if (action === 'next') {
		productPage = Math.min(totalPages, productPage + 1)
	} else {
		const nextPage = Number(action)
		if (Number.isInteger(nextPage) && nextPage > 0) {
			productPage = Math.min(totalPages, nextPage)
		}
	}

	displayProducts(filteredItems)
})

// Функции работы с категориями

const fetchCategories = async () => {
	const token = getCookie('session_id')
	const response = await fetch('/api/categories', {
		headers: {
			'Content-Type': 'application/json',
			authorization: token,
		},
	})
	categories = await response.json()
	console.log(categories)
	updateStatistics()
	displayCategories(categories)
}

const displayCategories = categories => {
	const categoryList = document.getElementById('categoryList')

	const headers = `
    <div class="category-headers">
      <span>ID</span>
      <span>Название</span>
      <span>Тип</span>
      <span>Описание</span>
      <span>Действия</span>
    </div>
    <hr class="header-divider">`
	categoryList.innerHTML = headers

	if (categories) {
		console.log(categories)

		categories.forEach(category => {
			let cat_desc =
				category.desc.length > 80
					? category.desc.slice(0, 80) + '...'
					: category.desc.slice(0, 80)
			const categoryRow = `
        <div class="category-row" data-id="${category.id}">
          <span>${category.id}</span>
          <span>${category.name}</span>
          <span>${category.type}</span>
          <span>${cat_desc || ''}</span>
          <button class="btn btn-danger btn-sm" onclick="removeCategory(${category.id})">
            ${deleteSVG}
          </button>
          <button class="btn btn-light btn-sm" onclick="openCategoryEditModal(${category.id})">
            ${editSVG}
          </button>
        </div>
        <hr class="item-divider">`
			categoryList.insertAdjacentHTML('beforeend', categoryRow)
		})
	}

	// Включаем DnD для категорий
	setupDragAndDrop(
		categoryList,
		'.category-row',
		async orderedIds => {
			try {
				await fetch('/api/categories/reorder', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						authorization: getCookie('session_id'),
					},
					body: JSON.stringify(
						orderedIds.map((id, index) => ({ id: Number(id), sortOrder: index }))
					),
				})
				showToast('Порядок категорий сохранен', 'success')
				fetchCategories()
			} catch (e) {
				console.error(e)
				showToast('Ошибка при сохранении порядка категорий', 'danger')
			}
		}
	)
}

const openAddCategoryModal = () => {
	document.getElementById('categoryModalLabel').innerText = 'Добавить категорию'
	document.getElementById('categoryForm').reset()
	document.getElementById('categoryId').value = ''
	newCategory = true
	const categoryModal = new bootstrap.Modal(
		document.getElementById('categoryModal')
	)
	categoryModal.show()
}

const openCategoryEditModal = id => {
	const category = categories.find(category => category.id === id)
	populateCategoryModal(category)
	newCategory = false

	const imagePreview = document.getElementById('categoryImagePreview')
	if (category.img) {
		imagePreview.innerHTML = `<img src="${category.img}" alt="Текущее изображение категории" class="img-thumbnail" style="max-width: 200px;">`
	} else {
		imagePreview.innerHTML = ''
	}

	const hiddenImgInput = document.getElementById('hidden_category_img_input')
	hiddenImgInput.value = category.img || ''

	const modal = new bootstrap.Modal(document.getElementById('categoryModal'))
	modal.show()
}

const populateCategoryModal = category => {
	document.getElementById('categoryId').value = category.id
	document.getElementById('categoryName').value = category.name
	document.getElementById('categoryDesc').value = category.desc
	document.getElementById('categoryDescTitle').value = category.descTitle
	document.getElementById('categoryType').value = category.type
}

const removeCategory = id => {
	categoryIdToDelete = id
	const modal = new bootstrap.Modal(
		document.getElementById('confirmCategoryDeleteModal')
	)
	modal.show()
}

document
	.getElementById('confirmCategoryDeleteBtn')
	.addEventListener('click', () => {
		if (categoryIdToDelete !== null) {
			const token = getCookie('session_id')
			fetch(`/api/categories/${categoryIdToDelete}`, {
				method: 'DELETE',
				headers: {
					authorization: token,
				},
			})
				.then(response => response.json())
				.then(result => {
					if (result.success) {
						showToast('Категория успешно удалена', 'success')
						fetchCategories()
					} else {
						showToast('Ошибка при удалении категории', 'danger')
					}
				})
				.catch(error => {
					console.error('Ошибка при удалении:', error)
					showToast('Ошибка при удалении категории', 'danger')
				})
				.finally(() => {
					const modal = bootstrap.Modal.getInstance(
						document.getElementById('confirmCategoryDeleteModal')
					)
					modal.hide()
					categoryIdToDelete = null
				})
		}
	})

// Функция для заполнения селекта категорий
const populateCategorySelect = (selectedCategoryId = null) => {
	const categorySelect = document.getElementById('categorySelect')
	categorySelect.innerHTML = ''

		const emptyOption = document.createElement('option')
	emptyOption.value = ''
	emptyOption.textContent = 'Без категории'
	if (!selectedCategoryId) {
		emptyOption.selected = true
	}
	categorySelect.appendChild(emptyOption)

categories.forEach(category => {
		const option = document.createElement('option')
		option.value = category.id
		option.textContent = category.name
		if (selectedCategoryId && category.id === selectedCategoryId) {
			option.selected = true
		}
		categorySelect.appendChild(option)
	})

	if (!categories.length) {
		const option = document.createElement('option')
		option.textContent = 'Нет доступных категорий'
		categorySelect.appendChild(option)
	}
}

// Валидация перед сохранением
const validateForm = formId => {
	const form = document.getElementById(formId)
	return form.checkValidity()
}

// Инициализация
checkAuth()
fetchProductFolders()
fetchProducts()
fetchCategories()

const deleteSVG = `
  <svg fill="#fffff" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
  width="24px" height="24px" viewBox="0 0 408.483 408.483" xml:space="preserve">
  <g>
    <g>
      <path d="M87.748,388.784c0.461,11.01,9.521,19.699,20.539,19.699h191.911c11.018,0,20.078-8.689,20.539-19.699l13.705-289.316
      H74.043L87.748,388.784z M247.655,171.329c0-4.61,3.738-8.349,8.35-8.349h13.355c4.609,0,8.35,3.738,8.35,8.349v165.293
      c0,4.611-3.738,8.349-8.35,8.349h-13.355c-4.61,0-8.35-3.736-8.35-8.349V171.329z M189.216,171.329
      c0-4.61,3.738-8.349,8.349-8.349h13.355c4.609,0,8.349,3.738,8.349,8.349v165.293c0,4.611-3.737,8.349-8.349,8.349h-13.355
      c-4.61,0-8.349-3.736-8.349-8.349V171.329z M130.775,171.329c0-4.61,3.738-8.349,8.349-8.349h13.356
      c4.61,0,8.349,3.738,8.349,8.349v165.293c0,4.611-3.738,8.349-8.349,8.349h-13.356c-4.61,0-8.349-3.736-8.349-8.349V171.329z"/>
      <path d="M343.567,21.043h-88.535V4.305c0-2.377-1.927-4.305-4.305-4.305h-92.971c-2.377,0-4.304,1.928-4.304,4.305v16.737H64.916
      c-7.125,0-12.9,5.776-12.9,12.901V74.47h304.451V33.944C356.467,26.819,350.692,21.043,343.567,21.043z"/>
    </g>
  </g>
  </svg>
`

const editSVG = `
  <svg width="24px" height="24px" viewBox="0 0 24 24" id="_24x24_On_Light_Edit" data-name="24x24/On Light/Edit" xmlns="http://www.w3.org/2000/svg">
    <rect id="view-box" width="24" height="24" fill="none"/>
    <path id="Shape" d="M.75,17.5A.751.751,0,0,1,0,16.75V12.569a.755.755,0,0,1,.22-.53L11.461.8a2.72,2.72,0,0,1,3.848,0L16.7,2.191a2.72,2.72,0,0,1,0,3.848L5.462,17.28a.747.747,0,0,1-.531.22ZM1.5,12.879V16h3.12l7.91-7.91L9.41,4.97ZM13.591,7.03l2.051-2.051a1.223,1.223,0,0,0,0-1.727L14.249,1.858a1.222,1.222,0,0,0-1.727,0L10.47,3.91Z" transform="translate(3.25 3.25)" fill="#141124"/>
  </svg>
`

const populateFaqSectionSelect = selectedSectionId => {
	const select = document.getElementById('faqSectionSelect')
	if (!select) return

	select.innerHTML = faqSections.length
		? faqSections
				.map(section => {
					const selected = Number(selectedSectionId) === section.id ? 'selected' : ''
					return `<option value="${section.id}" ${selected}>${escapeHtml(section.title)}</option>`
				})
				.join('')
		: '<option value="">Сначала создайте блок FAQ</option>'
}

const resetFaqSectionForm = () => {
	document.getElementById('faqSectionForm')?.reset()
	document.getElementById('faqSectionId').value = ''
	document.getElementById('saveFaqSectionBtn').textContent = 'Добавить блок'
	document.getElementById('cancelFaqSectionEditBtn').hidden = true
}

const resetFaqForm = () => {
	document.getElementById('faqForm')?.reset()
	document.getElementById('faqId').value = ''
	document.getElementById('faqActive').checked = true
	document.getElementById('saveFaqBtn').textContent = 'Добавить FAQ'
	document.getElementById('cancelFaqEditBtn').hidden = true
	populateFaqSectionSelect(faqSections[0]?.id)
}

const fetchFaq = async () => {
	const adminFaqList = document.getElementById('adminFaqList')
	if (!adminFaqList) return

	try {
		const response = await fetch('/api/admin/faq', {
			headers: {
				'Content-Type': 'application/json',
				authorization: getCookie('session_id'),
			},
		})
		const data = await response.json()
		if (!response.ok) throw new Error(data.message || 'Ошибка загрузки FAQ')

		faqSections = Array.isArray(data.sections) ? data.sections : []
		faqItems = Array.isArray(data.faq) ? data.faq : []
		populateFaqSectionSelect(document.getElementById('faqSectionSelect')?.value)
		displayFaq()
	} catch (error) {
		console.error(error)
		adminFaqList.innerHTML = '<p class="empty-history">Не удалось загрузить FAQ.</p>'
	}
}

const renderFaqItem = item => `
	<article class="admin-faq-item admin-faq-question" data-id="${item.id}">
		<div>
			<h3>${escapeHtml(item.question)}</h3>
			<p>${escapeHtml(item.answer)}</p>
			<span class="admin-faq-status ${item.active ? '' : 'hidden'}">
				${item.active ? 'Показывается' : 'Скрыт'}
			</span>
		</div>
		<div class="admin-faq-actions">
			<button class="btn btn-outline-light btn-sm" type="button" data-faq-edit="${item.id}">
				${editSVG}
			</button>
			<button class="btn btn-outline-warning btn-sm" type="button" data-faq-toggle="${item.id}">
				${item.active ? 'Скрыть' : 'Показать'}
			</button>
			<button class="btn btn-danger btn-sm" type="button" data-faq-delete="${item.id}">
				${deleteSVG}
			</button>
		</div>
	</article>
`

const displayFaq = () => {
	const adminFaqList = document.getElementById('adminFaqList')
	if (!adminFaqList) return

	if (!faqSections.length) {
		adminFaqList.innerHTML = '<p class="empty-history">Создайте первый блок FAQ, например "Заказы".</p>'
		return
	}

	adminFaqList.innerHTML = faqSections
		.map(section => `
			<section class="admin-faq-section" data-section-id="${section.id}">
				<div class="admin-faq-section-head">
					<h3 class="admin-faq-section-title">${escapeHtml(section.title)}</h3>
					<div class="admin-faq-section-actions">
						<button class="btn btn-outline-light btn-sm" type="button" data-faq-section-edit="${section.id}">
							Редактировать блок
						</button>
						<button class="btn btn-outline-danger btn-sm" type="button" data-faq-section-delete="${section.id}">
							Удалить блок
						</button>
					</div>
				</div>
				<div class="admin-faq-section-list" data-faq-section-list="${section.id}">
					${(section.faq || []).length
						? section.faq.map(renderFaqItem).join('')
						: '<p class="empty-history">В этом блоке пока нет вопросов.</p>'}
				</div>
			</section>
		`)
		.join('')

	adminFaqList.querySelectorAll('.admin-faq-section-list').forEach(list => {
		setupDragAndDrop(
			list,
			'.admin-faq-question',
			async orderedIds => {
				try {
					const sectionId = Number(list.dataset.faqSectionList)
					await fetch('/api/admin/faq/reorder', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							authorization: getCookie('session_id'),
						},
						body: JSON.stringify({
							sectionId,
							updates: orderedIds.map((id, index) => ({ id: Number(id), sortOrder: index })),
						}),
					})
					showToast('Порядок FAQ сохранен', 'success')
					await fetchFaq()
				} catch (error) {
					console.error(error)
					showToast('Ошибка при сохранении порядка FAQ', 'danger')
				}
			},
			() => showToast('Перетаскивание активно: меняется порядок вопросов в блоке', 'success')
		)
	})
}

const saveFaqSection = async event => {
	event.preventDefault()

	const sectionMessage = document.getElementById('faqSectionMessage')
	const sectionId = document.getElementById('faqSectionId').value
	const title = document.getElementById('faqSectionTitle').value.trim()

	if (!title) {
		sectionMessage.textContent = 'Введите название блока.'
		return
	}

	try {
		const response = await fetch(sectionId ? `/api/admin/faq-sections/${sectionId}` : '/api/admin/faq-sections', {
			method: sectionId ? 'PUT' : 'POST',
			headers: {
				'Content-Type': 'application/json',
				authorization: getCookie('session_id'),
			},
			body: JSON.stringify({ title }),
		})
		const result = await response.json()
		if (!response.ok || !result.success) {
			throw new Error(result.message || 'Ошибка сохранения блока FAQ')
		}

		sectionMessage.textContent = sectionId ? 'Блок обновлен.' : 'Блок добавлен.'
		resetFaqSectionForm()
		await fetchFaq()
	} catch (error) {
		console.error(error)
		sectionMessage.textContent = error.message || 'Ошибка сохранения блока FAQ'
	}
}

const saveFaq = async event => {
	event.preventDefault()

	const faqMessage = document.getElementById('faqMessage')
	const faqId = document.getElementById('faqId').value
	const payload = {
		sectionId: Number(document.getElementById('faqSectionSelect').value),
		question: document.getElementById('faqQuestion').value.trim(),
		answer: document.getElementById('faqAnswer').value.trim(),
		active: document.getElementById('faqActive').checked,
	}

	if (!payload.sectionId) {
		faqMessage.textContent = 'Сначала выберите блок FAQ.'
		return
	}

	if (!payload.question || !payload.answer) {
		faqMessage.textContent = 'Заполните вопрос и ответ.'
		return
	}

	try {
		const response = await fetch(faqId ? `/api/admin/faq/${faqId}` : '/api/admin/faq', {
			method: faqId ? 'PUT' : 'POST',
			headers: {
				'Content-Type': 'application/json',
				authorization: getCookie('session_id'),
			},
			body: JSON.stringify(payload),
		})
		const result = await response.json()
		if (!response.ok || !result.success) {
			throw new Error(result.message || 'Ошибка сохранения FAQ')
		}

		faqMessage.textContent = faqId ? 'FAQ обновлен.' : 'FAQ добавлен.'
		resetFaqForm()
		await fetchFaq()
	} catch (error) {
		console.error(error)
		faqMessage.textContent = error.message || 'Ошибка сохранения FAQ'
	}
}

document.getElementById('faqSectionForm')?.addEventListener('submit', saveFaqSection)
document.getElementById('faqForm')?.addEventListener('submit', saveFaq)
document.getElementById('refreshFaq')?.addEventListener('click', fetchFaq)
document.getElementById('refreshBestSellers')?.addEventListener('click', loadAdminBestSellers)
document.getElementById('saveBestSellersOrder')?.addEventListener('click', saveAdminBestSellers)
document.getElementById('cancelFaqSectionEditBtn')?.addEventListener('click', () => {
	resetFaqSectionForm()
	document.getElementById('faqSectionMessage').textContent = ''
})
document.getElementById('cancelFaqEditBtn')?.addEventListener('click', () => {
	resetFaqForm()
	document.getElementById('faqMessage').textContent = ''
})

document.querySelector('.admin-best-sellers-panel')?.addEventListener('click', event => {
	const addButton = event.target.closest('[data-best-seller-add]')
	const removeButton = event.target.closest('[data-best-seller-remove]')
	const upButton = event.target.closest('[data-best-seller-up]')
	const downButton = event.target.closest('[data-best-seller-down]')
	const avatarDeleteButton = event.target.closest('[data-best-seller-avatar-delete]')

	if (addButton) {
		const id = normalizeBestSellerId(addButton.dataset.bestSellerAdd)
		if (!bestSellersState.items.some(item => String(item.productId) === String(id))) {
			bestSellersState.items.push({
				productId: id,
				avatar: '',
			})
			setBestSellersMessage('Не забудьте сохранить порядок.')
			renderAdminBestSellers()
		}
		return
	}

	if (removeButton) {
		const id = normalizeBestSellerId(removeButton.dataset.bestSellerRemove)
		bestSellersState.items = bestSellersState.items.filter(
			item => String(item.productId) !== String(id)
		)
		setBestSellersMessage('Не забудьте сохранить порядок.')
		renderAdminBestSellers()
		return
	}

	if (avatarDeleteButton) {
		const productId = avatarDeleteButton.dataset.bestSellerAvatarDelete
		;(async () => {
			try {
				setBestSellersMessage('Удаляем аватарку...')
				const response = await fetch(`/api/admin/best-sellers/${encodeURIComponent(productId)}/avatar`, {
					method: 'DELETE',
					headers: {
						authorization: getCookie('session_id'),
					},
				})
				const result = await parseBestSellerJson(response)
				if (!response.ok || !result.success) {
					throw new Error(result.message || 'Не удалось удалить аватарку')
				}

				const item = bestSellersState.items.find(item => String(item.productId) === String(productId))
				if (item) item.avatar = result.avatar || ''

				renderAdminBestSellers()
				setBestSellersMessage('Аватарка удалена.')
			} catch (error) {
				console.error(error)
				setBestSellersMessage(error.message || 'Не удалось удалить аватарку', true)
			}
		})()
		return
	}

	const moveId = normalizeBestSellerId(upButton?.dataset.bestSellerUp || downButton?.dataset.bestSellerDown)
	if (!moveId) return

	const index = bestSellersState.items.findIndex(item => String(item.productId) === String(moveId))
	if (index === -1) return

	if (upButton && index > 0) {
		const items = bestSellersState.items
		;[items[index - 1], items[index]] = [items[index], items[index - 1]]
	}

	if (downButton && index < bestSellersState.items.length - 1) {
		const items = bestSellersState.items
		;[items[index], items[index + 1]] = [items[index + 1], items[index]]
	}

	setBestSellersMessage('Не забудьте сохранить порядок.')
	renderAdminBestSellers()
})

document.querySelector('.admin-best-sellers-panel')?.addEventListener('change', event => {
	const input = event.target.closest('[data-best-seller-avatar-input]')
	if (!input) return

	const productId = input.dataset.bestSellerAvatarInput
	const file = input.files?.[0]
	if (!file) return

	;(async () => {
		const formData = new FormData()
		formData.append('avatar', file)

		try {
			setBestSellersMessage('Загружаем аватарку...')
			const response = await fetch(`/api/admin/best-sellers/${encodeURIComponent(productId)}/avatar`, {
				method: 'POST',
				headers: {
					authorization: getCookie('session_id'),
				},
				body: formData,
			})
			const result = await parseBestSellerJson(response)
			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Не удалось загрузить аватарку')
			}

			const item = bestSellersState.items.find(item => String(item.productId) === String(productId))
			if (item) item.avatar = result.avatar || ''

			input.value = ''
			renderAdminBestSellers()
			setBestSellersMessage('Аватарка обновлена.')
		} catch (error) {
			console.error(error)
			input.value = ''
			setBestSellersMessage(error.message || 'Не удалось загрузить аватарку', true)
		}
	})()
})

document.getElementById('adminFaqList')?.addEventListener('click', async event => {
	const sectionEditButton = event.target.closest('[data-faq-section-edit]')
	const sectionDeleteButton = event.target.closest('[data-faq-section-delete]')
	const editButton = event.target.closest('[data-faq-edit]')
	const toggleButton = event.target.closest('[data-faq-toggle]')
	const deleteButton = event.target.closest('[data-faq-delete]')

	if (sectionEditButton || sectionDeleteButton) {
		const id = Number(sectionEditButton?.dataset.faqSectionEdit || sectionDeleteButton?.dataset.faqSectionDelete)
		const section = faqSections.find(item => item.id === id)
		if (!section) return

		if (sectionEditButton) {
			document.getElementById('faqSectionId').value = section.id
			document.getElementById('faqSectionTitle').value = section.title
			document.getElementById('saveFaqSectionBtn').textContent = 'Сохранить блок'
			document.getElementById('cancelFaqSectionEditBtn').hidden = false
			document.getElementById('faqSectionMessage').textContent = ''
			document.getElementById('faqSectionTitle').focus()
			return
		}

		if (!window.confirm('Удалить блок FAQ вместе со всеми вопросами внутри?')) return

		try {
			const response = await fetch(`/api/admin/faq-sections/${id}`, {
				method: 'DELETE',
				headers: { authorization: getCookie('session_id') },
			})
			const result = await response.json()
			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Ошибка удаления блока FAQ')
			}
			showToast('Блок FAQ удален', 'success')
			await fetchFaq()
		} catch (error) {
			console.error(error)
			showToast(error.message || 'Ошибка удаления блока FAQ', 'danger')
		}
		return
	}

	const id = Number(
		editButton?.dataset.faqEdit ||
		toggleButton?.dataset.faqToggle ||
		deleteButton?.dataset.faqDelete
	)
	if (!id) return

	const item = faqItems.find(faq => faq.id === id)
	if (!item) return

	if (editButton) {
		document.getElementById('faqId').value = item.id
		document.getElementById('faqQuestion').value = item.question
		document.getElementById('faqAnswer').value = item.answer
		document.getElementById('faqActive').checked = item.active
		populateFaqSectionSelect(item.sectionId)
		document.getElementById('saveFaqBtn').textContent = 'Сохранить FAQ'
		document.getElementById('cancelFaqEditBtn').hidden = false
		document.getElementById('faqMessage').textContent = ''
		document.getElementById('faqQuestion').focus()
		return
	}

	if (deleteButton && !window.confirm('Удалить этот FAQ?')) return

	try {
		const response = await fetch(`/api/admin/faq/${id}`, {
			method: deleteButton ? 'DELETE' : 'PUT',
			headers: {
				'Content-Type': 'application/json',
				authorization: getCookie('session_id'),
			},
			body: deleteButton
				? undefined
				: JSON.stringify({
						sectionId: item.sectionId,
						question: item.question,
						answer: item.answer,
						active: !item.active,
					}),
		})
		const result = await response.json()
		if (!response.ok || !result.success) {
			throw new Error(result.message || 'Ошибка обновления FAQ')
		}

		showToast(deleteButton ? 'FAQ удален' : 'FAQ обновлен', 'success')
		await fetchFaq()
	} catch (error) {
		console.error(error)
		showToast(error.message || 'Ошибка FAQ', 'danger')
	}
})

// Добавление новой строки для вопроса и ответа
const splitAccountLines = value =>
	(value || '')
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean)

const renderAccountRows = accountDetails => {
	const accountsList = document.getElementById('accountsList')
	const stockInfo = document.getElementById('accountStockInfo')
	if (!accountsList) return

	accountsList.innerHTML = ''
	const rows = (accountDetails || []).filter(account => account.content)

	if (stockInfo) {
		stockInfo.textContent = `В наличии: ${rows.length}. Дату загрузки видно у каждой строки.`
	}

	if (!rows.length) {
		accountsList.innerHTML = '<div class="empty-accounts">Содержимое не загружено</div>'
		return
	}

	rows.forEach(account => {
		const row = document.createElement('div')
		row.classList.add('account-row')
		row.innerHTML = `
			<textarea class="form-control account-content" rows="2">${escapeHtml(account.content)}</textarea>
			<div class="account-meta">${formatDate(account.createdAt)}</div>
			<button type="button" class="btn btn-danger btn-sm removeAccountBtn">${deleteSVG}</button>
		`
		row.querySelector('.account-content').dataset.createdAt = account.createdAt || new Date().toISOString()
		row.querySelector('.removeAccountBtn').addEventListener('click', () => {
			row.remove()
			const count = accountsList.querySelectorAll('.account-row').length
			if (stockInfo) stockInfo.textContent = `В наличии: ${count}. Дату загрузки видно у каждой строки.`
		})
		accountsList.appendChild(row)
	})
}

const collectAccountsData = () => {
	const now = new Date().toISOString()
	const newAccounts = splitAccountLines(document.getElementById('newAccounts')?.value || '')
	const newEntries = newAccounts.map(content => JSON.stringify({ content, createdAt: now }))
	const existingEntries = Array.from(document.querySelectorAll('#accountsList .account-content'))
		.map(input => {
			const content = input.value.trim()
			if (!content) return null
			return JSON.stringify({ content, createdAt: input.dataset.createdAt || now })
		})
		.filter(Boolean)
	return [...newEntries, ...existingEntries]
}

document.getElementById('clearAccountsBtn')?.addEventListener('click', () => {
	document.getElementById('newAccounts').value = ''
	renderAccountRows([])
})
const addQuestionRow = (question = '', answer = '') => {
	const questionsContainer = document.getElementById('questionsContainer')
	const row = document.createElement('div')
	row.classList.add('row', 'mb-2', 'question-row')

	row.innerHTML = `
        <div class="col-5">
            <input type="text" class="form-control question" placeholder="Вопрос" value="${question}" required />
        </div>
        <div class="col-5">
            <input type="text" class="form-control answer" placeholder="Ответ" value="${answer}" required />
        </div>
        <div class="col-2 d-flex align-items-center">
            <button type="button" class="btn btn-danger btn-sm removeQuestionBtn">
                ${deleteSVG}
            </button>
        </div>
    `

	// Добавляем обработчик для удаления строки
	row.querySelector('.removeQuestionBtn').addEventListener('click', () => {
		row.remove()
	})

	questionsContainer.appendChild(row)
}

// Добавление нового вопроса при клике на кнопку
document.getElementById('addQuestionBtn').addEventListener('click', () => {
	addQuestionRow()
})

// Функция для поиска по названию и фильтрации по категориям
const filterProducts = () => applyProductFilters()

// Поиск по названию
document.getElementById('searchInput').addEventListener('input', filterProducts)

// Фильтр по категориям
document
	.getElementById('categoryFilter')
	.addEventListener('change', filterProducts)

document
	.getElementById('folderFilter')
	?.addEventListener('change', filterProducts)

// Функция для загрузки категорий в фильтр
const loadCategoriesForFilter = () => {
	const categoryFilter = document.getElementById('categoryFilter')
	categoryFilter.innerHTML = `<option value="">Все категории</option><option value="__none">Без категории</option>`
	categories.forEach(category => {
		const option = document.createElement('option')
		option.value = category.id
		option.textContent = category.name
		categoryFilter.appendChild(option)
	})
}

// Инициализация фильтров при загрузке данных




const syncDigisellerBtn = document.getElementById('syncDigisellerBtn')
syncDigisellerBtn?.addEventListener('click', async () => {
	const token = getCookie('session_id')
	const oldText = syncDigisellerBtn.textContent

	try {
		syncDigisellerBtn.disabled = true
		syncDigisellerBtn.textContent = 'Синхронизация...'

		const response = await fetch('/api/digiseller/sync', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				authorization: token,
			},
			body: JSON.stringify({}),
		})
		const result = await response.json()

		if (!response.ok || !result.success) {
			throw new Error(result.message || 'Ошибка синхронизации Digiseller')
		}

		showToast(
			`Digiseller: товары +${result.productsCreated ?? result.created}, обновлено ${result.productsUpdated ?? result.updated}. Новые товары без категории и скрыты до включения галочки.`,
			'success'
		)
		await fetchCategories()
		loadCategoriesForFilter()
		await fetchProducts()
	} catch (error) {
		console.error(error)
		showToast(error.message || 'Ошибка синхронизации Digiseller', 'danger')
	} finally {
		syncDigisellerBtn.disabled = false
		syncDigisellerBtn.textContent = oldText
	}
})
fetchCategories().then(() => {
	loadCategoriesForFilter()
})
fetchFaq()

document.getElementById('addCostBtn').addEventListener('click', function () {
	addDurationRow()
})

function addDurationRow(duration = '', price = '', digisellerProductId = '') {
	const container = document.getElementById('costsContainer')

	const row = document.createElement('div')
	row.classList.add('mb-3')

	const durationInput = document.createElement('input')
	durationInput.setAttribute('type', 'text')
	durationInput.setAttribute('placeholder', 'Срок (мес)')
	durationInput.value = duration || ''
	durationInput.classList.add('form-control')

	const priceInput = document.createElement('input')
	priceInput.setAttribute('type', 'text')
	priceInput.setAttribute('placeholder', 'Цена (руб)')
	priceInput.value = price || ''
	priceInput.classList.add('form-control')

	const digisellerProductIdInput = document.createElement('input')
	digisellerProductIdInput.setAttribute('type', 'text')
	digisellerProductIdInput.setAttribute('placeholder', 'ID товара Digiseller для этого срока')
	digisellerProductIdInput.value = digisellerProductId || ''
	digisellerProductIdInput.classList.add('form-control')

	const removeButton = document.createElement('button')
	removeButton.textContent = 'Удалить'
	removeButton.classList.add('btn', 'btn-danger')
	removeButton.onclick = function () {
		container.removeChild(row)
	}

	row.appendChild(durationInput)
	row.appendChild(priceInput)
	row.appendChild(digisellerProductIdInput)
	row.appendChild(removeButton)
	container.appendChild(row)
}

function collectDurationsData() {
	const checkboxChecked = document.getElementById(
		'subscriptionCheckbox'
	).checked
	if (!checkboxChecked) return []
	const rows = document.querySelectorAll('#costsContainer .mb-3')
	const durations = Array.from(rows).map(row => {
		const inputs = row.querySelectorAll('input')
		const duration = inputs[0].value.trim()
		const price = inputs[1].value.trim()
		const digisellerProductId = inputs[2]?.value.trim() || ''
		return `${duration}|${price}|${digisellerProductId}`
	}).filter(durationString => {
		const [duration, price] = durationString.split('|')
		return duration && price
	})

	return durations
}

// Сбор вопросов и ответов в массив при сохранении
document
	.getElementById('saveProductBtn')
	.addEventListener('click', async () => {
		if (validateForm('productForm')) {
			const token = getCookie('session_id')
			const itemId = document.getElementById('itemId').value
			const url = itemId ? `/api/items/${itemId}` : '/api/items' // Если есть itemId, обновляем, если нет — создаём

			const method = itemId ? 'PATCH' : 'POST'

			// Собираем вопросы и ответы в виде массива строк
			const questions = []
			document.querySelectorAll('.question-row').forEach(row => {
				const question = row.querySelector('.question').value.trim()
				const answer = row.querySelector('.answer').value.trim()
				if (question && answer) {
					questions.push(`${question}|${answer}`)
				}
			})
			let durations = collectDurationsData()

			if (document.getElementById('subscriptionCheckbox').checked) {
				console.log(durations[0].split('|')[0])
				document.getElementById('price').value = durations[0].split('|')[1]
			}

			const selectedCategoryId = document.getElementById('categorySelect').value
			const isVisible = document.getElementById('isVisible').checked
			if (isVisible && !selectedCategoryId) {
				showToast('Для показа товара в магазине выберите категорию', 'warning')
				return
			}

			const itemData = {
				name: document.getElementById('name').value,
				desc: document.getElementById('desc').value,
				guide: normalizeGuide(document.getElementById('guide').value) || null,
				price: durations.length
					? parseInt(durations[0].split('|')[1])
					: parseInt(document.getElementById('price').value),
				durations: durations,
				accounts: collectAccountsData(),
				img: document.getElementById('hidden_img_input').value, // Получаем изображение из скрытого input
				categoryId: selectedCategoryId ? parseInt(selectedCategoryId) : null,
				questions: questions, // Сохраняем вопросы и ответы
				digisellerProductId: document.getElementById('digisellerProductId').value.trim() || null,
				isVisible,
			}
			console.log(itemData)

			try {
				const response = await fetch(url, {
					method,
					headers: {
						'Content-Type': 'application/json',
						authorization: token,
					},
					body: JSON.stringify(itemData),
				})

				const result = await response.json()

				if (result.success) {
					showToast('Товар успешно сохранен', 'success')
					fetchProducts() // Обновляем список товаров
					const modal = bootstrap.Modal.getInstance(
						document.getElementById('productModal')
					)
					modal.hide()
				} else {
					showToast('Ошибка при сохранении товара', 'danger')
				}
			} catch (error) {
				console.error('Ошибка при создании/обновлении товара:', error)
				showToast('Ошибка при сохранении товара', 'danger')
			}
		}
	})

// Обработка изображений для товаров
const item_img = document.getElementById('item_img')
if (item_img) {
	item_img.addEventListener('change', async event => {
		const imgInput = event.target
		if (!imgInput.files.length) return

		const file = imgInput.files[0]
		const token = getCookie('session_id')
		const formData = new FormData()
		formData.append('image', file)

		try {
			const response = await fetch('/api/upload/product-image', {
				method: 'POST',
				headers: { authorization: token },
				body: formData,
			})
			const result = await response.json()

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Ошибка загрузки изображения')
			}

			document.getElementById('hidden_img_input').value = result.url
			document.getElementById('imagePreview').innerHTML = `<img src="${result.url}" alt="Новое изображение товара" class="img-thumbnail" style="max-width: 200px;">`
			showToast('Изображение товара загружено', 'success')
		} catch (error) {
			console.error(error)
			showToast(error.message || 'Ошибка загрузки изображения', 'danger')
			imgInput.value = ''
		}
	})
}
// Обработка изображений для категорий
const category_img = document.getElementById('category_img')
if (category_img) {
	category_img.addEventListener('change', event => {
		const imgInput = event.target
		if (imgInput.files.length > 0) {
			const file = imgInput.files[0]
			const reader = new FileReader()

			reader.onload = async function (e) {
				// Конвертируем изображение в формат webp
				const webpImage = await convertToWebP(e.target.result)

				const imagePreview = document.getElementById('categoryImagePreview')
				imagePreview.innerHTML = `<img src="${e.target.result}" alt="Новое изображение категории" class="img-thumbnail" style="max-width: 200px;">`

				// Сохраняем Base64 (webp) в скрытый input для дальнейшего сохранения
				document.getElementById('hidden_category_img_input').value = webpImage
			}

			reader.readAsDataURL(file) // Чтение файла как Data URL
		}
	})
}

// Обработка сохранения категории
document
	.getElementById('saveCategoryBtn')
	.addEventListener('click', async () => {
		if (validateForm('categoryForm')) {
			const token = getCookie('session_id')
			const categoryId = document.getElementById('categoryId').value
			const url = categoryId
				? `/api/categories/${categoryId}`
				: '/api/categories' // Если есть categoryId, обновляем, если нет — создаём

			const method = categoryId ? 'PATCH' : 'POST'

			const categoryData = {
				name: document.getElementById('categoryName').value,
				desc: document.getElementById('categoryDesc').value || '',
				descTitle: document.getElementById('categoryDescTitle').value,
				type: document.getElementById('categoryType').value,
				img: document.getElementById('hidden_category_img_input').value, // Получаем изображение из скрытого input
			}

			try {
				const response = await fetch(url, {
					method,
					headers: {
						'Content-Type': 'application/json',
						authorization: token,
					},
					body: JSON.stringify(categoryData),
				})

				const result = await response.json()

				if (result.success) {
					showToast('Категория успешно сохранена', 'success')
					fetchCategories() // Обновляем список категорий
					const modal = bootstrap.Modal.getInstance(
						document.getElementById('categoryModal')
					)
					modal.hide()
				} else {
					showToast('Ошибка при сохранении категории', 'danger')
				}
			} catch (error) {
				console.error('Ошибка при создании/обновлении категории:', error)
				showToast('Ошибка при сохранении категории', 'danger')
			}
		}
	})

// Универсальная функция DnD
function setupDragAndDrop(container, rowSelector, onReorder, onEnable) {
	const rows = Array.from(container.querySelectorAll(rowSelector))
	if (!rows.length) return

	rows.forEach(row => {
		row.setAttribute('draggable', 'true')
	})

	let dragEl = null

	container.ondragstart = e => {
		const target = e.target.closest(rowSelector)
		if (!target) return
		dragEl = target
		target.classList.add('dragging')
		if (typeof onEnable === 'function') onEnable()
	}

	container.ondragover = e => {
		e.preventDefault()
		const target = e.target.closest(rowSelector)
		if (!target || target === dragEl) return
		const rect = target.getBoundingClientRect()
		const next = (e.clientY - rect.top) / (rect.height || 1) > 0.5
		container.insertBefore(dragEl, next ? target.nextSibling : target)
	}

	container.ondragend = async () => {
		if (!dragEl) return
		dragEl.classList.remove('dragging')
		dragEl = null
		const orderedIds = Array.from(container.querySelectorAll(rowSelector)).map(
			el => el.getAttribute('data-id')
		)
		if (typeof onReorder === 'function') await onReorder(orderedIds)
	}
}










