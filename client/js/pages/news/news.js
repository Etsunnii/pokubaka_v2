const newsState = {
	news: [],
	categories: [],
	selectedCategory: 'all',
}

const escapeHtml = value =>
	String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;')

const formatNewsDate = value => {
	if (!value) return ''
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return ''

	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: 'long',
		year: 'numeric',
	}).format(date).replace(/\s*г\.?$/i, '')
}

const getLikedKey = id => `news-liked-${id}`
const isLiked = id => localStorage.getItem(getLikedKey(id)) === '1'
const getImage = item => item.image || '/assets/images/no-image.svg'
const translitMap = {
	а: 'a',
	б: 'b',
	в: 'v',
	г: 'g',
	д: 'd',
	е: 'e',
	ё: 'e',
	ж: 'zh',
	з: 'z',
	и: 'i',
	й: 'y',
	к: 'k',
	л: 'l',
	м: 'm',
	н: 'n',
	о: 'o',
	п: 'p',
	р: 'r',
	с: 's',
	т: 't',
	у: 'u',
	ф: 'f',
	х: 'h',
	ц: 'ts',
	ч: 'ch',
	ш: 'sh',
	щ: 'sch',
	ъ: '',
	ы: 'y',
	ь: '',
	э: 'e',
	ю: 'yu',
	я: 'ya',
}
const transliterate = value =>
	String(value || '')
		.toLowerCase()
		.replace(/[а-яё]/g, char => translitMap[char] ?? char)
const createNewsSlug = item =>
	transliterate(item.slug || item.title || item.id || '')
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || String(item.id || '')
const getNewsUrl = item => `/news/${encodeURIComponent(createNewsSlug(item))}`

const renderNewsCategories = () => {
	const container = document.getElementById('newsCategories')
	if (!container) return

	const buttons = [
		{ id: 'all', name: 'Все' },
		...newsState.categories,
	]

	container.innerHTML = buttons
		.map(category => `
			<button
				class="news-category-button ${String(newsState.selectedCategory) === String(category.id) ? 'is-active' : ''}"
				type="button"
				data-news-category="${escapeHtml(category.id)}"
			>
				${escapeHtml(category.name)}
			</button>
		`)
		.join('')
}

const renderNewsCard = item => {
	const liked = isLiked(item.id)
	const newsUrl = getNewsUrl(item)
	return `
		<article class="news-card">
			<a class="news-card__image-link" href="${newsUrl}">
				<img class="news-card__image" src="${escapeHtml(getImage(item))}" alt="${escapeHtml(item.title)}" loading="lazy" />
			</a>
			<div class="news-card__body">
				<div class="news-card__meta">
					<span class="news-card__category">${escapeHtml(item.categoryName || 'Новости')}</span>
					<time class="news-card__date" datetime="${escapeHtml(item.publishedAt)}">${escapeHtml(formatNewsDate(item.publishedAt))}</time>
				</div>
				<h3 class="news-card__title">${escapeHtml(item.title)}</h3>
				<p class="news-card__description">${escapeHtml(item.description)}</p>
				<div class="news-card__footer">
					<span class="news-card__views" aria-label="Просмотры">
						<img class="news-card__views-icon" src="/assets/icons/news-eye.png?v=20260708-eyes" alt="" aria-hidden="true" />
						<span>${Number(item.views) || 0}</span>
					</span>
					<button
						class="news-card__like ${liked ? 'is-liked' : ''}"
						type="button"
						data-news-like="${item.id}"
						aria-label="${liked ? 'Убрать лайк' : 'Поставить лайк'}"
					>
						<span class="news-card__like-icon" aria-hidden="true">♥</span>
						<span class="news-card__like-count">${Number(item.likes) || 0}</span>
					</button>
				</div>
				<a class="news-card__button" href="${newsUrl}">Читать полностью</a>
			</div>
		</article>
	`
}

const renderNewsCards = () => {
	const grid = document.getElementById('newsGrid')
	if (!grid) return

	const filteredNews = newsState.selectedCategory === 'all'
		? newsState.news
		: newsState.news.filter(item => String(item.categoryId) === String(newsState.selectedCategory))

	if (!filteredNews.length) {
		grid.innerHTML = `
			<div class="news-empty">
				<h2>Новостей пока нет</h2>
				<p>Попробуйте выбрать другую категорию.</p>
			</div>
		`
		return
	}

	grid.innerHTML = filteredNews.map(renderNewsCard).join('')
}

const toggleNewsLike = async id => {
	const likedKey = getLikedKey(id)
	const nextLiked = !localStorage.getItem(likedKey)

	const response = await fetch(`/api/news/${encodeURIComponent(id)}/like`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ liked: nextLiked }),
	})
	const result = await response.json()
	if (!response.ok || !result.success) {
		throw new Error(result.message || 'Не удалось обновить лайк')
	}

	if (nextLiked) {
		localStorage.setItem(likedKey, '1')
	} else {
		localStorage.removeItem(likedKey)
	}

	newsState.news = newsState.news.map(item =>
		String(item.id) === String(id) ? { ...item, likes: result.news.likes } : item
	)
	renderNewsCards()
}

const loadNewsPage = async () => {
	const grid = document.getElementById('newsGrid')

	try {
		const [newsRes, categoriesRes] = await Promise.all([
			fetch('/api/news'),
			fetch('/api/news-categories'),
		])
		const newsData = await newsRes.json()
		const categoriesData = await categoriesRes.json()

		if (!newsRes.ok) throw new Error(newsData.message || 'Не удалось загрузить новости')
		if (!categoriesRes.ok) throw new Error(categoriesData.message || 'Не удалось загрузить категории')

		newsState.news = Array.isArray(newsData.news) ? newsData.news : []
		newsState.categories = Array.isArray(categoriesData.categories) ? categoriesData.categories : []
		renderNewsCategories()
		renderNewsCards()
	} catch (error) {
		console.error(error)
		if (grid) {
			grid.innerHTML = `
				<div class="news-error">
					<h2>Не удалось загрузить новости</h2>
					<p>${escapeHtml(error.message)}</p>
				</div>
			`
		}
	}
}

document.getElementById('newsCategories')?.addEventListener('click', event => {
	const button = event.target.closest('[data-news-category]')
	if (!button) return
	newsState.selectedCategory = button.dataset.newsCategory
	renderNewsCategories()
	renderNewsCards()
})

document.getElementById('newsGrid')?.addEventListener('click', async event => {
	const button = event.target.closest('[data-news-like]')
	if (!button) return
	event.preventDefault()
	event.stopPropagation()

	try {
		await toggleNewsLike(button.dataset.newsLike)
	} catch (error) {
		console.error(error)
	}
})

loadNewsPage()
