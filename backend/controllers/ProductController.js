import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const getAll = async (req, res) => {
	try {
		const products = await prisma.product.findMany()
		res.status(200).json(products)
	} catch (err) {
		console.log(err)
		res.status(500).json({
			message: 'Ошибка при получении всех товаров',
		})
	}
}

export const getLeaders = async (req, res) => {
	try {
		const leaders = await prisma.product.findMany({
			orderBy: {
				payCount: 'desc',
			},
			take: 4, // Ограничение до 4 записей
		})
		res.status(200).json(leaders)
	} catch (err) {
		console.log(err)
		res.status(500).json({ message: 'Ошибка при получении лидеров продаж' })
	}
}

export const getOne = async (req, res) => {
	try {
		const productId = req.params.id
		const product = await prisma.product.findUnique({
			where: { id: +productId },
			include: {
				items: true,
			},
		})

		if (!product) {
			return res.status(404).json({
				message: 'Не удалось найти продукт с указанным id',
			})
		}

		res.json(product)
	} catch (err) {
		console.log(err)
		res.status(500).json({ message: 'Ошибка при получении продукта' })
	}
}
