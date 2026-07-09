import '../utils/loadEnv.js'
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()
const DIGISELLER_PAYMENT_URL = 'https://oplata.info/asp2/pay.asp'
const INVALID_EMAIL_MESSAGE = 'Введите корректный email'

const isValidEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())

const escapeHtml = value =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')

const getRequestOrigin = req => `${req.protocol}://${req.get('host')}`

const normalizeOptionText = value =>
	String(value || '')
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/&nbsp;/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()

const asArray = value => {
	if (!value) return []
	return Array.isArray(value) ? value : [value]
}

const getLocalizedText = value => {
	if (Array.isArray(value)) {
		const ruValue = value.find(item => item?.locale === 'ru-RU') || value[0]
		return getLocalizedText(ruValue?.value ?? ruValue?.text ?? ruValue?.name ?? ruValue)
	}
	if (value && typeof value === 'object') {
		return getLocalizedText(value.value || value.text || value.name || value.label)
	}
	return String(value || '').trim()
}

const getDigisellerToken = async () => {
	const sellerId = Number(process.env.DIGISELLER_SELLER_ID)
	const apiKey = process.env.DIGISELLER_API_KEY

	if (!sellerId || !apiKey) return null

	const timestamp = Math.floor(Date.now() / 1000)
	const sign = crypto.createHash('sha256').update(`${apiKey}${timestamp}`).digest('hex')
	const response = await fetch('https://api.digiseller.com/api/apilogin', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify({ seller_id: sellerId, timestamp, sign }),
	})
	const data = await response.json()

	if (!response.ok || data.retval !== 0 || !data.token) return null
	return data.token
}

const fetchDigisellerProductOptions = async productId => {
	const cacheKey = String(productId)
	const cached = digisellerProductOptionsCache.get(cacheKey)
	if (cached && Date.now() - cached.time < 5 * 60 * 1000) return cached.options

	const token = await getDigisellerToken()
	if (!token) return []

	const response = await fetch(
		`https://api.digiseller.com/api/products/${encodeURIComponent(productId)}/data?token=${encodeURIComponent(token)}&lang=ru-RU`,
		{ headers: { Accept: 'application/json' } }
	)
	const data = await response.json()
	if (!response.ok || (data.retval !== undefined && Number(data.retval) !== 0)) return []

	const product = data.product || data
	const options = asArray(product.options)
	digisellerProductOptionsCache.set(cacheKey, { time: Date.now(), options })
	return options
}

const optionLooksLikeDuration = option => {
	const text = normalizeOptionText(
		[
			option?.label,
			option?.name,
			option?.comment,
			option?.title,
		].filter(Boolean).join(' ')
	)

	return /srok|period|duration|month|mesyac|подпис|срок|месяц|мес|период/.test(text)
}

const findDigisellerDurationVariant = (options, duration) => {
	const wanted = normalizeOptionText(duration)
	if (!wanted) return null

	const matches = []
	for (const option of options) {
		for (const variant of asArray(option?.variants || option?.values || option?.items)) {
			const text = normalizeOptionText(getLocalizedText(variant?.text || variant?.label || variant?.name || variant?.value_text))
			if (!text) continue
			if (text === wanted || text.includes(wanted) || wanted.includes(text)) {
				matches.push({ option, variant, preferred: optionLooksLikeDuration(option) })
			}
		}
	}

	return matches.find(match => match.preferred) || matches[0] || null
}

const getDigisellerDurationFields = async (productId, duration) => {
	try {
		const options = await fetchDigisellerProductOptions(productId)
		const match = findDigisellerDurationVariant(options, duration)
		if (!match) return {}

		const optionId = match.option?.id
		const optionName = match.option?.name || (optionId ? `option_${optionId}` : '')
		const variantValue = match.variant?.value ?? match.variant?.id ?? match.variant?.variant_id
		if (!optionName || variantValue === undefined || variantValue === null || variantValue === '') return {}

		const fields = {
			[optionName]: String(variantValue),
		}

		if (optionId && optionName !== `option_${optionId}`) {
			fields[`option_${optionId}`] = String(variantValue)
		}

		return fields
	} catch (error) {
		console.warn('Digiseller duration option lookup failed:', error.message)
		return {}
	}
}

