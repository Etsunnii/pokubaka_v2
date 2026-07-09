import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const toBoolean = value => {
	if (typeof value === 'boolean') return value
	if (value === 'false' || value === '0' || value === 'off') return false
	return Boolean(value)
}

const toPositiveInt = value => {
	const number = Number(value)
	return Number.isInteger(number) && number > 0 ? number : null
}

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

const slugify = value =>
	transliterate(value)
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)

const makeUniqueSlug = async (name, currentId = null) => {
	const base = slugify(name) || `news-category-${Date.now()}`
	let slug = base
	let index = 2

	while (true) {
		const existing = await prisma.newsCategory.findUnique({ where: { slug } })
		if (!existing || existing.id === currentId) return slug
		slug = `${base}-${index}`
		index += 1
	}
}

const parsePublishedAt = value => {
	if (!value) return new Date()
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? new Date() : date
}

const publicNews = news => ({
	id: news.id,
	slug: slugify(news.title) || String(news.id),
	title: news.title,
	description: news.description,
	content: news.content,
	image: news.image,
	categoryId: news.categoryId,
	categoryName: news.category?.name || '',
	publishedAt: news.publishedAt,
	views: news.views,
	likes: news.likes,
	active: news.active,
	createdAt: news.createdAt,
	updatedAt: news.updatedAt,
})

const readNewsPayload = body => ({
	title: String(body.title || '').trim(),
	description: String(body.description || '').trim(),
	content: String(body.content || '').trim(),
	categoryId: toPositiveInt(body.categoryId),
	publishedAt: parsePublishedAt(body.publishedAt),
	active: toBoolean(body.active),
})

const readCategoryPayload = body => ({
	name: String(body.name || '').trim(),
	active: toBoolean(body.active),
})

const ensureCategory = async id => {
	if (!id) return null
	return prisma.newsCategory.findUnique({ where: { id } })
}

export const getPublic = async (_, res) => {
	try {
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

		res.json({ news: news.map(publicNews) })
	} catch (error) {
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось загрузить новости' })
	}
}

export const getPublicOne = async (req, res) => {
	try {
		const identifier = String(req.params.id || '').trim()
		const id = toPositiveInt(identifier)
		let news = null

		if (id) {
			news = await prisma.news.findFirst({
				where: {
					id,
					active: true,
					category: { active: true },
				},
				include: { category: true },
			})
		} else if (identifier) {
			const slug = slugify(identifier)
			const activeNews = await prisma.news.findMany({
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
			news = activeNews.find(item => (slugify(item.title) || String(item.id)) === slug)
		}

		if (!news) return res.status(404).json({ success: false, message: 'Новость не найдена' })
		res.json({ news: publicNews(news) })
	} catch (error) {
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось загрузить новость' })
	}
}

export const getPublicCategories = async (_, res) => {
	try {
		const categories = await prisma.newsCategory.findMany({
			where: { active: true },
			orderBy: [
				{ name: 'asc' },
				{ id: 'asc' },
			],
		})

		res.json({ categories })
	} catch (error) {
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось загрузить категории новостей' })
	}
}

export const incrementView = async (req, res) => {
	try {
		const id = toPositiveInt(req.params.id)
		if (!id) return res.status(400).json({ success: false, message: 'Неверный id новости' })

		const news = await prisma.news.update({
			where: { id },
			data: { views: { increment: 1 } },
			include: { category: true },
		})

		res.json({ success: true, news: publicNews(news) })
	} catch (error) {
		if (error?.code === 'P2025') {
			return res.status(404).json({ success: false, message: 'Новость не найдена' })
		}
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось обновить просмотры' })
	}
}

export const toggleLike = async (req, res) => {
	try {
		const id = toPositiveInt(req.params.id)
		if (!id) return res.status(400).json({ success: false, message: 'Неверный id новости' })

		const liked = toBoolean(req.body?.liked)
		const news = await prisma.news.update({
			where: { id },
			data: {
				likes: liked
					? { increment: 1 }
					: { decrement: 1 },
			},
			include: { category: true },
		})

		if (news.likes < 0) {
			const fixed = await prisma.news.update({
				where: { id },
				data: { likes: 0 },
				include: { category: true },
			})
			return res.json({ success: true, news: publicNews(fixed) })
		}

		res.json({ success: true, news: publicNews(news) })
	} catch (error) {
		if (error?.code === 'P2025') {
			return res.status(404).json({ success: false, message: 'Новость не найдена' })
		}
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось обновить лайк' })
	}
}

export const getAllAdmin = async (_, res) => {
	try {
		const news = await prisma.news.findMany({
			include: { category: true },
			orderBy: [
				{ publishedAt: 'desc' },
				{ id: 'desc' },
			],
		})

		res.json({ news: news.map(publicNews) })
	} catch (error) {
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось загрузить новости' })
	}
}

export const create = async (req, res) => {
	try {
		const payload = readNewsPayload(req.body)
		if (!payload.title || !payload.description || !payload.content) {
			return res.status(400).json({ success: false, message: 'Заполните заголовок, описание и текст новости' })
		}
		if (!payload.categoryId || !(await ensureCategory(payload.categoryId))) {
			return res.status(400).json({ success: false, message: 'Выберите категорию новости' })
		}
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'Загрузите фотографию новости' })
		}

		const news = await prisma.news.create({
			data: {
				...payload,
				image: `/uploads/news/${req.file.filename}`,
			},
			include: { category: true },
		})

		res.status(201).json({ success: true, news: publicNews(news) })
	} catch (error) {
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось создать новость' })
	}
}

