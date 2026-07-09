import cors from 'cors'
import express from 'express'
import fs from 'fs'
import multer from 'multer'
import bodyParser from 'body-parser'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

import {
	AdminController,
	CategoryController,
	ItemController,
	PaymentController,
	FaqController,
	BestSellersController,
	ProductFolderController,
	NewsController,
} from './controllers/controller.js'
import { checkAuth } from './utils/utils.js'
import {
	buildSitemapXml,
	createSlug,
	findPublicCategory,
	findPublicItemById,
	findPublicItemBySlug,
	findPublicNews,
	getCatalogSeo,
	getCategorySeo,
	getFaqSeo,
	getHomeSeo,
	getItemSeo,
	getNewsListSeo,
	getNewsSeo,
	sendNotFound,
	sendSeoHtml,
} from './services/seo.js'

const API_PATH = '/api'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const loadEnvFile = () => {
	const envPath = path.join(__dirname, '.env')
	if (!fs.existsSync(envPath)) return

	const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
	envLines.forEach(line => {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
		if (!match) return

		const [, key, rawValue] = match
		if (process.env[key]) return

		process.env[key] = rawValue.replace(/^["']|["']$/g, '')
	})
}

loadEnvFile()

const app = express()
app.disable('x-powered-by')
const prisma = new PrismaClient()
const CLIENT_DIR = path.join(__dirname, '../client')

const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:8848,http://localhost:5500,http://127.0.0.1:5500,http://212.67.8.140')
	.split(',')
	.map(origin => origin.trim())
	.filter(Boolean)

const createRateLimiter = ({ windowMs, max }) => {
	const hits = new Map()
	return (req, res, next) => {
		const key = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
		const now = Date.now()
		const entry = hits.get(key) || { count: 0, resetAt: now + windowMs }

		if (entry.resetAt <= now) {
			entry.count = 0
			entry.resetAt = now + windowMs
		}

		entry.count += 1
		hits.set(key, entry)

		if (entry.count > max) {
			return res.status(429).json({ success: false, message: 'Too many requests' })
		}

		next()
	}
}

const adminAuthLimiter = createRateLimiter({
	windowMs: 15 * 60 * 1000,
	max: Number(process.env.ADMIN_LOGIN_RATE_LIMIT || 10),
})

const createOrderLimiter = createRateLimiter({
	windowMs: 60 * 1000,
	max: Number(process.env.CREATE_ORDER_RATE_LIMIT || 30),
})

const getDigisellerSellerId = () => String(process.env.DIGISELLER_SELLER_ID || '').trim()
const getDigisellerChatUrl = () =>
	`https://chat.digiseller.com/asp/start.asp?fr=g&id_d=0&lang=ru-RU&ownshop=1&service=1&shop=1&user=${encodeURIComponent(getDigisellerSellerId())}`

const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const allowedImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const isAllowedImage = file => {
	const ext = path.extname(file.originalname || '').toLowerCase()
	return allowedImageMimeTypes.has(file.mimetype) && allowedImageExtensions.has(ext)
}

const productImageStorage = multer.diskStorage({
	destination: (_, __, cb) => {
		const uploadDir = path.join(__dirname, 'uploads', 'products')
		fs.mkdirSync(uploadDir, { recursive: true })
		cb(null, uploadDir)
	},
	filename: (_, file, cb) => {
		const ext = path.extname(file.originalname).toLowerCase()
		const safeExt = allowedImageExtensions.has(ext) ? ext : '.webp'
		cb(null, `product-${Date.now()}-${crypto.randomUUID()}${safeExt}`)
	},
})

const productImageUpload = multer({
	storage: productImageStorage,
	limits: { fileSize: 10 * 1024 * 1024 },
	fileFilter: (_, file, cb) => {
		if (isAllowedImage(file)) return cb(null, true)
		cb(new Error('Можно загрузить только PNG, JPG или WEBP'))
	},
})

const handleProductImageUpload = (req, res, next) => {
	productImageUpload.single('image')(req, res, error => {
		if (error) {
			return res.status(400).json({
				success: false,
				message: error.message || 'Ошибка загрузки изображения',
			})
		}

		next()
	})
}

const bestSellerAvatarStorage = multer.diskStorage({
	destination: (_, __, cb) => {
		const uploadDir = path.join(__dirname, 'uploads', 'best-sellers')
		fs.mkdirSync(uploadDir, { recursive: true })
		cb(null, uploadDir)
	},
	filename: (req, file, cb) => {
		const productId = Number(req.params.productId)
		const ext = path.extname(file.originalname).toLowerCase()
		const safeExt = allowedImageExtensions.has(ext) ? ext : '.webp'
		const safeProductId = Number.isInteger(productId) && productId > 0 ? productId : 'item'
		cb(null, `best-seller-${safeProductId}-${Date.now()}-${crypto.randomUUID()}${safeExt}`)
	},
})

const bestSellerAvatarUpload = multer({
	storage: bestSellerAvatarStorage,
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (_, file, cb) => {
		if (isAllowedImage(file)) return cb(null, true)
		cb(new Error('Можно загрузить только PNG, JPG или WEBP'))
	},
})

const handleBestSellerAvatarUpload = (req, res, next) => {
	bestSellerAvatarUpload.single('avatar')(req, res, error => {
		if (error) {
			return res.status(400).json({
				success: false,
				message: error.message || 'Ошибка загрузки аватарки',
			})
		}

		next()
	})
}

const newsImageStorage = multer.diskStorage({
	destination: (_, __, cb) => {
		const uploadDir = path.join(__dirname, 'uploads', 'news')
		fs.mkdirSync(uploadDir, { recursive: true })
		cb(null, uploadDir)
	},
	filename: (_, file, cb) => {
		const ext = path.extname(file.originalname).toLowerCase()
		const safeExt = allowedImageExtensions.has(ext) ? ext : '.webp'
		cb(null, `news-${Date.now()}-${crypto.randomUUID()}${safeExt}`)
	},
})

const newsImageUpload = multer({
	storage: newsImageStorage,
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (_, file, cb) => {
		if (isAllowedImage(file)) return cb(null, true)
		cb(new Error('Можно загрузить только PNG, JPG или WEBP'))
	},
})

const handleNewsImageUpload = (req, res, next) => {
	newsImageUpload.single('image')(req, res, error => {
		if (error) {
			return res.status(400).json({
				success: false,
				message: error.message || 'Ошибка загрузки изображения новости',
			})
		}

		next()
	})
}
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '10mb' }))
app.use(express.urlencoded({ limit: process.env.URLENCODED_BODY_LIMIT || '10mb', extended: true }))