const parseDurationOption = durationString => {
	const [duration, price, digisellerProductId] = String(durationString).split('|')
	return {
		duration,
		price: Number(price) || 0,
		digisellerProductId: String(digisellerProductId || '').trim() || null,
	}
}

const resolveOrderPrice = (item, requestedType, requestedDuration) => {
	const durations = Array.isArray(item.durations) ? item.durations : []

	if (durations.length) {
		const selected = durations
			.map(parseDurationOption)
			.find(option => option.duration === requestedDuration)

		if (!selected) return null

		return {
			type: 'subs',
			duration: selected.duration,
			price: selected.price,
			digisellerProductId: selected.digisellerProductId,
		}
	}

	return {
		type: requestedType === 'subs' ? 'subs' : 'account',
		duration: null,
		price: Number(item.price) || 0,
		digisellerProductId: null,
	}
}

const resolveOrderDigisellerProductId = (item, duration) => {
	if (!duration) return item.digisellerProductId

	const selected = (Array.isArray(item.durations) ? item.durations : [])
		.map(parseDurationOption)
		.find(option => option.duration === duration)

	return selected?.digisellerProductId || item.digisellerProductId
}

export const createOrder = async (req, res) => {
	const { productId, type, duration, email: rawEmail } = req.body
	const email = String(rawEmail || '').trim()

	try {
		if (!isValidEmail(email)) {
			return res.status(400).json({
				success: false,
				message: INVALID_EMAIL_MESSAGE,
			})
		}

		const item = await prisma.item.findUnique({ where: { id: productId } })
		if (!item || !item.isVisible) {
			return res.status(400).json({
				success: false,
				message: 'Товар не найден',
			})
		}

		if (!resolveOrderDigisellerProductId(item, duration || null)) {
			return res.status(400).json({
				success: false,
				message: 'Оплата для этого товара не настроена. Укажите ID товара Digiseller.',
			})
		}

		const pricing = resolveOrderPrice(item, type, duration || null)
		if (!pricing || pricing.price <= 0) {
			return res.status(400).json({
				success: false,
				message: 'Некорректная цена товара',
			})
		}

		const orderId = uuidv4()
		await prisma.order.create({
			data: {
				id: orderId,
				productId,
				type: pricing.type,
				price: Math.round(pricing.price * 100),
				quantity: 1,
				duration: pricing.duration,
				status: 'pending',
				userId: email,
			},
		})

		return res.json({
			success: true,
			provider: 'digiseller',
			paymentUrl: `/api/digiseller/pay/${orderId}`,
			orderId,
		})
	} catch (error) {
		console.error('Create Digiseller order error:', error)
		return res.status(500).json({
			success: false,
			message: 'Ошибка при создании заказа',
		})
	}
}

export const paymentCallback = async (_req, res) => {
	return res.status(410).json({
		success: false,
		message: 'Payment callback is disabled',
	})
}

export const checkOrder = async (req, res) => {
	try {
		const order = await prisma.order.findUnique({
			where: { id: req.params.orderId },
		})

		if (!order) {
			return res.status(404).json({
				status: 'error',
				message: 'Заказ не найден',
			})
		}

		if (order.status === 'paid') {
			return res.json({
				status: 'success',
				product: order.reservedAccount || '',
			})
		}

		if (order.status === 'pending') {
			return res.json({ status: 'pending' })
		}

		return res.json({
			status: 'failed',
			message: 'Заказ не оплачен',
		})
	} catch (error) {
		console.error('Check order error:', error)
		return res.status(500).json({
			status: 'error',
			message: 'Ошибка при проверке заказа',
		})
	}
}