export const update = async (req, res) => {
	try {
		const id = toPositiveInt(req.params.id)
		if (!id) return res.status(400).json({ success: false, message: 'Неверный id новости' })

		const payload = readNewsPayload(req.body)
		if (!payload.title || !payload.description || !payload.content) {
			return res.status(400).json({ success: false, message: 'Заполните заголовок, описание и текст новости' })
		}
		if (!payload.categoryId || !(await ensureCategory(payload.categoryId))) {
			return res.status(400).json({ success: false, message: 'Выберите категорию новости' })
		}

		const news = await prisma.news.update({
			where: { id },
			data: {
				...payload,
				...(req.file ? { image: `/uploads/news/${req.file.filename}` } : {}),
			},
			include: { category: true },
		})

		res.json({ success: true, news: publicNews(news) })
	} catch (error) {
		if (error?.code === 'P2025') {
			return res.status(404).json({ success: false, message: 'Новость не найдена' })
		}
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось обновить новость' })
	}
}

export const remove = async (req, res) => {
	try {
		const id = toPositiveInt(req.params.id)
		if (!id) return res.status(400).json({ success: false, message: 'Неверный id новости' })

		await prisma.news.delete({ where: { id } })
		res.json({ success: true })
	} catch (error) {
		if (error?.code === 'P2025') {
			return res.status(404).json({ success: false, message: 'Новость не найдена' })
		}
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось удалить новость' })
	}
}

export const getAllCategoriesAdmin = async (_, res) => {
	try {
		const categories = await prisma.newsCategory.findMany({
			include: { _count: { select: { news: true } } },
			orderBy: [
				{ name: 'asc' },
				{ id: 'asc' },
			],
		})

		res.json({ categories })
	} catch (error) {
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось загрузить категории новостей' })
	}
}

export const createCategory = async (req, res) => {
	try {
		const payload = readCategoryPayload(req.body)
		if (!payload.name) {
			return res.status(400).json({ success: false, message: 'Введите название категории' })
		}

		const category = await prisma.newsCategory.create({
			data: {
				...payload,
				slug: await makeUniqueSlug(payload.name),
			},
		})

		res.status(201).json({ success: true, category })
	} catch (error) {
		if (error?.code === 'P2002') {
			return res.status(409).json({ success: false, message: 'Такая категория уже есть' })
		}
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось создать категорию' })
	}
}

export const updateCategory = async (req, res) => {
	try {
		const id = toPositiveInt(req.params.id)
		if (!id) return res.status(400).json({ success: false, message: 'Неверный id категории' })

		const payload = readCategoryPayload(req.body)
		if (!payload.name) {
			return res.status(400).json({ success: false, message: 'Введите название категории' })
		}

		const category = await prisma.newsCategory.update({
			where: { id },
			data: {
				...payload,
				slug: await makeUniqueSlug(payload.name, id),
			},
		})

		res.json({ success: true, category })
	} catch (error) {
		if (error?.code === 'P2025') {
			return res.status(404).json({ success: false, message: 'Категория не найдена' })
		}
		if (error?.code === 'P2002') {
			return res.status(409).json({ success: false, message: 'Такая категория уже есть' })
		}
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось обновить категорию' })
	}
}

export const removeCategory = async (req, res) => {
	try {
		const id = toPositiveInt(req.params.id)
		if (!id) return res.status(400).json({ success: false, message: 'Неверный id категории' })

		const newsCount = await prisma.news.count({ where: { categoryId: id } })
		if (newsCount > 0) {
			return res.status(409).json({ success: false, message: 'Категория используется в новостях' })
		}

		await prisma.newsCategory.delete({ where: { id } })
		res.json({ success: true })
	} catch (error) {
		if (error?.code === 'P2025') {
			return res.status(404).json({ success: false, message: 'Категория не найдена' })
		}
		console.error(error)
		res.status(500).json({ success: false, message: 'Не удалось удалить категорию' })
	}
}