app.use((_, res, next) => {
	res.setHeader('X-Content-Type-Options', 'nosniff')
	res.setHeader('X-Frame-Options', 'SAMEORIGIN')
	res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
	res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
	next()
})

app.use(
	cors({
		origin: CLIENT_ORIGINS,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
		allowedHeaders: ['Content-Type', 'authorization'],
		credentials: true,
	})
)

const htmlRedirects = new Map([
	['/index.html', '/'],
	['/catalog.html', '/catalog'],
	['/categories.html', '/catalog'],
	['/news.html', '/news'],
	['/faq.html', '/faq'],
	['/product.html', '/catalog'],
	['/item.html', '/catalog'],
	['/news-detail.html', '/news'],
])

app.get([...htmlRedirects.keys()], (req, res) => {
	res.redirect(301, htmlRedirects.get(req.path) || '/')
})

app.get('/sitemap.xml', async (_, res) => {
	try {
		const sitemap = await buildSitemapXml(prisma)
		res
			.type('application/xml')
			.set('Cache-Control', 'public, max-age=3600')
			.send(sitemap)
	} catch (error) {
		console.error('Sitemap build error:', error)
		res.status(500).type('text/plain').send('Sitemap temporarily unavailable')
	}
})

// Р Р°Р·РґР°С‡Р° СЃС‚Р°С‚РёС‡РµСЃРєРёС… С„Р°Р№Р»РѕРІ РєР»РёРµРЅС‚Р° Рё РїР°РїРєРё uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
	dotfiles: 'deny',
	index: false,
	setHeaders: res => {
		res.setHeader('X-Content-Type-Options', 'nosniff')
		res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
	},
}))
app.use(express.static(CLIENT_DIR, {
	dotfiles: 'deny',
	index: false,
	setHeaders: (res, filePath) => {
		const normalizedPath = filePath.replace(/\\/g, '/')
		const isAsset = /\/(assets|css|js)\//.test(normalizedPath)
		const isPrivatePage = /\/(admin|dashboard|modal)\.html$/i.test(normalizedPath)

		res.setHeader('X-Content-Type-Options', 'nosniff')

		if (isPrivatePage) {
			res.setHeader('X-Robots-Tag', 'noindex, nofollow')
			res.setHeader('Cache-Control', 'no-store')
			return
		}

		if (isAsset) {
			res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
			return
		}

		res.setHeader('Cache-Control', 'public, max-age=300')
	},
}))

