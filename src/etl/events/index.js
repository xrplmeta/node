import { extractLedgerStats } from './ledgerstats.js'
import { extractTokenExchanges } from './tokenexchanges.js'
import { extractNFTokenExchanges } from './nftexchanges.js'


export function extractEvents({ ctx, ledger }){
	extractLedgerStats({ ctx, ledger })
	extractTokenExchanges({ ctx, ledger })
	extractNFTokenExchanges({ ctx, ledger })
}