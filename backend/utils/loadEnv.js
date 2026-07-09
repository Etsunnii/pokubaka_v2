import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.join(__dirname, '..', '.env')

if (fs.existsSync(envPath)) {
	const content = fs.readFileSync(envPath, 'utf8')
	content
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(line => line && !line.startsWith('#') && line.includes('='))
		.forEach(line => {
			const index = line.indexOf('=')
			const key = line.slice(0, index).trim()
			const rawValue = line.slice(index + 1).trim()
			const value = rawValue.replace(/^["']|["']$/g, '')
			if (key && process.env[key] === undefined) process.env[key] = value
		})
}
