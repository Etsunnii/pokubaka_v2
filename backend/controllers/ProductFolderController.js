import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const normalizeFolderName = value => String(value || '').trim().replace(/\s+/g, ' ')

const normalizeFolderId = value => {
	if (value === null || value === undefined || value === '' || value === '__none') return null
	const folderId = Number(value)
	return Number.isInteger(folderId) && folderId > 0 ? folderId : null
}

const normalizeItemIds = value =>
	(Array.isArray(value) ? value : [])
		.map(id => Number(id))
		.filter(id => Number.isInteger(id) && id > 0)

const getNextSortOrder = async () => {
	const lastFolder = await prisma.productFolder.findFirst({
		orderBy: [
			{ sortOrder: 'desc' },
			{ id: 'desc' },
		],
		select: { sortOrder: true },
	})

	return (lastFolder?.sortOrder ?? -1) + 1
}

const serializeFolder = folder => ({
	id: folder.id,
	name: folder.name,
	sortOrder: folder.sortOrder,
	count: folder._count?.items ?? 0,
})

export const getAll = async (req, res) => {
	try {
		const folders = await prisma.productFolder.findMany({
			orderBy: [
				{ sortOrder: 'asc' },
				{ id: 'asc' },
			],
			include: {
				_count: { select: { items: true } },
			},
		})

		res.json({ success: true, folders: folders.map(serializeFolder) })
	} catch (error) {
		console.error('Product folders load error:', error)
		res.status(500).json({ success: false, message: 'Не удалось загрузить папки товаров' })
	}
}

export const create = async (req, res) => {
	try {
		const name = normalizeFolderName(req.body?.name)
		if (!name) {
			return res.status(400).json({ success: false, message: 'Введите название папки' })
		}
		if (name.length > 80) {
			return res.status(400).json({ success: false, message: 'Название папки слишком длинное' })
		}

		const folder = await prisma.productFolder.create({
			data: {
				name,
				sortOrder: await getNextSortOrder(),
			},
			include: {
				_count: { select: { items: true } },
			},
		})

		res.status(201).json({ success: true, folder: serializeFolder(folder) })
	} catch (error) {
		console.error('Product folder create error:', error)
		const duplicate = error?.code === 'P2002'
		res.status(duplicate ? 409 : 500).json({
			success: false,
			message: duplicate ? 'Такая папка уже существует' : 'Не удалось создать папку',
		})
	}
}

export const update = async (req, res) => {
	try {
		const id = Number(req.params.id)
		const name = normalizeFolderName(req.body?.name)
		if (!Number.isInteger(id) || id <= 0) {
			return res.status(400).json({ success: false, message: 'Некорректная папка' })
		}
		if (!name) {
			return res.status(400).json({ success: false, message: 'Введите название папки' })
		}
		if (name.length > 80) {
			return res.status(400).json({ success: false, message: 'Название папки слишком длинное' })
		}

		const folder = await prisma.productFolder.update({
			where: { id },
			data: { name },
			include: {
				_count: { select: { items: true } },
			},
		})

		res.json({ success: true, folder: serializeFolder(folder) })
	} catch (error) {
		console.error('Product folder update error:', error)
		const notFound = error?.code === 'P2025'
		const duplicate = error?.code === 'P2002'
		res.status(notFound ? 404 : duplicate ? 409 : 500).json({
			success: false,
			message: notFound
				? 'Папка не найдена'
				: duplicate
					? 'Такая папка уже существует'
					: 'Не удалось обновить папку',
		})
	}
}

export const remove = async (req, res) => {
	try {
		const id = Number(req.params.id)
		if (!Number.isInteger(id) || id <= 0) {
			return res.status(400).json({ success: false, message: 'Некорректная папка' })
		}

		await prisma.$transaction([
			prisma.item.updateMany({
				where: { folderId: id },
				data: { folderId: null },
			}),
			prisma.productFolder.delete({ where: { id } }),
		])

		res.json({ success: true })
	} catch (error) {
		console.error('Product folder remove error:', error)
		res.status(error?.code === 'P2025' ? 404 : 500).json({
			success: false,
			message: error?.code === 'P2025' ? 'Папка не найдена' : 'Не удалось удалить папку',
		})
	}
}

export const moveItems = async (req, res) => {
	try {
		const itemIds = normalizeItemIds(req.body?.itemIds)
		const folderId = normalizeFolderId(req.body?.folderId)
		if (!itemIds.length) {
			return res.status(400).json({ success: false, message: 'Выберите товары' })
		}

		if (folderId) {
			const folder = await prisma.productFolder.findUnique({ where: { id: folderId } })
			if (!folder) {
				return res.status(404).json({ success: false, message: 'Папка не найдена' })
			}
		}

		const result = await prisma.item.updateMany({
			where: { id: { in: [...new Set(itemIds)] } },
			data: { folderId },
		})

		res.json({ success: true, updated: result.count })
	} catch (error) {
		console.error('Product folder move items error:', error)
		res.status(500).json({ success: false, message: 'Не удалось переместить товары' })
	}
}
