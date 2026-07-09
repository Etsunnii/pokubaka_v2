(() => {
	const defaultSections = [
		{
			title: 'ЗАКАЗЫ',
			items: [
				{
					question: 'Как сделать заказ?',
					answer: 'Выберите товар, откройте карточку и нажмите кнопку покупки. После оплаты товар будет выдан автоматически.',
				},
				{
					question: 'Сколько времени занимает доставка?',
					answer: 'Большинство цифровых товаров выдаются моментально после успешной оплаты.',
				},
				{
					question: 'Могу ли я отменить заказ?',
					answer: 'Если заказ еще не оплачен, просто не завершайте оплату. По оплаченному заказу напишите в поддержку.',
				},
			],
		},
		{
			title: 'ОПЛАТА',
			items: [
				{
					question: 'Какие способы оплаты доступны?',
					answer: 'Доступные способы оплаты отображаются на странице оплаты после нажатия кнопки покупки.',
				},
				{
					question: 'Безопасно ли платить на вашем сайте?',
					answer: 'Оплата проходит через платежного партнера. Мы не храним данные банковских карт.',
				},
			],
		},
		{
			title: 'ТОВАРЫ',
			items: [
				{
					question: 'Что делать если ключ не работает?',
					answer: 'Сразу напишите в поддержку и приложите номер заказа, скрин ошибки и полученный товар.',
				},
				{
					question: 'Все ли ключи лицензионные?',
					answer: 'Мы работаем только с цифровыми товарами, которые выдаются через официальные или партнерские каналы.',
				},
				{
					question: 'Можно ли купить товар в подарок?',
					answer: 'Да, вы можете купить товар и передать полученные данные другому человеку.',
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

	const ensureFaqModal = () => {
		if (document.getElementById('faqModal')) return

		document.body.insertAdjacentHTML(
			'beforeend',
			`
				<div class="faq-modal-backdrop" id="faqModalBackdrop" hidden></div>
				<section
					class="faq-modal"
					id="faqModal"
					role="dialog"
					aria-modal="true"
					aria-labelledby="faqModalTitle"
					hidden
				>
					<header class="faq-modal__head">
						<div class="faq-modal__title-row">
							<span class="faq-modal__title-icon" aria-hidden="true">
								<img src="/assets/icons/help-chat.png" alt="" />
							</span>
							<h2 class="faq-modal__title" id="faqModalTitle">Часто задаваемые вопросы</h2>
						</div>
						<button class="faq-modal__close" type="button" aria-label="Закрыть FAQ">×</button>
					</header>
					<div class="faq-modal__body">
						<div class="faq-list" id="faqList"></div>
					</div>
					<footer class="faq-modal__footer">
						<span>Не нашли ответ?</span>
						<a class="faq-modal__telegram" href="https://t.me/pokubakasupport" target="_blank" rel="noopener">
							Написать в Telegram →
						</a>
					</footer>
				</section>
			`
		)
	}

	const groupFaq = faq => {
		if (!faq.length) return defaultSections

		const groups = new Map()
		faq.forEach(item => {
			const title = String(item.category || item.section || 'ВОПРОСЫ').toUpperCase()
			if (!groups.has(title)) groups.set(title, [])
			groups.get(title).push({
				question: item.question,
				answer: item.answer,
			})
		})

		return Array.from(groups.entries()).map(([title, items]) => ({ title, items }))
	}

	const renderFaqSections = sections =>
		sections
			.map(
				(section, sectionIndex) => `
					<section class="faq-section">
						<h3 class="faq-section__title">${escapeHtml(section.title)}</h3>
						<div class="faq-section__items">
							${section.items
								.map(
									(item, itemIndex) => {
										const id = `faq-${sectionIndex}-${itemIndex}`
										return `
											<article class="faq-item">
												<button class="faq-item__button" type="button" aria-expanded="false" aria-controls="${id}">
													<span>${escapeHtml(item.question)}</span>
													<span class="faq-item__chevron" aria-hidden="true"></span>
												</button>
												<div class="faq-item__answer" id="${id}" hidden>
													${escapeHtml(item.answer)}
												</div>
											</article>
										`
									}
								)
								.join('')}
						</div>
					</section>
				`
			)
			.join('')

	const loadFaqModal = async () => {
		const faqList = document.getElementById('faqList')
		if (!faqList) return

		faqList.innerHTML = '<p class="faq-empty">Загрузка...</p>'

		try {
			const response = await fetch('/api/faq')
			const data = await response.json()
			const faq = Array.isArray(data.faq) ? data.faq : []
			const sections = Array.isArray(data.sections)
				? data.sections
						.filter(section => Array.isArray(section.faq) && section.faq.length)
						.map(section => ({
							title: section.title,
							items: section.faq,
						}))
				: []
			faqList.innerHTML = renderFaqSections(sections.length ? sections : groupFaq(faq))
		} catch (error) {
			console.error(error)
			faqList.innerHTML = renderFaqSections(defaultSections)
		}
	}

	const openFaqModal = async event => {
		if (event) event.preventDefault()

		ensureFaqModal()
		const faqModal = document.getElementById('faqModal')
		const faqModalBackdrop = document.getElementById('faqModalBackdrop')

		await loadFaqModal()

		faqModal.hidden = false
		faqModalBackdrop.hidden = false
		document.body.classList.add('modal-open')
		document.dispatchEvent(new CustomEvent('faqModal:open'))
	}

	const closeFaqModal = () => {
		const faqModal = document.getElementById('faqModal')
		const faqModalBackdrop = document.getElementById('faqModalBackdrop')
		if (!faqModal || !faqModalBackdrop) return

		faqModal.hidden = true
		faqModalBackdrop.hidden = true
		document.body.classList.remove('modal-open')
		document.dispatchEvent(new CustomEvent('faqModal:close'))
	}

	document.addEventListener('click', event => {
		const openButton = event.target.closest('.faq-open-button')
		if (openButton) {
			openFaqModal(event)
			return
		}

		const faqButton = event.target.closest('.faq-item__button')
		if (faqButton) {
			const answer = document.getElementById(faqButton.getAttribute('aria-controls'))
			const expanded = faqButton.getAttribute('aria-expanded') === 'true'
			faqButton.setAttribute('aria-expanded', String(!expanded))
			faqButton.closest('.faq-item')?.classList.toggle('open', !expanded)
			if (answer) answer.hidden = expanded
			return
		}

		if (
			event.target.closest('.faq-modal__close') ||
			event.target.id === 'faqModalBackdrop'
		) {
			closeFaqModal()
		}
	})

	document.addEventListener('keydown', event => {
		const faqModal = document.getElementById('faqModal')
		if (event.key === 'Escape' && faqModal && !faqModal.hidden) {
			closeFaqModal()
		}
	})
})()
