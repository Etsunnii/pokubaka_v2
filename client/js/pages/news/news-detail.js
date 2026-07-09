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

const formatNewsDetailDate = value => {
	if (!value) return ''
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return ''

	const formattedDate = new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: 'long',
		year: 'numeric',
	}).format(date).replace(/\s*г\.?$/i, '').toUpperCase()

	return formattedDate
}

const getNewsId = () => decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || '')
const getLikedKey = id => `news-liked-${id}`
const getViewedKey = id => `news-viewed-${id}`
const isLiked = id => localStorage.getItem(getLikedKey(id)) === '1'
const getImage = item => item.image || '/assets/images/no-image.svg'
const preloadNewsImage = src =>
	new Promise(resolve => {
		const image = new Image()
		let settled = false
		const finish = () => {
			if (settled) return
			settled = true
			resolve()
		}

		const decodeAndFinish = async () => {
			try {
				if (typeof image.decode === 'function') await image.decode()
			} catch {
				// The loaded image can still be displayed when decode is unavailable.
			}
			finish()
		}

		image.addEventListener('load', decodeAndFinish, { once: true })
		image.addEventListener('error', finish, { once: true })
		image.src = src

		if (image.complete) decodeAndFinish()
		window.setTimeout(finish, 6000)
	})
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
const normalizeNewsSlug = value =>
	transliterate(value)
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
const createNewsSlug = item =>
	normalizeNewsSlug(item.slug || item.title || item.id || '') || String(item.id || '')
const syncNewsSlugUrl = news => {
	const slug = createNewsSlug(news)
	if (!slug) return
	const nextPath = `/news/${encodeURIComponent(slug)}`
	if (window.location.pathname !== nextPath) {
		window.history.replaceState(null, '', nextPath)
	}
}

const SITE_ORIGIN = 'https://pokubaka.ru'

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

const getAbsoluteUrl = value => {
	try {
		return new URL(value || '/assets/icons/128x128.png', SITE_ORIGIN).href
	} catch {
		return `${SITE_ORIGIN}/assets/icons/128x128.png`
	}
}

const setSeoSchema = schema => {
	let script = document.querySelector('script[type="application/ld+json"][data-seo-schema]')
	if (!script) {
		script = document.createElement('script')
		script.type = 'application/ld+json'
		script.dataset.seoSchema = 'true'
		document.head.append(script)
	}
	script.textContent = JSON.stringify(schema).replace(/</g, '\\u003c')
}

const updateNewsSeo = news => {
	const slug = createNewsSlug(news)
	const title = `${stripText(news.title)} | PokuBaka`
	const description = truncateText(news.description || news.content || news.title)
	const url = `${SITE_ORIGIN}/news/${encodeURIComponent(slug)}`
	const image = getAbsoluteUrl(getImage(news))

	document.title = title
	setMetaByName('description', description)
	setMetaByName('robots', 'index, follow')
	setCanonical(url)
	setMetaByProperty('og:type', 'article')
	setMetaByProperty('og:site_name', 'PokuBaka')
	setMetaByProperty('og:title', title)
	setMetaByProperty('og:description', description)
	setMetaByProperty('og:url', url)
	setMetaByProperty('og:image', image)
	setMetaByName('twitter:card', 'summary')
	setMetaByName('twitter:title', title)
	setMetaByName('twitter:description', description)
	setMetaByName('twitter:image', image)
	setSeoSchema([
		{
			'@context': 'https://schema.org',
			'@type': 'NewsArticle',
			headline: stripText(news.title),
			description,
			image,
			datePublished: news.publishedAt,
			dateModified: news.updatedAt || news.publishedAt,
			mainEntityOfPage: url,
			publisher: {
				'@type': 'Organization',
				name: 'PokuBaka',
				logo: {
					'@type': 'ImageObject',
					url: `${SITE_ORIGIN}/assets/icons/128x128.png`,
				},
			},
		},
		{
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Главная', item: `${SITE_ORIGIN}/` },
				{ '@type': 'ListItem', position: 2, name: 'Новости', item: `${SITE_ORIGIN}/news` },
				{ '@type': 'ListItem', position: 3, name: stripText(news.title), item: url },
			],
		},
	])
}