app.get(API_PATH + '/items', ItemController.getAll)
app.get(API_PATH + '/items/:id', ItemController.getOne)
app.post(API_PATH + '/items', checkAuth, ItemController.create)
app.patch(API_PATH + '/items/:id', checkAuth, ItemController.update)
app.delete(API_PATH + '/items/:id', checkAuth, ItemController.remove)
app.delete(API_PATH + '/items-bulk', checkAuth, ItemController.removeAll)
app.post(API_PATH + '/items-bulk/show-all', checkAuth, ItemController.showAll)
app.post(API_PATH + '/items/reorder', checkAuth, ItemController.reorder)
app.post(API_PATH + '/digiseller/sync', checkAuth, ItemController.syncDigisellerProducts)

app.get(API_PATH + '/categories', CategoryController.getAll)

// РњР°СЂС€СЂСѓС‚ РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ РєР°С‚РµРіРѕСЂРёРё РїРѕ РёРјРµРЅРё
app.get(API_PATH + '/categories/name/:categoryName', CategoryController.getOneByName);


// РњР°СЂС€СЂСѓС‚ РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ С‚РѕРІР°СЂР° РїРѕ РёРјРµРЅРё Рё РєР°С‚РµРіРѕСЂРёРё
app.get(API_PATH + '/categories/name/:categoryName/items/name/:itemName', ItemController.getOneByName);


app.get(API_PATH + '/itemsAdmin', checkAuth, ItemController.getAllAdmin)
app.get(API_PATH + '/digiseller/chat', (_, res) => {
	const sellerId = getDigisellerSellerId()

	res.json({
		success: true,
		chatUrl: '/digiseller-chat',
		configured: Boolean(sellerId),
	})
})
app.get('/digiseller-chat', (_, res) => {
	const sellerId = getDigisellerSellerId()

	if (!sellerId) {
		return res.status(500).type('html').send(`<!doctype html>
<html lang="ru">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Чат поддержки не настроен</title>
</head>
<body>
	<p>Чат поддержки Digiseller не настроен: не указан DIGISELLER_SELLER_ID.</p>
</body>
</html>`)
	}

	res.redirect(getDigisellerChatUrl())
})
app.get(API_PATH + '/admin/product-folders', checkAuth, ProductFolderController.getAll)
app.post(API_PATH + '/admin/product-folders', checkAuth, ProductFolderController.create)
app.patch(API_PATH + '/admin/product-folders/:id', checkAuth, ProductFolderController.update)
app.delete(API_PATH + '/admin/product-folders/:id', checkAuth, ProductFolderController.remove)
app.post(API_PATH + '/admin/product-folders/move-items', checkAuth, ProductFolderController.moveItems)
app.post(API_PATH + '/categories', checkAuth, CategoryController.create)
app.patch(API_PATH + '/categories/:id', checkAuth, CategoryController.update)
app.delete(API_PATH + '/categories/:id', checkAuth, CategoryController.remove)
app.post(API_PATH + '/categories/reorder', checkAuth, CategoryController.reorder)

app.post(API_PATH + '/admin', adminAuthLimiter, AdminController.auth)

