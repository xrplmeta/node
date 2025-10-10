import { applyLedgerStats } from './ledgers.js'
import { applyTokenExchanges } from './tokens.js'
import { applyNFTokenExchanges, applyNFTokenModifications } from './nfts.js'


export function applyLedgerEvents({ ctx, ledger }){
	applyLedgerStats({ ctx, ledger })
	applyTokenExchanges({ ctx, ledger })
	applyNFTokenExchanges({ ctx, ledger })
	applyNFTokenModifications({ ctx, ledger })
}