const getAdminCookie = name => {
	const value = `; ${document.cookie}`
	const parts = value.split(`; ${name}=`)
	if (parts.length === 2) return parts.pop().split(';').shift()
}

const adminNewsEscapeHtml = value =>
	String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;')

const adminNewsFormatDate = value => {
	if (!value) return 'Дата не указана'
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? 'Дата не указана' : date.toLocaleDateString('ru-RU')
}

const adminNewsToDateInput = value => {
	if (!value) return ''
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return ''
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
	return local.toISOString().slice(0, 10)
}

const adminNewsAuthHeaders = () => ({ authorization: getAdminCookie('session_id') })
const adminNewsJsonHeaders = () => ({
	'Content-Type': 'application/json',
	authorization: getAdminCookie('session_id'),
})

const adminNewsState = {
	news: [],
	categories: [],
}

const setAdminNewsMessage = (id, message, isError = false) => {
	const element = document.getElementById(id)
	if (!element) return
	element.textContent = message
	element.style.color = isError ? '#ff8b8b' : '#8be28b'
}

const adminNewsToast = (message, type = 'success') => {
	if (typeof showToast === 'function') {
		showToast(message, type)
		return
	}
	setAdminNewsMessage('adminNewsMessage', message, type === 'danger')
}

const populateAdminNewsCategorySelect = (selectedId = '') => {
	const select = document.getElementById('adminNewsCategorySelect')
	if (!select) return

	select.innerHTML = '<option value="">Выберите категорию</option>'
	adminNewsState.categories.forEach(category => {
		const option = document.createElement('option')
		option.value = category.id
		option.textContent = `${category.name}${category.active ? '' : ' (скрыта)'}`
		select.appendChild(option)
	})
	select.value = selectedId ? String(selectedId) : ''
}

const renderAdminNews = () => {
	const list = document.getElementById('adminNewsList')
	if (!list) return

	if (!adminNewsState.news.length) {
		list.innerHTML = '<p class="admin-products-empty">Новости пока не добавлены.</p>'
		return
	}

	list.innerHTML = adminNewsState.news
		.map(item => `
			<article class="admin-news-row">
				<div class="admin-news-row__image">
					<img src="${adminNewsEscapeHtml(item.image || '/assets/images/no-image.svg')}" alt="${adminNewsEscapeHtml(item.title)}" />
				</div>
				<div class="admin-news-row__content">
					<h3>${adminNewsEscapeHtml(item.title)}</h3>
					<p>${adminNewsEscapeHtml(item.description)}</p>
					<span class="admin-news-row__meta">
						${adminNewsEscapeHtml(item.categoryName || 'Без категории')} · ${adminNewsFormatDate(item.publishedAt)} · 👁 ${Number(item.views) || 0} · ♥ ${Number(item.likes) || 0} · ${item.active ? 'Активна' : 'Скрыта'}
					</span>
				</div>
				<div class="admin-news-row__actions">
					<a class="btn btn-outline-light btn-sm" href="/news/${item.id}" target="_blank" rel="noopener">Открыть</a>
					<button class="btn btn-light btn-sm" type="button" data-admin-news-edit="${item.id}">Редактировать</button>
					<button class="btn btn-outline-warning btn-sm" type="button" data-admin-news-toggle="${item.id}">
						${item.active ? 'Скрыть' : 'Показать'}
					</button>
					<button class="btn btn-danger btn-sm" type="button" data-admin-news-delete="${item.id}">Удалить</button>
				</div>
			</article>
		`)
		.join('')
}

const renderAdminNewsCategories = () => {
	const list = document.getElementById('adminNewsCategoryList')
	if (!list) return

	if (!adminNewsState.categories.length) {
		list.innerHTML = '<p class="admin-products-empty">Категории новостей пока не добавлены.</p>'
		return
	}

	list.innerHTML = adminNewsState.categories
		.map(category => `
			<article class="admin-news-category-row">
				<div class="admin-news-category-row__content">
					<h3>${adminNewsEscapeHtml(category.name)}</h3>
					<span class="admin-news-category-row__meta">
						${category.active ? 'Активна' : 'Скрыта'} · Новостей: ${category._count?.news ?? 0}
					</span>
				</div>
				<div class="admin-news-category-row__actions">
					<button class="btn btn-light btn-sm" type="button" data-admin-news-category-edit="${category.id}">Редактировать</button>
					<button class="btn btn-outline-warning btn-sm" type="button" data-admin-news-category-toggle="${category.id}">
						${category.active ? 'Скрыть' : 'Показать'}
					</button>
					<button class="btn btn-danger btn-sm" type="button" data-admin-news-category-delete="${category.id}">Удалить</button>
				</div>
			</article>
		`)
		.join('')
}

