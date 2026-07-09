const faqList = document.getElementById('faqPageList')

const fallbackSections = [
	{
		title: 'Популярные вопросы',
		items: [
			{
				question: 'Как происходит активация подписки?',
				answer: 'После оплаты мы обрабатываем заказ и подключаем подписку по условиям выбранного товара. Обычно активация занимает от 15 минут.',
			},
			{
				question: 'Безопасно ли передавать данные аккаунта?',
				answer: 'Данные используются только для выполнения заказа. Мы не запрашиваем лишнюю информацию и рекомендуем включать двухфакторную защиту там, где это возможно.',
			},
			{
				question: 'Можно ли использовать свой аккаунт для подключения?',
				answer: 'Да, если это указано в карточке товара. Для некоторых подписок подключение возможно именно на ваш аккаунт.',
			},
			{
				question: 'У меня уже есть активная подписка. Что будет после покупки?',
				answer: 'Условия зависят от сервиса и выбранного товара. Перед покупкой можно написать в поддержку, мы подскажем лучший вариант.',
			},
			{
				question: 'Сколько времени занимает активация?',
				answer: 'Ключ приходит сразу после оплаты, а активация подписки занимает от 15 минут.',
			},
			{
				question: 'Какие способы оплаты доступны?',
				answer: 'Доступные способы оплаты отображаются на странице оплаты после перехода к оформлению заказа.',
			},
			{
				question: 'Какая гарантия предоставляется на подписки?',
				answer: 'Гарантия действует на срок, указанный в карточке товара. Если возникнет проблема, напишите в поддержку с номером заказа.',
			},
		],
	},
]

const escapeHtml = value =>
	String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')

const normalizeSections = data => {
	if (Array.isArray(data.sections) && data.sections.length) {
		const sections = data.sections
			.filter(section => Array.isArray(section.faq) && section.faq.length)
			.map(section => ({
				title: section.title,
				items: section.faq,
			}))

		if (sections.length) return sections
	}

	const faq = Array.isArray(data.faq) ? data.faq : []
	if (!faq.length) return fallbackSections

	const groups = new Map()
	faq.forEach(item => {
		const title = String(item.category || item.section || 'Вопросы').toUpperCase()
		if (!groups.has(title)) groups.set(title, [])
		groups.get(title).push(item)
	})

	return Array.from(groups.entries()).map(([title, items]) => ({ title, items }))
}

const renderSections = sections =>
	sections
		.map(
			(section, sectionIndex) => `
				<div class="faq-page__section">
					${section.title ? `<h2 class="faq-page__section-title">${escapeHtml(section.title)}</h2>` : ''}
					${section.items
						.map((item, itemIndex) => {
							const id = `faq-page-${sectionIndex}-${itemIndex}`
							return `
								<article class="faq-page__item">
									<button class="faq-page__button" type="button" aria-expanded="false" aria-controls="${id}">
										<span>${escapeHtml(item.question)}</span>
										<span class="faq-page__chevron" aria-hidden="true"></span>
									</button>
									<div class="faq-page__answer-wrap" id="${id}">
										<div class="faq-page__answer">${escapeHtml(item.answer)}</div>
									</div>
								</article>
							`
						})
						.join('')}
				</div>
			`
		)
		.join('')

const loadFaq = async () => {
	if (!faqList) return

	faqList.setAttribute('aria-busy', 'true')

	try {
		const response = await fetch('/api/faq')
		if (!response.ok) throw new Error(`FAQ request failed: ${response.status}`)

		const data = await response.json()
		faqList.innerHTML = renderSections(normalizeSections(data))
	} catch (error) {
		console.error(error)
		faqList.innerHTML = renderSections(fallbackSections)
	} finally {
		faqList.removeAttribute('aria-busy')
	}
}

faqList?.addEventListener('click', event => {
	const button = event.target.closest('.faq-page__button')
	if (!button) return

	const item = button.closest('.faq-page__item')
	const answer = document.getElementById(button.getAttribute('aria-controls'))
	const expanded = button.getAttribute('aria-expanded') === 'true'

	button.setAttribute('aria-expanded', String(!expanded))
	item?.classList.toggle('open', !expanded)
	if (answer) {
		answer.style.maxHeight = expanded ? '0px' : `${answer.scrollHeight}px`
	}
})

loadFaq()
