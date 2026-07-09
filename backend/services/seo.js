import fs from 'fs'
import path from 'path'

export const SITE_ORIGIN = String(process.env.SITE_ORIGIN || 'https://pokubaka.ru').replace(/\/+$/, '')

const DEFAULT_IMAGE = `${SITE_ORIGIN}/assets/icons/128x128.png`
const BRAND_NAME = 'PokuBaka'
const BRAND_DESCRIPTION = 'Магазин цифровых товаров, ключей, подписок и пополнения сервисов с оплатой картами РФ и СБП.'

const RU_TO_LAT = {
	а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
	и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
	с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh',
	щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export const createSlug = value => {
	const slug = String(value || '')
		.toLowerCase()
		.split('')
		.map(char => RU_TO_LAT[char] ?? char)
		.join('')
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')

	return slug || 'item'
}

const normalizeSlug = value => createSlug(decodeURIComponent(String(value || '')))

const stripText = value =>
	String(value || '')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<\/p>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()

const truncateText = (value, maxLength = 160) => {
	const text = stripText(value)
	if (!text) return ''
	return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text
}

const escapeHtml = value =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')

const escapeXml = escapeHtml

const absoluteUrl = value => {
	const rawValue = String(value || '').trim()
	if (!rawValue || rawValue.startsWith('data:') || rawValue.length > 300) return DEFAULT_IMAGE

	try {
		return new URL(rawValue, SITE_ORIGIN).href
	} catch {
		return DEFAULT_IMAGE
	}
}

const publicCategoryOrder = [
	{ sortOrder: 'asc' },
	{ id: 'asc' },
]

const publicItemOrder = [
	{ sortOrder: 'asc' },
	{ id: 'asc' },
]

export const findPublicCategory = async (prisma, rawSlug) => {
	const slug = normalizeSlug(rawSlug)
	const readableName = decodeURIComponent(String(rawSlug || '')).replace(/-/g, ' ')
	const categories = await prisma.category.findMany({
		include: {
			items: {
				where: { isVisible: true },
				orderBy: publicItemOrder,
			},
		},
		orderBy: publicCategoryOrder,
	})

	return categories.find(category =>
		createSlug(category.name) === slug ||
		category.name === readableName ||
		category.name === rawSlug
	) || null
}

export const findPublicItemBySlug = async (prisma, rawCategorySlug, rawItemSlug) => {
	const category = await findPublicCategory(prisma, rawCategorySlug)
	if (!category) return null

	const itemSlug = normalizeSlug(rawItemSlug)
	const readableName = decodeURIComponent(String(rawItemSlug || '')).replace(/-/g, ' ')
	const item = category.items.find(product =>
		createSlug(product.name) === itemSlug ||
		product.name === readableName ||
		product.name === rawItemSlug
	)

	return item ? { category, item } : null
}

export const findPublicItemById = async (prisma, rawItemId) => {
	const itemId = Number(rawItemId)
	if (!Number.isInteger(itemId) || itemId <= 0) return null

	const item = await prisma.item.findFirst({
		where: {
			id: itemId,
			isVisible: true,
		},
		include: { category: true },
	})

	if (!item?.category) return null
	return { category: item.category, item }
}

export const findPublicNews = async (prisma, rawIdentifier) => {
	const identifier = decodeURIComponent(String(rawIdentifier || '')).trim()
	const id = Number(identifier)

	if (Number.isInteger(id) && id > 0) {
		return prisma.news.findFirst({
			where: {
				id,
				active: true,
				category: { active: true },
			},
			include: { category: true },
		})
	}

	const slug = normalizeSlug(identifier)
	const news = await prisma.news.findMany({
		where: {
			active: true,
			category: { active: true },
		},
		include: { category: true },
		orderBy: [
			{ publishedAt: 'desc' },
			{ id: 'desc' },
		],
	})

	return news.find(item => createSlug(item.title) === slug || String(item.id) === identifier) || null
}

const organizationSchema = () => ({
	'@context': 'https://schema.org',
	'@type': 'Organization',
	name: BRAND_NAME,
	url: SITE_ORIGIN,
	logo: `${SITE_ORIGIN}/assets/icons/128x128.png`,
	email: 'support@pokubaka.ru',
	sameAs: [
		'https://t.me/pokubaka',
		'https://t.me/pokubakasupport',
	],
})

const websiteSchema = () => ({
	'@context': 'https://schema.org',
	'@type': 'WebSite',
	name: BRAND_NAME,
	url: SITE_ORIGIN,
	potentialAction: {
		'@type': 'SearchAction',
		target: `${SITE_ORIGIN}/catalog?search={search_term_string}`,
		'query-input': 'required name=search_term_string',
	},
})

const breadcrumbSchema = items => ({
	'@context': 'https://schema.org',
	'@type': 'BreadcrumbList',
	itemListElement: items.map((item, index) => ({
		'@type': 'ListItem',
		position: index + 1,
		name: item.name,
		item: item.url,
	})),
})

export const getHomeSeo = () => ({
	title: 'PokuBaka - магазин цифровых товаров',
	description: 'Покупайте цифровые товары, ключи, подписки и пополнение сервисов в PokuBaka. Быстрая выдача, поддержка и удобная оплата из России.',
	canonical: `${SITE_ORIGIN}/`,
	robots: 'index, follow',
	ogType: 'website',
	image: DEFAULT_IMAGE,
	schema: [
		organizationSchema(),
		websiteSchema(),
	],
})

export const getCatalogSeo = () => ({
	title: 'Каталог цифровых товаров - PokuBaka',
	description: 'Каталог цифровых товаров PokuBaka: подписки, игровые ключи, пополнение сервисов и другие товары с быстрой выдачей после оплаты.',
	canonical: `${SITE_ORIGIN}/catalog`,
	robots: 'index, follow',
	ogType: 'website',
	image: DEFAULT_IMAGE,
	schema: [
		{
			'@context': 'https://schema.org',
			'@type': 'CollectionPage',
			name: 'Каталог цифровых товаров PokuBaka',
			description: BRAND_DESCRIPTION,
			url: `${SITE_ORIGIN}/catalog`,
		},
		breadcrumbSchema([
			{ name: 'Главная', url: `${SITE_ORIGIN}/` },
			{ name: 'Каталог', url: `${SITE_ORIGIN}/catalog` },
		]),
	],
})

export const getFaqSeo = faq => ({
	title: 'FAQ - вопросы и ответы PokuBaka',
	description: 'Ответы на частые вопросы о покупке цифровых товаров, оплате, выдаче заказов, гарантиях и поддержке PokuBaka.',
	canonical: `${SITE_ORIGIN}/faq`,
	robots: 'index, follow',
	ogType: 'website',
	image: DEFAULT_IMAGE,
	schema: [
		{
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: (Array.isArray(faq) ? faq : [])
				.filter(item => stripText(item.question) && stripText(item.answer))
				.slice(0, 20)
				.map(item => ({
					'@type': 'Question',
					name: stripText(item.question),
					acceptedAnswer: {
						'@type': 'Answer',
						text: stripText(item.answer),
					},
				})),
		},
		breadcrumbSchema([
			{ name: 'Главная', url: `${SITE_ORIGIN}/` },
			{ name: 'FAQ', url: `${SITE_ORIGIN}/faq` },
		]),
	],
})

export const getNewsListSeo = () => ({
	title: 'Новости PokuBaka',
	description: 'Новости PokuBaka о цифровых товарах, игровых сервисах, подписках, ключах и обновлениях магазина.',
	canonical: `${SITE_ORIGIN}/news`,
	robots: 'index, follow',
	ogType: 'website',
	image: DEFAULT_IMAGE,
	schema: [
		{
			'@context': 'https://schema.org',
			'@type': 'CollectionPage',
			name: 'Новости PokuBaka',
			url: `${SITE_ORIGIN}/news`,
		},
		breadcrumbSchema([
			{ name: 'Главная', url: `${SITE_ORIGIN}/` },
			{ name: 'Новости', url: `${SITE_ORIGIN}/news` },
		]),
	],
})

export const getCategorySeo = category => {
	const name = stripText(category.name)
	const canonical = `${SITE_ORIGIN}/${createSlug(name)}`
	const description = truncateText(
		category.desc ||
		`Купить ${name} в PokuBaka. Цифровые товары с быстрой выдачей после оплаты, поддержкой и гарантией.`
	)
	const hasItems = Array.isArray(category.items) && category.items.length > 0

	return {
		title: `${name} - купить в PokuBaka`,
		description,
		canonical,
		robots: hasItems ? 'index, follow' : 'noindex, follow',
		ogType: 'website',
		image: absoluteUrl(category.img),
		schema: [
			{
				'@context': 'https://schema.org',
				'@type': 'CollectionPage',
				name,
				description,
				url: canonical,
			},
			breadcrumbSchema([
				{ name: 'Главная', url: `${SITE_ORIGIN}/` },
				{ name: 'Каталог', url: `${SITE_ORIGIN}/catalog` },
				{ name, url: canonical },
			]),
		],
	}
}

export const getItemSeo = ({ category, item }) => {
	const categoryName = stripText(category.name)
	const itemName = stripText(item.name)
	const canonical = `${SITE_ORIGIN}/${createSlug(categoryName)}/${createSlug(itemName)}`
	const description = truncateText(
		item.desc ||
		`Купить ${itemName} в PokuBaka. Моментальная выдача цифрового товара после оплаты, поддержка и гарантия.`
	)
	const image = absoluteUrl(item.img)
	const price = Number(item.price) || 0

	return {
		title: `${itemName} - купить в PokuBaka`,
		description,
		canonical,
		robots: 'index, follow',
		ogType: 'product',
		image,
		schema: [
			{
				'@context': 'https://schema.org',
				'@type': 'Product',
				name: itemName,
				description,
				image,
				brand: {
					'@type': 'Brand',
					name: BRAND_NAME,
				},
				category: categoryName,
				offers: {
					'@type': 'Offer',
					url: canonical,
					priceCurrency: 'RUB',
					price,
					availability: 'https://schema.org/InStock',
				},
			},
			breadcrumbSchema([
				{ name: 'Главная', url: `${SITE_ORIGIN}/` },
				{ name: 'Каталог', url: `${SITE_ORIGIN}/catalog` },
				{ name: categoryName, url: `${SITE_ORIGIN}/${createSlug(categoryName)}` },
				{ name: itemName, url: canonical },
			]),
		],
	}
}

export const getNewsSeo = news => {
	const slug = createSlug(news.title) || String(news.id)
	const canonical = `${SITE_ORIGIN}/news/${slug}`
	const description = truncateText(news.description || news.content || news.title)
	const image = absoluteUrl(news.image)

	return {
		title: `${stripText(news.title)} | PokuBaka`,
		description,
		canonical,
		robots: 'index, follow',
		ogType: 'article',
		image,
		slug,
		schema: [
			{
				'@context': 'https://schema.org',
				'@type': 'NewsArticle',
				headline: stripText(news.title),
				description,
				image,
				datePublished: news.publishedAt,
				dateModified: news.updatedAt || news.publishedAt,
				mainEntityOfPage: canonical,
				author: {
					'@type': 'Organization',
					name: BRAND_NAME,
				},
				publisher: {
					'@type': 'Organization',
					name: BRAND_NAME,
					logo: {
						'@type': 'ImageObject',
						url: `${SITE_ORIGIN}/assets/icons/128x128.png`,
					},
				},
			},
			breadcrumbSchema([
				{ name: 'Главная', url: `${SITE_ORIGIN}/` },
				{ name: 'Новости', url: `${SITE_ORIGIN}/news` },
				{ name: stripText(news.title), url: canonical },
			]),
		],
	}
}

const replaceOrInsert = (html, pattern, replacement, anchorPattern = /<\/title>/i) => {
	if (pattern.test(html)) return html.replace(pattern, replacement)
	return html.replace(anchorPattern, `${anchorPattern.source === '<\\/title>' ? '</title>' : ''}\n\t\t${replacement}`)
}

const setTitle = (html, title) => {
	const replacement = `<title>${escapeHtml(title)}</title>`
	return /<title>[\s\S]*?<\/title>/i.test(html)
		? html.replace(/<title>[\s\S]*?<\/title>/i, replacement)
		: html.replace(/<head[^>]*>/i, match => `${match}\n\t\t${replacement}`)
}

const setMetaName = (html, name, content) => {
	const tag = `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}" />`
	const pattern = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i')
	return pattern.test(html) ? html.replace(pattern, tag) : html.replace(/<\/title>/i, `</title>\n\t\t${tag}`)
}

const setMetaProperty = (html, property, content) => {
	const tag = `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}" />`
	const pattern = new RegExp(`<meta\\s+property=["']${property}["'][^>]*>`, 'i')
	return pattern.test(html) ? html.replace(pattern, tag) : html.replace(/<\/title>/i, `</title>\n\t\t${tag}`)
}

const setCanonical = (html, href) => {
	const tag = `<link rel="canonical" href="${escapeHtml(href)}" />`
	return /<link\s+rel=["']canonical["'][^>]*>/i.test(html)
		? html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, tag)
		: html.replace(/<\/title>/i, `</title>\n\t\t${tag}`)
}

const addSchema = (html, schema) => {
	const cleanHtml = html.replace(/\s*<script\s+type=["']application\/ld\+json["']\s+data-seo-schema>[\s\S]*?<\/script>/gi, '')
	if (!schema || (Array.isArray(schema) && !schema.length)) return cleanHtml

	const json = JSON.stringify(Array.isArray(schema) && schema.length === 1 ? schema[0] : schema)
		.replace(/</g, '\\u003c')
	const script = `\n\t\t<script type="application/ld+json" data-seo-schema>${json}</script>`
	return cleanHtml.replace(/<\/head>/i, `${script}\n\t</head>`)
}

export const sendSeoHtml = (res, clientDir, fileName, seo, statusCode = 200) => {
	const filePath = path.join(clientDir, fileName)
	let html = fs.readFileSync(filePath, 'utf8')
	const image = seo.image || DEFAULT_IMAGE

	html = setTitle(html, seo.title)
	html = setMetaName(html, 'description', seo.description)
	html = setMetaName(html, 'robots', seo.robots || 'index, follow')
	html = setCanonical(html, seo.canonical)
	html = setMetaProperty(html, 'og:type', seo.ogType || 'website')
	html = setMetaProperty(html, 'og:site_name', BRAND_NAME)
	html = setMetaProperty(html, 'og:title', seo.title)
	html = setMetaProperty(html, 'og:description', seo.description)
	html = setMetaProperty(html, 'og:url', seo.canonical)
	html = setMetaProperty(html, 'og:image', image)
	html = setMetaName(html, 'twitter:card', 'summary')
	html = setMetaName(html, 'twitter:title', seo.title)
	html = setMetaName(html, 'twitter:description', seo.description)
	html = setMetaName(html, 'twitter:image', image)
	html = addSchema(html, seo.schema)

	res.status(statusCode).type('html').send(html)
}

export const sendNotFound = res => {
	res.status(404).type('html').send(`<!doctype html>
<html lang="ru">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="robots" content="noindex, follow">
	<title>Страница не найдена - PokuBaka</title>
</head>
<body>
	<h1>Страница не найдена</h1>
	<p>Такой страницы нет или она была удалена.</p>
	<a href="/catalog">Перейти в каталог</a>
</body>
</html>`)
}

export const buildSitemapXml = async prisma => {
	const [categories, items, news] = await Promise.all([
		prisma.category.findMany({
			include: {
				items: {
					where: { isVisible: true },
					orderBy: publicItemOrder,
				},
			},
			orderBy: publicCategoryOrder,
		}),
		prisma.item.findMany({
			where: { isVisible: true, category: { isNot: null } },
			include: { category: true },
			orderBy: publicItemOrder,
		}),
		prisma.news.findMany({
			where: {
				active: true,
				category: { active: true },
			},
			orderBy: [
				{ publishedAt: 'desc' },
				{ id: 'desc' },
			],
		}),
	])

	const urls = [
		{ loc: `${SITE_ORIGIN}/`, priority: '1.0', changefreq: 'daily' },
		{ loc: `${SITE_ORIGIN}/catalog`, priority: '0.9', changefreq: 'daily' },
		{ loc: `${SITE_ORIGIN}/faq`, priority: '0.6', changefreq: 'monthly' },
		{ loc: `${SITE_ORIGIN}/news`, priority: '0.7', changefreq: 'weekly' },
	]

	categories
		.filter(category => category.items.length > 0)
		.forEach(category => {
			urls.push({
				loc: `${SITE_ORIGIN}/${createSlug(category.name)}`,
				priority: '0.8',
				changefreq: 'weekly',
			})
		})

	items.forEach(item => {
		urls.push({
			loc: `${SITE_ORIGIN}/${createSlug(item.category.name)}/${createSlug(item.name)}`,
			priority: '0.85',
			changefreq: 'weekly',
		})
	})

	news.forEach(item => {
		urls.push({
			loc: `${SITE_ORIGIN}/news/${createSlug(item.title) || item.id}`,
			priority: '0.65',
			changefreq: 'monthly',
			lastmod: new Date(item.updatedAt || item.publishedAt).toISOString(),
		})
	})

	const uniqueUrls = [...new Map(urls.map(url => [url.loc, url])).values()]
	const body = uniqueUrls.map(url => `\t<url>
\t\t<loc>${escapeXml(url.loc)}</loc>
${url.lastmod ? `\t\t<lastmod>${escapeXml(url.lastmod)}</lastmod>\n` : ''}\t\t<changefreq>${url.changefreq}</changefreq>
\t\t<priority>${url.priority}</priority>
\t</url>`).join('\n')

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`
}