app.get(API_PATH + '/best-sellers', BestSellersController.getPublic)
app.get(API_PATH + '/admin/best-sellers', checkAuth, BestSellersController.getAdmin)
app.put(API_PATH + '/admin/best-sellers', checkAuth, BestSellersController.updateAdmin)
app.post(API_PATH + '/admin/best-sellers/:productId/avatar', checkAuth, handleBestSellerAvatarUpload, BestSellersController.uploadAvatar)
app.delete(API_PATH + '/admin/best-sellers/:productId/avatar', checkAuth, BestSellersController.removeAvatar)

app.get(API_PATH + '/faq', FaqController.getPublic)
app.get(API_PATH + '/admin/faq', checkAuth, FaqController.getAllAdmin)
app.post(API_PATH + '/admin/faq/reorder', checkAuth, FaqController.reorder)
app.post(API_PATH + '/admin/faq-sections', checkAuth, FaqController.createSection)
app.put(API_PATH + '/admin/faq-sections/:id', checkAuth, FaqController.updateSection)
app.delete(API_PATH + '/admin/faq-sections/:id', checkAuth, FaqController.removeSection)
app.post(API_PATH + '/admin/faq-sections/reorder', checkAuth, FaqController.reorderSections)
app.post(API_PATH + '/admin/faq', checkAuth, FaqController.create)
app.put(API_PATH + '/admin/faq/:id', checkAuth, FaqController.update)
app.delete(API_PATH + '/admin/faq/:id', checkAuth, FaqController.remove)

app.get(API_PATH + '/news', NewsController.getPublic)
app.get(API_PATH + '/news-categories', NewsController.getPublicCategories)
app.get(API_PATH + '/news/:id', NewsController.getPublicOne)
app.post(API_PATH + '/news/:id/view', NewsController.incrementView)
app.post(API_PATH + '/news/:id/like', NewsController.toggleLike)

app.get(API_PATH + '/admin/news', checkAuth, NewsController.getAllAdmin)
app.post(API_PATH + '/admin/news', checkAuth, handleNewsImageUpload, NewsController.create)
app.put(API_PATH + '/admin/news/:id', checkAuth, handleNewsImageUpload, NewsController.update)
app.delete(API_PATH + '/admin/news/:id', checkAuth, NewsController.remove)
app.get(API_PATH + '/admin/news-categories', checkAuth, NewsController.getAllCategoriesAdmin)
app.post(API_PATH + '/admin/news-categories', checkAuth, NewsController.createCategory)
app.put(API_PATH + '/admin/news-categories/:id', checkAuth, NewsController.updateCategory)
app.delete(API_PATH + '/admin/news-categories/:id', checkAuth, NewsController.removeCategory)

app.post(API_PATH + '/upload/product-image', checkAuth, handleProductImageUpload, (req, res) => {
	if (!req.file) {
		return res.status(400).json({ success: false, message: 'Файл изображения не выбран' })
	}

	res.json({
		success: true,
		url: `/uploads/products/${req.file.filename}`,
	})
})

app.post(API_PATH + '/create-order', createOrderLimiter, PaymentController.createOrder)
app.post(API_PATH + '/payment-callback', PaymentController.paymentCallback)
app.get(API_PATH + '/digiseller/pay/:orderId', PaymentController.digisellerPaymentPage)
app.get(API_PATH + '/order-status/:orderId', PaymentController.checkOrder)
app.get('/api/getAllPayments', checkAuth, PaymentController.getAllPayments)
app.get('/api/orders/:orderId', checkAuth, PaymentController.getOrderById)
app.get('/api/orders', checkAuth, PaymentController.getAllOrdersAdmin)

app.use(API_PATH, (req, res) => {
	res.status(404).json({ success: false, message: 'API endpoint not found' })
})

app.use((req, res, next) => {
	const requestedPath = decodeURIComponent(req.path || '')
	const lowerPath = requestedPath.toLowerCase()

	if (
		lowerPath.includes('/.') ||
		lowerPath.startsWith('/backend') ||
		lowerPath.startsWith('/prisma') ||
		lowerPath.startsWith('/data') ||
		lowerPath.startsWith('/logs') ||
		lowerPath.endsWith('.env') ||
		lowerPath.endsWith('.db') ||
		lowerPath.endsWith('.sqlite')
	) {
		return res.status(404).send('Not found')
	}

	next()
})

// app.get('/item.html', (req, res) => {
// 	res.send('WOW!!!')
// })

