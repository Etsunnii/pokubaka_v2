import '../utils/loadEnv.js'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin'
const ADMIN_PASS = process.env.ADMIN_PASSWORD || ''
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || ''
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me'

const safeEqual = (left, right) => {
	const leftBuffer = Buffer.from(String(left || ''))
	const rightBuffer = Buffer.from(String(right || ''))
	if (leftBuffer.length !== rightBuffer.length) return false
	return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

const sha256 = value => crypto.createHash('sha256').update(String(value || '')).digest('hex')

const isValidPassword = password => {
	if (ADMIN_PASSWORD_HASH) {
		return safeEqual(sha256(password), ADMIN_PASSWORD_HASH)
	}

	if (!ADMIN_PASS) return false
	return safeEqual(password, ADMIN_PASS)
}

export const auth = async (req, res) => {
	try {
		if (safeEqual(req.body.login, ADMIN_LOGIN) && isValidPassword(req.body.password)) {
			const token = jwt.sign(
				{
					id: ADMIN_LOGIN,
				},
				JWT_SECRET,
				{
					expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '12h',
				}
			)

			res.status(200).json({
				token,
			})
		} else {
			res.status(404).json({
				message: 'Неправильный логин или пароль',
			})
		}
	} catch (err) {
		console.log(err)
		res.status(500).json({
			message: 'Ошибка аунтефикации',
		})
	}
}
