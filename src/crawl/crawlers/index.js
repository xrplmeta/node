import domains from './domains.js'
import tokenlists from './tokenlists.js'
import xumm from './xumm.js'
import xrplf from './xrplf.js'
import bithomp from './bithomp.js'
import xrpscan from './xrpscan.js'
import gravatar from './gravatar.js'
import twitter from './twitter.js'

export default [
	{ name: 'domains', start: domains },
	{ name: 'tokenlists', start: tokenlists },
	{ name: 'xumm', start: xumm },
	{ name: 'xrplf', start: xrplf },
	{ name: 'bithomp', start: bithomp },
	{ name: 'xrpscan', start: xrpscan },
	{ name: 'gravatar', start: gravatar },
	{ name: 'twitter', start: twitter },
]