app.get('/categories', (req, res) => {
	res.redirect(301, '/catalog')
})

app.get('/', (req, res, next) => {
	if (req.path.startsWith(API_PATH)) return next()
	sendSeoHtml(res, CLIENT_DIR, 'index.html', getHomeSeo())
})

app.get('/catalog', (req, res, next) => {
	if (req.path.startsWith(API_PATH)) return next()
	sendSeoHtml(res, CLIENT_DIR, 'categories.html', getCatalogSeo())
})

app.get('/news', (req, res, next) => {
	if (req.path.startsWith(API_PATH)) return next()
	sendSeoHtml(res, CLIENT_DIR, 'news.html', getNewsListSeo())
})

app.get('/news/:id', async (req, res, next) => {
	if (req.path.startsWith(API_PATH)) return next()

	try {
		const news = await findPublicNews(prisma, req.params.id)
		if (!news) return sendNotFound(res)

		const seo = getNewsSeo(news)
		if (req.path !== `/news/${encodeURIComponent(seo.slug)}`) {
			return res.redirect(301, `/news/${encodeURIComponent(seo.slug)}`)
		}

		sendSeoHtml(res, CLIENT_DIR, 'news-detail.html', seo)
	} catch (error) {
		console.error('News page render error:', error)
		sendNotFound(res)
	}
})

app.get('/faq', async (req, res, next) => {
	if (req.path.startsWith(API_PATH)) return next()

	try {
		const faq = await prisma.faq.findMany({
			where: { active: true },
			orderBy: [
				{ sortOrder: 'asc' },
				{ id: 'asc' },
			],
		})
		sendSeoHtml(res, CLIENT_DIR, 'faq.html', getFaqSeo(faq))
	} catch (error) {
		console.error('FAQ page render error:', error)
		sendSeoHtml(res, CLIENT_DIR, 'faq.html', getFaqSeo([]))
	}
})

// РћСЃС‚Р°Р»СЊРЅС‹Рµ Р·Р°РїСЂРѕСЃС‹ (РєСЂРѕРјРµ API) вЂ” РѕС‚РґР°РµРј СЃС‚Р°С‚РёРєСѓ РєР»РёРµРЅС‚Р°
app.get('/:categoryName', async (req, res, next) => {
	if (req.path.startsWith(API_PATH)) return next()

	try {
		const category = await findPublicCategory(prisma, req.params.categoryName)
		if (!category) return sendNotFound(res)

		const canonicalPath = `/${createSlug(category.name)}`
		if (req.path !== canonicalPath) return res.redirect(301, canonicalPath)

		sendSeoHtml(res, CLIENT_DIR, 'product.html', getCategorySeo(category))
	} catch (error) {
		console.error('Category page render error:', error)
		sendNotFound(res)
	}
})

app.get('/:categoryName/item/:itemId', async (req, res, next) => {
	if (req.path.startsWith(API_PATH)) return next()

	try {
		const result = await findPublicItemById(prisma, req.params.itemId)
		if (!result) return sendNotFound(res)

		const canonicalPath = `/${createSlug(result.category.name)}/${createSlug(result.item.name)}`
		res.redirect(301, canonicalPath)
	} catch (error) {
		console.error('Item id route render error:', error)
		sendNotFound(res)
	}
})

app.get('/:categoryName/:itemName', async (req, res, next) => {
	if (req.path.startsWith(API_PATH)) return next()

	try {
		const result = await findPublicItemBySlug(prisma, req.params.categoryName, req.params.itemName)
		if (!result) return sendNotFound(res)

		const canonicalPath = `/${createSlug(result.category.name)}/${createSlug(result.item.name)}`
		if (req.path !== canonicalPath) return res.redirect(301, canonicalPath)

		sendSeoHtml(res, CLIENT_DIR, 'item.html', getItemSeo(result))
	} catch (error) {
		console.error('Item page render error:', error)
		sendNotFound(res)
	}
})

app.get('*', (req, res, next) => {
    if (req.path.startsWith(API_PATH)) return next()
	sendNotFound(res)
})

app.listen(5000, err => {
	if (err) {
		return console.log(err)
	}

	console.log('Server Ok')
})