const loadAdminNewsCategories = async () => {
	const response = await fetch('/api/admin/news-categories', {
		headers: adminNewsAuthHeaders(),
	})
	const result = await response.json()
	if (!response.ok) throw new Error(result.message || 'Не удалось загрузить категории новостей')

	adminNewsState.categories = Array.isArray(result.categories) ? result.categories : []
	populateAdminNewsCategorySelect(document.getElementById('adminNewsCategorySelect')?.value || '')
	renderAdminNewsCategories()
}

const loadAdminNews = async () => {
	const response = await fetch('/api/admin/news', {
		headers: adminNewsAuthHeaders(),
	})
	const result = await response.json()
	if (!response.ok) throw new Error(result.message || 'Не удалось загрузить новости')

	adminNewsState.news = Array.isArray(result.news) ? result.news : []
	renderAdminNews()
}

const refreshAdminNewsAll = async () => {
	try {
		await loadAdminNewsCategories()
		await loadAdminNews()
	} catch (error) {
		console.error(error)
		adminNewsToast(error.message || 'Ошибка загрузки новостей', 'danger')
	}
}

const resetAdminNewsForm = () => {
	document.getElementById('adminNewsForm')?.reset()
	document.getElementById('adminNewsId').value = ''
	document.getElementById('adminNewsActive').checked = true
	document.getElementById('adminNewsImagePreview').innerHTML = ''
	document.getElementById('saveAdminNewsBtn').textContent = 'Сохранить новость'
	document.getElementById('cancelAdminNewsEditBtn').hidden = true
	setAdminNewsMessage('adminNewsMessage', '')
	populateAdminNewsCategorySelect()
}

const resetAdminNewsCategoryForm = () => {
	document.getElementById('adminNewsCategoryForm')?.reset()
	document.getElementById('adminNewsCategoryId').value = ''
	document.getElementById('adminNewsCategoryActive').checked = true
	document.getElementById('saveAdminNewsCategoryBtn').textContent = 'Сохранить категорию'
	document.getElementById('cancelAdminNewsCategoryEditBtn').hidden = true
	setAdminNewsMessage('adminNewsCategoryMessage', '')
}

document.getElementById('adminNewsForm')?.addEventListener('submit', async event => {
	event.preventDefault()

	const id = document.getElementById('adminNewsId').value
	const imageInput = document.getElementById('adminNewsImage')
	if (!id && !imageInput.files.length) {
		setAdminNewsMessage('adminNewsMessage', 'Загрузите фотографию новости', true)
		return
	}

	const formData = new FormData()
	formData.append('title', document.getElementById('adminNewsTitle').value.trim())
	formData.append('description', document.getElementById('adminNewsDescription').value.trim())
	formData.append('content', document.getElementById('adminNewsContent').value.trim())
	formData.append('categoryId', document.getElementById('adminNewsCategorySelect').value)
	formData.append('publishedAt', document.getElementById('adminNewsPublishedAt').value)
	formData.append('active', document.getElementById('adminNewsActive').checked ? 'true' : 'false')
	if (imageInput.files[0]) formData.append('image', imageInput.files[0])

	try {
		const response = await fetch(id ? `/api/admin/news/${id}` : '/api/admin/news', {
			method: id ? 'PUT' : 'POST',
			headers: adminNewsAuthHeaders(),
			body: formData,
		})
		const result = await response.json()
		if (!response.ok || !result.success) throw new Error(result.message || 'Не удалось сохранить новость')

		adminNewsToast(id ? 'Новость обновлена' : 'Новость добавлена')
		resetAdminNewsForm()
		await loadAdminNews()
	} catch (error) {
		console.error(error)
		setAdminNewsMessage('adminNewsMessage', error.message || 'Ошибка сохранения новости', true)
	}
})

document.getElementById('adminNewsCategoryForm')?.addEventListener('submit', async event => {
	event.preventDefault()
	const id = document.getElementById('adminNewsCategoryId').value
	const payload = {
		name: document.getElementById('adminNewsCategoryName').value.trim(),
		active: document.getElementById('adminNewsCategoryActive').checked,
	}

	try {
		const response = await fetch(id ? `/api/admin/news-categories/${id}` : '/api/admin/news-categories', {
			method: id ? 'PUT' : 'POST',
			headers: adminNewsJsonHeaders(),
			body: JSON.stringify(payload),
		})
		const result = await response.json()
		if (!response.ok || !result.success) throw new Error(result.message || 'Не удалось сохранить категорию')

		adminNewsToast(id ? 'Категория обновлена' : 'Категория добавлена')
		resetAdminNewsCategoryForm()
		await loadAdminNewsCategories()
	} catch (error) {
		console.error(error)
		setAdminNewsMessage('adminNewsCategoryMessage', error.message || 'Ошибка сохранения категории', true)
	}
})

