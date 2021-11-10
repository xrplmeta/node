import ledgerLive from './ledger/live.js'
import ledgerStates from './ledger/states.js'
import ledgerTxs from './ledger/txs.js'
import xumm from './thirdparty/xumm.js'
import bithomp from './thirdparty/bithomp.js'
import twitter from './thirdparty/twitter.js'
import gravatar from './thirdparty/gravatar.js'

export default {
	'ledger.live': ledgerLive,
	'ledger.states': ledgerStates,
	'ledger.txs': ledgerTxs,
	'thirdparty.xumm': xumm,
	'thirdparty.bithomp': bithomp,
	'thirdparty.twitter': twitter,
	'thirdparty.gravatar': gravatar
}