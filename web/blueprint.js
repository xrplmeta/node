import dotenv from 'dotenv'
import Index from './pages/Index.jsc'

dotenv.config()

export default {
	platform: 'web',
	routes: {
		'/': Index
	},
	assets: {
		styles: {
			dir: 'assets/css',
			global: ['global.css'],
		}
	},
	server: {
		port: process.env.PORT
	}
}