document.getElementById('adminNewsList')?.addEventListener('click', async event => {
	const editButton = event.target.closest('[data-admin-news-edit]')
	const toggleButton = event.target.closest('[data-admin-news-toggle]')
	const deleteButton = event.target.closest('[data-admin-news-delete]')
	const id = Number(editButton?.dataset.adminNewsEdit || toggleButton?.dataset.adminNewsToggle || deleteButton?.dataset.adminNewsDelete)
	if (!id) return

	const item = adminNewsState.news.find(news => news.id === id)
	if (!item) return

	if (editButton) {
		document.getElementById('adminNewsId').value = item.id
		document.getElementById('adminNewsTitle').value = item.title
		document.getElementById('adminNewsDescription').value = item.description
		document.getElementById('adminNewsContent').value = item.content
		document.getElementById('adminNewsPublishedAt').value = adminNewsToDateInput(item.publishedAt)
		document.getElementById('adminNewsActive').checked = item.active
		populateAdminNewsCategorySelect(item.categoryId)
		document.getElementById('adminNewsImagePreview').innerHTML = item.image
			? `<img src="${adminNewsEscapeHtml(item.image)}" alt="${adminNewsEscapeHtml(item.title)}" />`
			: ''
		document.getElementById('saveAdminNewsBtn').textContent = 'Сохранить изменения'
		document.getElementById('cancelAdminNewsEditBtn').hidden = false
		document.getElementById('adminNewsTitle').focus()
		return
	}

	if (deleteButton && !window.confirm('Удалить эту новость?')) return

	try {
		const response = await fetch(`/api/admin/news/${id}`, {
			method: deleteButton ? 'DELETE' : 'PUT',
			headers: deleteButton ? adminNewsAuthHeaders() : adminNewsJsonHeaders(),
			body: deleteButton
				? undefined
				: JSON.stringify({
					title: item.title,
					description: item.description,
					content: item.content,
					categoryId: item.categoryId,
					publishedAt: item.publishedAt,
					active: !item.active,
				}),
		})
		const result = await response.json()
		if (!response.ok || !result.success) throw new Error(result.message || 'Не удалось обновить новость')

		adminNewsToast(deleteButton ? 'Новость удалена' : 'Статус новости обновлен')
		await loadAdminNews()
	} catch (error) {
		console.error(error)
		adminNewsToast(error.message || 'Ошибка новости', 'danger')
	}
})

document.getElementById('adminNewsCategoryList')?.addEventListener('click', async event => {
	const editButton = event.target.closest('[data-admin-news-category-edit]')
	const toggleButton = event.target.closest('[data-admin-news-category-toggle]')
	const deleteButton = event.target.closest('[data-admin-news-category-delete]')
	const id = Number(editButton?.dataset.adminNewsCategoryEdit || toggleButton?.dataset.adminNewsCategoryToggle || deleteButton?.dataset.adminNewsCategoryDelete)
	if (!id) return

	const category = adminNewsState.categories.find(item => item.id === id)
	if (!category) return

	if (editButton) {
		document.getElementById('adminNewsCategoryId').value = category.id
		document.getElementById('adminNewsCategoryName').value = category.name
		document.getElementById('adminNewsCategoryActive').checked = category.active
		document.getElementById('saveAdminNewsCategoryBtn').textContent = 'Сохранить изменения'
		document.getElementById('cancelAdminNewsCategoryEditBtn').hidden = false
		document.getElementById('adminNewsCategoryName').focus()
		return
	}

	if (deleteButton && !window.confirm('Удалить категорию новостей? Это возможно только если она не используется.')) return

	try {
		const response = await fetch(`/api/admin/news-categories/${id}`, {
			method: deleteButton ? 'DELETE' : 'PUT',
			headers: deleteButton ? adminNewsAuthHeaders() : adminNewsJsonHeaders(),
			body: deleteButton
				? undefined
				: JSON.stringify({
					name: category.name,
					active: !category.active,
				}),
		})
		const result = await response.json()
		if (!response.ok || !result.success) throw new Error(result.message || 'Не удалось обновить категорию')

		adminNewsToast(deleteButton ? 'Категория удалена' : 'Статус категории обновлен')
		await loadAdminNewsCategories()
		await loadAdminNews()
	} catch (error) {
		console.error(error)
		adminNewsToast(error.message || 'Ошибка категории', 'danger')
	}
})

document.getElementById('adminNewsImage')?.addEventListener('change', event => {
	const file = event.target.files?.[0]
	const preview = document.getElementById('adminNewsImagePreview')
	if (!file || !preview) return

	const url = URL.createObjectURL(file)
	preview.innerHTML = `<img src="${url}" alt="Превью новости" />`
})

document.getElementById('cancelAdminNewsEditBtn')?.addEventListener('click', resetAdminNewsForm)
document.getElementById('cancelAdminNewsCategoryEditBtn')?.addEventListener('click', resetAdminNewsCategoryForm)
document.getElementById('refreshAdminNews')?.addEventListener('click', loadAdminNews)
document.getElementById('refreshAdminNewsCategories')?.addEventListener('click', loadAdminNewsCategories)

refreshAdminNewsAll()
