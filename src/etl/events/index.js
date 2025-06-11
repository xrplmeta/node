import { extractLedgerStats } from './ledgers.js'
import { extractTokenExchanges } from './tokens.js'
import { extractNFTokenExchanges, extractNFTokenModifications } from './nfts.js'


export function extractEvents({ ctx, ledger }){
	extractLedgerStats({ ctx, ledger })
	extractTokenExchanges({ ctx, ledger })
	extractNFTokenExchanges({ ctx, ledger })
	extractNFTokenModifications({ ctx, ledger })
}