import ledgerStream from './ledger/stream.js'
import ledgerSnapshot from './ledger/snapshot.js'
import ledgerTransactions from './ledger/transactions.js'
import xumm from './thirdparty/xumm.js'
import bithomp from './thirdparty/bithomp.js'
import xrpscan from './thirdparty/xrpscan.js'
import twitter from './thirdparty/twitter.js'
import gravatar from './thirdparty/gravatar.js'

export default {
	'stream': ledgerStream,
	'snapshot': ledgerSnapshot,
	'transactions': ledgerTransactions,
	'xumm': xumm,
	'bithomp': bithomp,
	'xrpscan': xrpscan,
	'twitter': twitter,
	'gravatar': gravatar
}