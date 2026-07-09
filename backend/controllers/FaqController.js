import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const toBoolean = value => {
	if (typeof value === 'boolean') return value
	if (value === 'false') return false
	if (value === '0') return false
	return Boolean(value)
}

const toNullableInt = value => {
	const number = Number(value)
	return Number.isInteger(number) && number > 0 ? number : null
}

const publicFaq = faq => ({
	id: faq.id,
	question: faq.question,
	answer: faq.answer,
	sectionId: faq.sectionId,
	sortOrder: faq.sortOrder,
})

const publicSection = section => ({
	id: section.id,
	title: section.title,
	sortOrder: section.sortOrder,
	faq: (section.faq || []).map(publicFaq),
})

const readFaqPayload = body => ({
	question: String(body.question || '').trim(),
	answer: String(body.answer || '').trim(),
	active: toBoolean(body.active),
	sectionId: toNullableInt(body.sectionId),
})

const readSectionPayload = body => ({
	title: String(body.title || '').trim(),
})

const getNextFaqSortOrder = async sectionId => {
	const last = await prisma.faq.findFirst({
		where: { sectionId },
		orderBy: [
			{ sortOrder: 'desc' },
			{ id: 'desc' },
		],
	})

	return last ? last.sortOrder + 1 : 0
}

const getNextSectionSortOrder = async () => {
	const last = await prisma.faqSection.findFirst({
		orderBy: [
			{ sortOrder: 'desc' },
			{ id: 'desc' },
		],
	})

	return last ? last.sortOrder + 1 : 0
}

const ensureSectionExists = async sectionId => {
	if (!sectionId) return null
	return prisma.faqSection.findUnique({ where: { id: sectionId } })
}

export const getPublic = async (_, res) => {
	try {
		const sections = await prisma.faqSection.findMany({
			orderBy: [
				{ sortOrder: 'asc' },
				{ id: 'asc' },
			],
			include: {
				faq: {
					where: { active: true },
					orderBy: [
						{ sortOrder: 'asc' },
						{ id: 'asc' },
					],
				},
			},
		})

		const publicSections = sections
			.map(publicSection)
			.filter(section => section.faq.length > 0)

		res.json({
			sections: publicSections,
			faq: publicSections.flatMap(section =>
				section.faq.map(item => ({
					...item,
					section: section.title,
				}))
			),
		})
	} catch (err) {
		console.log(err)
		res.status(500).json({ success: false, message: 'Ошибка при получении FAQ' })
	}
}

export const getAllAdmin = async (_, res) => {
	try {
		const sections = await prisma.faqSection.findMany({
			orderBy: [
				{ sortOrder: 'asc' },
				{ id: 'asc' },
			],
			include: {
				faq: {
					orderBy: [
						{ sortOrder: 'asc' },
						{ id: 'asc' },
					],
				},
			},
		})

		res.json({
			sections,
			faq: sections.flatMap(section =>
				section.faq.map(item => ({
					...item,
					section,
				}))
			),
		})
	} catch (err) {
		console.log(err)
		res.status(500).json({ success: false, message: 'Ошибка при получении FAQ' })
	}
}

export const createSection = async (req, res) => {
	try {
		const payload = readSectionPayload(req.body)
		if (!payload.title) {
			return res.status(400).json({ success: false, message: 'Введите название блока FAQ' })
		}

		const section = await prisma.faqSection.create({
			data: {
				title: payload.title,
				sortOrder: await getNextSectionSortOrder(),
			},
		})

		res.status(201).json({ success: true, section })
	} catch (err) {
		console.log(err)
		res.status(500).json({ success: false, message: 'Ошибка при создании блока FAQ' })
	}
}

export const updateSection = async (req, res) => {
	try {
		const id = Number(req.params.id)
		if (!Number.isInteger(id)) {
			return res.status(400).json({ success: false, message: 'Неверный id блока FAQ' })
		}

		const payload = readSectionPayload(req.body)
		if (!payload.title) {
			return res.status(400).json({ success: false, message: 'Введите название блока FAQ' })
		}

		const section = await prisma.faqSection.update({
			where: { id },
			data: { title: payload.title },
		})

		res.json({ success: true, section })
	} catch (err) {
		console.log(err)
		res.status(500).json({ success: false, message: 'Ошибка при обновлении блока FAQ' })
	}
}

