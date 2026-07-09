const DEFAULT_DIGISELLER_CHAT_URL = '/digiseller-chat'

const updateDigisellerChatButtons = async () => {
	const buttons = document.querySelectorAll('.digiseller-chat-button')
	if (!buttons.length) return

	try {
		const response = await fetch('/api/digiseller/chat', {
			headers: { Accept: 'application/json' },
		})
		const data = await response.json()
		const chatUrl = data?.chatUrl || DEFAULT_DIGISELLER_CHAT_URL

		buttons.forEach(button => {
			button.href = chatUrl
			button.setAttribute('aria-label', 'Открыть чат поддержки Digiseller')
		})
	} catch (error) {
		console.error(error)
		buttons.forEach(button => {
			button.href = DEFAULT_DIGISELLER_CHAT_URL
			button.setAttribute('aria-label', 'Открыть чат поддержки Digiseller')
		})
	}
}

updateDigisellerChatButtons()
