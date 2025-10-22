import domains from './domains.js'
import trustlists from './trustlists.js'
import xaman from './xaman.js'
import bithomp from './bithomp.js'
import xrpscan from './xrpscan.js'
import gravatar from './gravatar.js'
import x from './x.js'

export default [
	{ name: 'domains', start: domains },
	{ name: 'trustlists', start: trustlists },
	{ name: 'xaman', start: xaman },
	{ name: 'bithomp', start: bithomp },
	{ name: 'xrpscan', start: xrpscan },
	{ name: 'gravatar', start: gravatar },
	{ name: 'x', start: x }
]