export const removeSection = async (req, res) => {
	try {
		const id = Number(req.params.id)
		if (!Number.isInteger(id)) {
			return res.status(400).json({ success: false, message: 'Неверный id блока FAQ' })
		}

		await prisma.faqSection.delete({ where: { id } })
		res.json({ success: true })
	} catch (err) {
		console.log(err)
		res.status(500).json({ success: false, message: 'Ошибка при удалении блока FAQ' })
	}
}

export const reorderSections = async (req, res) => {
	try {
		const updates = Array.isArray(req.body) ? req.body : req.body.updates
		if (!Array.isArray(updates)) {
			return res.status(400).json({ success: false, message: 'Неверный формат данных' })
		}

		await prisma.$transaction(
			updates.map((item, index) =>
				prisma.faqSection.update({
					where: { id: Number(item.id) },
					data: { sortOrder: Number.isInteger(Number(item.sortOrder)) ? Number(item.sortOrder) : index },
				})
			)
		)

		res.json({ success: true })
	} catch (err) {
		console.log(err)
		res.status(500).json({ success: false, message: 'Ошибка при изменении порядка блоков FAQ' })
	}
}

export const create = async (req, res) => {
	try {
		const payload = readFaqPayload(req.body)
		if (!payload.question || !payload.answer) {
			return res.status(400).json({ success: false, message: 'Заполните вопрос и ответ' })
		}

		if (!payload.sectionId || !(await ensureSectionExists(payload.sectionId))) {
			return res.status(400).json({ success: false, message: 'Выберите блок FAQ' })
		}

		const faq = await prisma.faq.create({
			data: {
				...payload,
				sortOrder: await getNextFaqSortOrder(payload.sectionId),
			},
		})

		res.status(201).json({ success: true, faq })
	} catch (err) {
		console.log(err)
		res.status(500).json({ success: false, message: 'Ошибка при создании FAQ' })
	}
}

export const update = async (req, res) => {
	try {
		const id = Number(req.params.id)
		if (!Number.isInteger(id)) {
			return res.status(400).json({ success: false, message: 'Неверный id FAQ' })
		}

		const payload = readFaqPayload(req.body)
		if (!payload.question || !payload.answer) {
			return res.status(400).json({ success: false, message: 'Заполните вопрос и ответ' })
		}

		if (!payload.sectionId || !(await ensureSectionExists(payload.sectionId))) {
			return res.status(400).json({ success: false, message: 'Выберите блок FAQ' })
		}

		const current = await prisma.faq.findUnique({ where: { id } })
		if (!current) {
			return res.status(404).json({ success: false, message: 'FAQ не найден' })
		}

		const movedToAnotherSection = current.sectionId !== payload.sectionId
		const faq = await prisma.faq.update({
			where: { id },
			data: {
				...payload,
				sortOrder: movedToAnotherSection
					? await getNextFaqSortOrder(payload.sectionId)
					: current.sortOrder,
			},
		})

		res.json({ success: true, faq })
	} catch (err) {
		console.log(err)
		res.status(500).json({ success: false, message: 'Ошибка при обновлении FAQ' })
	}
}

export const remove = async (req, res) => {
	try {
		const id = Number(req.params.id)
		if (!Number.isInteger(id)) {
			return res.status(400).json({ success: false, message: 'Неверный id FAQ' })
		}

		await prisma.faq.delete({ where: { id } })
		res.json({ success: true })
	} catch (err) {
		console.log(err)
		res.status(500).json({ success: false, message: 'Ошибка при удалении FAQ' })
	}
}

export const reorder = async (req, res) => {
	try {
		const sectionId = toNullableInt(req.body.sectionId)
		const updates = req.body.updates

		if (!sectionId || !Array.isArray(updates)) {
			return res.status(400).json({ success: false, message: 'Неверный формат данных' })
		}

		await prisma.$transaction(
			updates.map((item, index) =>
				prisma.faq.update({
					where: { id: Number(item.id) },
					data: {
						sectionId,
						sortOrder: Number.isInteger(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
					},
				})
			)
		)

		res.json({ success: true })
	} catch (err) {
		console.log(err)
		res.status(500).json({ success: false, message: 'Ошибка при изменении порядка FAQ' })
	}
}
