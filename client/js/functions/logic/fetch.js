const API_URL = '/api'

const parseResponse = async response => {
	if (!response.ok) return null
	try {
		return await response.json()
	} catch (error) {
		console.warn('Response parse error:', error)
		return null
	}
}

export const get = async (url, token = '') => {
	try {
		const response = await fetch(API_URL + url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				authorization: token,
			},
		})

		return parseResponse(response)
	} catch (error) {
		console.warn('Error for get info:', error)
		return null
	}
}

export const create = async (url, body, token = '') => {
	try {
		const response = await fetch(API_URL + url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				authorization: token,
			},
			body: JSON.stringify(body),
		})

		return parseResponse(response)
	} catch (error) {
		console.warn('Error for create:', error)
		return null
	}
}

export const update = async (url, body, token = '') => {
	try {
		const response = await fetch(API_URL + url, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				authorization: token,
			},
			body: JSON.stringify(body),
		})

		return parseResponse(response)
	} catch (error) {
		console.warn('Error for update:', error)
		return null
	}
}

export const remove = async (url, token = '') => {
	try {
		const response = await fetch(API_URL + url, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				authorization: token,
			},
		})

		return parseResponse(response)
	} catch (error) {
		console.warn('Error for remove:', error)
		return null
	}
}