export const getAllPayments = async (_req, res) => {
	try {
		const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' } })
		return res.json({ success: true, orders })
	} catch (error) {
		console.error('Get payments error:', error)
		return res.status(500).json({
			success: false,
			message: 'Ошибка при получении заказов',
		})
	}
}

export const getOrderById = async (req, res) => {
	try {
		const { orderId } = req.params
		const order = await prisma.order.findUnique({ where: { id: orderId } })

		if (!order) {
			return res.status(404).json({
				success: false,
				message: 'Заказ не найден',
			})
		}

		if (order.status !== 'paid') {
			return res.status(200).json({ success: true, paid: false })
		}

		const item = await prisma.item.findUnique({ where: { id: order.productId } })
		if (!item) {
			return res.status(404).json({
				success: false,
				message: 'Товар не найден',
			})
		}

		const category = item.categoryId
			? await prisma.category.findUnique({ where: { id: item.categoryId } })
			: null

		return res.json({
			success: true,
			paid: true,
			order: {
				id: order.id,
				createdAt: order.createdAt,
				price: order.price,
				type: order.type,
				duration: order.duration,
				quantity: order.quantity,
				reservedAccount: order.reservedAccount,
				itemName: item.name,
				categoryName: category?.name || null,
			},
		})
	} catch (error) {
		console.error('Get order error:', error)
		return res.status(500).json({
			success: false,
			message: 'Ошибка при получении заказа',
		})
	}
}

export const getAllOrdersAdmin = async (_req, res) => {
	try {
		const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' } })
		const productIds = [...new Set(orders.map(order => order.productId))]
		const items = await prisma.item.findMany({ where: { id: { in: productIds } } })
		const categoryIds = [...new Set(items.map(item => item.categoryId).filter(Boolean))]
		const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } })

		const itemMap = new Map(items.map(item => [item.id, item]))
		const categoryMap = new Map(categories.map(category => [category.id, category]))

		const result = orders.map(order => {
			const item = itemMap.get(order.productId)
			const category = item ? categoryMap.get(item.categoryId) : null
			return {
				id: order.id,
				createdAt: order.createdAt,
				status: order.status,
				price: order.price,
				type: order.type,
				duration: order.duration,
				quantity: order.quantity,
				reservedAccount: order.reservedAccount,
				productId: order.productId,
				itemName: item?.name || null,
				categoryName: category?.name || null,
			}
		})

		return res.json({ success: true, orders: result })
	} catch (error) {
		console.error('Get admin orders error:', error)
		return res.status(500).json({
			success: false,
			message: 'Ошибка при получении истории заказов',
		})
	}
}

export const digisellerPaymentPage = async (req, res) => {
	try {
		const order = await prisma.order.findUnique({ where: { id: req.params.orderId } })
		if (!order) return res.status(404).send('Заказ не найден')

		const item = await prisma.item.findUnique({ where: { id: order.productId } })
		const digisellerProductId = item ? resolveOrderDigisellerProductId(item, order.duration) : null
		if (!item || !digisellerProductId) {
			return res.status(400).send('У товара не указан ID Digiseller')
		}

		const failPage = `${getRequestOrigin(req)}/`
		const fields = {
			typecurr: 'RUB',
			email: order.userId || '',
			lang: 'ru-RU',
			failpage: failPage,
			id_d: digisellerProductId,
		}

		const inputs = Object.entries(fields)
			.map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
			.join('\n')

		return res.type('html').send(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Digiseller</title>
</head>
<body>
  <form id="digisellerPaymentForm" action="${DIGISELLER_PAYMENT_URL}" method="post">
    ${inputs}
    <noscript><button type="submit">Digiseller</button></noscript>
  </form>
  <script>document.getElementById('digisellerPaymentForm').submit()</script>
</body>
</html>`)
	} catch (error) {
		console.error('Digiseller redirect error:', error)
		return res.status(500).send('Ошибка при переходе к оплате Digiseller')
	}
}
