import { get } from '../functions/logic/fetch.js'

const catalogButton = document.querySelector('.header-catalog-button')
const catalogDropdown = document.getElementById('headerCatalogDropdown')
const catalogInner = catalogDropdown?.querySelector('.header-catalog-dropdown__inner')

const escapeHtml = value =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')

const buildCatalogTree = categories => {
	const tree = new Map()

	categories.forEach(category => {
		const groupName = String(category.type || 'Без категории').trim() || 'Без категории'
		if (!tree.has(groupName)) tree.set(groupName, [])
		tree.get(groupName).push(category)
	})

	return Array.from(tree.entries()).map(([category, subcategories]) => ({
		category,
		subcategories,
	}))
}

const openHeaderCatalog = () => {
	if (!catalogButton || !catalogDropdown) return
	catalogButton.classList.add('active')
	catalogButton.setAttribute('aria-expanded', 'true')
	catalogDropdown.hidden = false
	catalogDropdown.classList.add('open')
}

const closeHeaderCatalog = () => {
	if (!catalogButton || !catalogDropdown) return
	catalogButton.classList.remove('active')
	catalogButton.setAttribute('aria-expanded', 'false')
	catalogDropdown.hidden = true
	catalogDropdown.classList.remove('open')
}

const toggleHeaderCatalog = () => {
	if (!catalogDropdown || catalogDropdown.hidden) {
		openHeaderCatalog()
	} else {
		closeHeaderCatalog()
	}
}

const renderHeaderCatalog = categories => {
	if (!catalogInner) return

	const catalogTree = buildCatalogTree(categories)
	if (!catalogTree.length) {
		catalogInner.innerHTML = '<p class="header-catalog-dropdown__empty">Каталог пока пуст.</p>'
		return
	}

	catalogInner.innerHTML = catalogTree
		.map(({ category, subcategories }) => `
			<div class="header-catalog-dropdown__column">
				<h3 class="header-catalog-dropdown__title">${escapeHtml(category)}</h3>
				${
					subcategories.length
						? subcategories.map(subcategory => `
							<button
								class="header-catalog-dropdown__link"
								type="button"
								data-category="${escapeHtml(category)}"
								data-category-id="${subcategory.id}"
								data-subcategory="${escapeHtml(subcategory.name)}"
							>
								${escapeHtml(subcategory.name)}
							</button>
						`).join('')
						: '<span class="header-catalog-dropdown__empty">Нет подкатегорий</span>'
				}
			</div>
		`)
		.join('')
}

const markActiveCategory = categoryId => {
	if (!catalogDropdown) return
	catalogDropdown
		.querySelectorAll('.header-catalog-dropdown__link')
		.forEach(item => {
			item.classList.toggle('active', String(item.dataset.categoryId) === String(categoryId))
		})
}

const initHeaderCatalog = async () => {
	if (!catalogButton || !catalogDropdown || !catalogInner) return

	try {
		const categories = await get('/categories')
		renderHeaderCatalog(Array.isArray(categories) ? categories : [])

		const selectedCategoryId = new URLSearchParams(window.location.search).get('categoryId')
		if (selectedCategoryId) markActiveCategory(selectedCategoryId)
	} catch (error) {
		console.error('Header catalog load error:', error)
		catalogInner.innerHTML = '<p class="header-catalog-dropdown__empty">Не удалось загрузить каталог.</p>'
	}

	catalogButton.addEventListener('click', event => {
		event.stopPropagation()
		toggleHeaderCatalog()
	})

	catalogDropdown.addEventListener('click', event => {
		const button = event.target.closest('[data-category-id][data-subcategory]')
		if (!button) return

		const detail = {
			category: button.dataset.category || null,
			categoryId: button.dataset.categoryId || null,
			subcategory: button.dataset.subcategory || null,
		}

		markActiveCategory(detail.categoryId)
		closeHeaderCatalog()

		const catalogEvent = new CustomEvent('headerCatalog:select', {
			cancelable: true,
			detail,
		})
		const shouldNavigate = window.dispatchEvent(catalogEvent)

		if (shouldNavigate) {
			const url = new URL('/', window.location.origin)
			url.searchParams.set('categoryId', detail.categoryId)
			window.location.href = url.toString()
		}
	})

	document.addEventListener('click', event => {
		if (!catalogButton.contains(event.target) && !catalogDropdown.contains(event.target)) {
			closeHeaderCatalog()
		}
	})

	document.addEventListener('keydown', event => {
		if (event.key === 'Escape') closeHeaderCatalog()
	})
}

initHeaderCatalog()
