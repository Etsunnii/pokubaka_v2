import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, '..', 'data')
const DATA_FILE = path.join(DATA_DIR, 'best-sellers.json')
const UPLOAD_PREFIX = '/uploads/best-sellers/'

const ensureStore = () => {
	if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
	if (!fs.existsSync(DATA_FILE)) {
		fs.writeFileSync(DATA_FILE, JSON.stringify({ items: [] }, null, 2))
	}
}

const normalizeAvatar = value => {
	const avatar = String(value || '').trim()
	return avatar.startsWith(UPLOAD_PREFIX) ? avatar : ''
}

const normalizeItems = items => {
	const seen = new Set()
	return Array.isArray(items)
		? items
				.map(item => ({
					productId: Number(item?.productId ?? item?.id),
					avatar: normalizeAvatar(item?.avatar),
				}))
				.filter(item => Number.isInteger(item.productId) && item.productId > 0)
				.filter(item => {
					if (seen.has(item.productId)) return false
					seen.add(item.productId)
					return true
				})
		: []
}

const normalizeIds = ids =>
	normalizeItems(Array.isArray(ids) ? ids.map(productId => ({ productId })) : [])

const readItems = () => {
	try {
		ensureStore()
		const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
		if (Array.isArray(data.items)) return normalizeItems(data.items)
		return normalizeIds(data.productIds)
	} catch {
		return []
	}
}

const writeItems = items => {
	ensureStore()
	fs.writeFileSync(DATA_FILE, JSON.stringify({ items: normalizeItems(items) }, null, 2))
}

const getAvatarFilePath = avatar => {
	if (!avatar || !avatar.startsWith(UPLOAD_PREFIX)) return ''
	return path.join(__dirname, avatar.replace('/uploads/', 'uploads/'))
}

const removeAvatarFile = avatar => {
	const filePath = getAvatarFilePath(avatar)
	if (!filePath || !fs.existsSync(filePath)) return
	try {
		fs.unlinkSync(filePath)
	} catch (error) {
		console.log(error)
	}
}

const getOrderedProducts = async (items, publicOnly = false) => {
	const ids = items.map(item => item.productId)
	const products = await prisma.item.findMany({
		where: {
			id: { in: ids },
			...(publicOnly ? { isVisible: true } : {}),
		},
		include: { category: true },
	})
	const productsById = new Map(products.map(product => [product.id, product]))
	return items
		.map(item => {
			const product = productsById.get(item.productId)
			return product ? { ...product, bestSellerAvatar: item.avatar || '' } : null
		})
		.filter(Boolean)
}

export const getPublic = async (_, res) => {
	try {
		const items = readItems()
		const products = await getOrderedProducts(items, true)
		res.json({ products })
	} catch (error) {
		console.log(error)
		res.status(500).json({ products: [] })
	}
}

export const getAdmin = async (_, res) => {
	try {
		const items = readItems()
		const products = await prisma.item.findMany({
			include: { category: true },
			orderBy: [
				{ sortOrder: 'asc' },
				{ id: 'asc' },
			],
		})
		res.json({
			products,
			items,
			selectedProductIds: items.map(item => item.productId),
		})
	} catch (error) {
		console.log(error)
		res.status(500).json({ success: false, message: 'Best sellers load error' })
	}
}

export const updateAdmin = async (req, res) => {
	try {
		const incomingItems = Array.isArray(req.body?.items)
			? normalizeItems(req.body.items)
			: normalizeIds(req.body?.productIds)

		const ids = incomingItems.map(item => item.productId)
		const existingProducts = await prisma.item.findMany({
			where: { id: { in: ids } },
			select: { id: true },
		})
		const existingIds = new Set(existingProducts.map(product => product.id))
		const validItems = incomingItems.filter(item => existingIds.has(item.productId))

		writeItems(validItems)
		res.json({
			success: true,
			items: validItems,
			selectedProductIds: validItems.map(item => item.productId),
		})
	} catch (error) {
		console.log(error)
		res.status(500).json({ success: false, message: 'Best sellers save error' })
	}
}

export const uploadAvatar = async (req, res) => {
	try {
		const productId = Number(req.params.productId)
		if (!Number.isInteger(productId) || productId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid product id' })
		}

		if (!req.file) {
			return res.status(400).json({ success: false, message: 'Avatar file is required' })
		}

		const product = await prisma.item.findUnique({ where: { id: productId }, select: { id: true } })
		if (!product) {
			removeAvatarFile(`${UPLOAD_PREFIX}${req.file.filename}`)
			return res.status(404).json({ success: false, message: 'Product not found' })
		}

		const items = readItems()
		let item = items.find(entry => entry.productId === productId)
		if (!item) {
			item = { productId, avatar: '' }
			items.push(item)
		}

		removeAvatarFile(item.avatar)
		item.avatar = `${UPLOAD_PREFIX}${req.file.filename}`
		writeItems(items)

		res.json({ success: true, avatar: item.avatar, items })
	} catch (error) {
		console.log(error)
		res.status(500).json({ success: false, message: 'Best seller avatar upload error' })
	}
}

export const removeAvatar = async (req, res) => {
	try {
		const productId = Number(req.params.productId)
		if (!Number.isInteger(productId) || productId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid product id' })
		}

		const items = readItems()
		const item = items.find(entry => entry.productId === productId)
		if (!item) {
			return res.status(404).json({ success: false, message: 'Product is not selected' })
		}

		removeAvatarFile(item.avatar)
		item.avatar = ''
		writeItems(items)

		res.json({ success: true, avatar: '', items })
	} catch (error) {
		console.log(error)
		res.status(500).json({ success: false, message: 'Best seller avatar delete error' })
	}
}