const loadNewsByIdentifier = async identifier => {
	const response = await fetch(`/api/news/${encodeURIComponent(identifier)}`)
	const result = await response.json().catch(() => ({}))

	if (response.ok && result.news) return result.news

	const listResponse = await fetch('/api/news')
	const listResult = await listResponse.json().catch(() => ({}))
	if (!listResponse.ok) {
		throw new Error(result.message || listResult.message || 'Новость не найдена')
	}

	const normalizedIdentifier = normalizeNewsSlug(identifier)
	const news = (Array.isArray(listResult.news) ? listResult.news : []).find(item =>
		String(item.id) === String(identifier) || createNewsSlug(item) === normalizedIdentifier
	)

	if (!news) throw new Error(result.message || 'Новость не найдена')
	return news
}

let currentNews = null

const renderDetail = news => {
	const container = document.getElementById('newsDetail')
	if (!container) return
	const liked = isLiked(news.id)

	syncNewsSlugUrl(news)
	updateNewsSeo(news)

	container.innerHTML = `
		<a class="news-detail__back" href="/news">← Назад к новостям</a>
		<div class="news-detail__image-wrap">
			<img class="news-detail__image" src="${escapeHtml(getImage(news))}" alt="${escapeHtml(news.title)}" decoding="sync" fetchpriority="high" />
		</div>
		<div class="news-detail__body">
			<header class="news-detail__header">
				<div class="news-detail__top">
					<time class="news-detail__date" datetime="${escapeHtml(news.publishedAt)}">${escapeHtml(formatNewsDetailDate(news.publishedAt))}</time>
					<div class="news-detail__actions">
						<span class="news-detail__category">${escapeHtml(news.categoryName || 'Новости')}</span>
						<span class="news-detail__views" aria-label="Просмотры">
							<img class="news-detail__views-icon" src="/assets/icons/news-eye.png?v=20260708-eyes" alt="" aria-hidden="true" />
							<span data-news-views-count>${Number(news.views) || 0}</span>
						</span>
						<button
							class="news-detail__like ${liked ? 'is-liked' : ''}"
							type="button"
							data-news-like="${news.id}"
							aria-label="${liked ? 'Убрать лайк' : 'Поставить лайк'}"
						>
							<span class="news-detail__like-icon" aria-hidden="true">♥</span>
							<span class="news-detail__like-count">${Number(news.likes) || 0}</span>
						</button>
					</div>
				</div>
				<h1 class="news-detail__title">${escapeHtml(news.title)}</h1>
				<p class="news-detail__description">${escapeHtml(news.description)}</p>
			</header>
			<div class="news-detail__content">${escapeHtml(news.content)}</div>
		</div>
	`
}

const incrementViewOnce = async id => {
	const viewedKey = getViewedKey(id)
	if (localStorage.getItem(viewedKey)) return

	const response = await fetch(`/api/news/${encodeURIComponent(id)}/view`, { method: 'POST' })
	if (!response.ok) return
	const result = await response.json()
	if (result.success && result.news) {
		currentNews = {
			...currentNews,
			views: result.news.views,
		}
		localStorage.setItem(viewedKey, '1')
		const viewsCount = document.querySelector('[data-news-views-count]')
		if (viewsCount) viewsCount.textContent = String(Number(result.news.views) || 0)
	}
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
	currentNews = {
		...currentNews,
		likes: result.news.likes,
	}

	const button = document.querySelector(`[data-news-like="${CSS.escape(String(id))}"]`)
	if (button) {
		button.classList.toggle('is-liked', nextLiked)
		button.setAttribute('aria-label', nextLiked ? 'Убрать лайк' : 'Поставить лайк')
		const likesCount = button.querySelector('.news-detail__like-count')
		if (likesCount) likesCount.textContent = String(Number(result.news.likes) || 0)
	}
}

const loadNewsDetail = async () => {
	const container = document.getElementById('newsDetail')
	const id = getNewsId()
	if (!id) {
		container.innerHTML = '<div class="news-error">Новость не найдена.</div>'
		return
	}

	try {
		currentNews = await loadNewsByIdentifier(id)
		await preloadNewsImage(getImage(currentNews))
		renderDetail(currentNews)
		await incrementViewOnce(currentNews.id)
	} catch (error) {
		console.error(error)
		container.innerHTML = `
			<div class="news-error">
				<h1>Новость не найдена</h1>
				<p>${escapeHtml(error.message)}</p>
				<a class="news-detail__back" href="/news">Назад к новостям</a>
			</div>
		`
	}
}

document.getElementById('newsDetail')?.addEventListener('click', async event => {
	const button = event.target.closest('[data-news-like]')
	if (!button) return

	try {
		await toggleNewsLike(button.dataset.newsLike)
	} catch (error) {
		console.error(error)
	}
})

loadNewsDetail()
