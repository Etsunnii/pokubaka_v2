import './loadEnv.js'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me'

export default (req, res, next) => {
	const token = (req.headers.authorization || '').replace(/Bearer\s?/, '')

	if (token) {
		try {
			const decoded = jwt.verify(token, JWT_SECRET)

			req.userId = decoded.id

			next()
		} catch (err) {
			return res.status(403).json({
				message: 'No access',
			})
		}
	} else {
		return res.status(403).json({
			message: 'No access',
		})
	}
}
