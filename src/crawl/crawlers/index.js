import domains from './domains.js'
import auxlists from './auxlists.js'
import xumm from './xumm.js'
import bithomp from './bithomp.js'
import xrpscan from './xrpscan.js'
import gravatar from './gravatar.js'
import twitter from './twitter.js'

export default [
	{ name: 'domains', start: domains },
	{ name: 'auxlists', start: auxlists },
	{ name: 'xumm', start: xumm },
	{ name: 'bithomp', start: bithomp },
	{ name: 'xrpscan', start: xrpscan },
	{ name: 'gravatar', start: gravatar },
	{ name: 'twitter', start: twitter },
]