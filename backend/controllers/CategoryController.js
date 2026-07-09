import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const RU_TO_LAT = {
	а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
	и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
	с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh',
	щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

const createSlug = value => {
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

const sanitizePublicItem = item => {
	const { used_accounts, accounts, pay_count, digisellerProductId, ...rest } = item
	return {
		...rest,
		isDigisellerProduct: Boolean(digisellerProductId),
	}
}


// Получение всех категорий
export const getAll = async (req, res) => {
	try {
		const categories = await prisma.category.findMany({
			orderBy: [
				{ sortOrder: 'asc' },
				{ id: 'asc' },
			],
		})
		res.status(200).json(categories)
	} catch (err) {
		console.log(err)
		res.status(500).json({
			message: 'Ошибка при получении всех категорий',
		})
	}
}

export const getOne = async (req, res) => {
	try {
		const categoryId = req.params.id
		const category = await prisma.category.findUnique({
			where: { id: +categoryId },
			include: {
				items: { where: { isVisible: true } },
			},
		})

		if (!category) {
			return res.status(404).json({
				message: 'Не удалось найти категорию с указанным id',
			})
		}

		// Сортируем items по sortOrder, далее по id по возрастанию
		const sortedItems = category.items.sort((a, b) => {
			if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
			return a.id - b.id
		})

		// Удаляем поля used_accounts, accounts и pay_count из объектов items
		const modifiedCategory = {
			...category,
			items: sortedItems.map(sanitizePublicItem),
		}

		res.json(modifiedCategory)
	} catch (err) {
		console.log(err)
		res.status(500).json({ message: 'Ошибка при получении категории' })
	}
}

export const getOneByName = async (req, res) => {
	try {
		const categorySlug = decodeURIComponent(req.params.categoryName || '')
		const categoryName = categorySlug.replace(/-/g, ' ')

		const categories = await prisma.category.findMany({
			include: { items: { where: { isVisible: true } } },
		})
		const category = categories.find(item =>
			item.name === categoryName ||
			item.name === categorySlug ||
			createSlug(item.name) === categorySlug
		)

		if (!category) {
			return res.status(404).json({ message: 'Category not found' })
		}

		const sortedItems = category.items.sort((a, b) => {
			if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
			return a.id - b.id
		})

		res.json({
			...category,
			items: sortedItems.map(sanitizePublicItem),
		})
	} catch (err) {
		console.error('Category slug lookup error:', err)
		res.status(500).json({ message: 'Category lookup error' })
	}
}

const getOneByNameLegacy = async (req, res) => {
	try {
		const categoryName = req.params.categoryName.replace(/-/g, ' ') // Преобразуем дефисы в пробелы, если они есть

		// Ищем категорию по имени
		const category = await prisma.category.findUnique({
			where: { name: categoryName },
			include: { items: { where: { isVisible: true } } }, // Включаем связанные товары
		})

		// Проверяем, найдена ли категория
		if (!category) {
			return res.status(404).json({ message: 'Категория не найдена' })
		}

		// Сортируем items по sortOrder, далее по id по возрастанию
		const sortedItems = category.items.sort((a, b) => {
			if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
			return a.id - b.id
		})

		// Удаляем поля used_accounts, accounts и pay_count из объектов items
		const modifiedCategory = {
			...category,
			items: sortedItems.map(sanitizePublicItem),
		}

		// Возвращаем данные категории
		res.json(modifiedCategory)
	} catch (err) {
		console.error('Ошибка при получении категории по имени:', err)
		res.status(500).json({ message: 'Ошибка при получении категории' })
	}
}

// Создание новой категории
export const create = async (req, res) => {
	try {
		// Проверка на уникальность имени категории
		const existingCategory = await prisma.category.findUnique({
			where: { name: req.body.name },
		})

		if (existingCategory) {
			return res
				.status(400)
				.json({ message: 'Категория с таким именем уже существует' })
		}

		// Создание категории
		const category = await prisma.category.create({
			data: {
				...req.body,
			},
		})
		res.status(200).json({ category, success: true })
	} catch (err) {
		console.log(err)
		res.status(500).json({ message: 'Ошибка при создании категории' })
	}
}

// Обновление категории по ID
export const update = async (req, res) => {
	try {
		const categoryId = parseInt(req.params.id)
		const category = await prisma.category.update({
			where: {
				id: categoryId,
			},
			data: { ...req.body },
			include: {
				items: { where: { isVisible: true } },
			},
		})

		if (!category) {
			return res.status(500).json({
				message: 'Не удалось найти категорию с указанным id',
			})
		}

		res.json({
			category,
			success: true,
		})
	} catch (err) {
		console.log(err)
		res.status(500).json({
			message: 'Не удалось обновить данную категорию',
		})
	}
}

// Удаление категории по ID
export const remove = async (req, res) => {
	try {
		const categoryId = Number(req.params.id)
		if (!Number.isInteger(categoryId)) {
			return res.status(400).json({ success: false, message: 'Неверный id категории' })
		}

		const category = await prisma.category.findUnique({ where: { id: categoryId } })
		if (!category) {
			return res.status(404).json({ success: false, message: 'Категория не найдена' })
		}

		await prisma.$transaction([
			prisma.digisellerCategoryMapping.deleteMany({ where: { categoryId } }),
			prisma.item.deleteMany({ where: { categoryId } }),
			prisma.category.delete({ where: { id: categoryId } }),
		])

		res.json({ success: true })
	} catch (err) {
		console.log(err)
		res.status(500).json({
			success: false,
			message: 'Ошибка при удалении категории',
		})
	}
}

// Изменение порядка категорий (перетаскивание)
export const reorder = async (req, res) => {
	try {
		const updates = req.body // [{id: number, sortOrder: number}]
		if (!Array.isArray(updates)) {
			return res.status(400).json({ success: false, message: 'Неверный формат данных' })
		}

		await prisma.$transaction(
			updates.map(u =>
				prisma.category.update({
					where: { id: u.id },
					data: { sortOrder: u.sortOrder },
				})
			)
		)

		res.json({ success: true })
	} catch (err) {
		console.log(err)
		res.status(500).json({ success: false, message: 'Ошибка при изменении порядка категорий' })
	}
}

