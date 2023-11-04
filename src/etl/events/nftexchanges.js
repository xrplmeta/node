import log from '@mwni/log'
import { parse as parseOffer } from '../state/nftoffers.js'


export function extractNFTokenExchanges({ ctx, ledger }){
	for(let transaction of ledger.transactions){
		if(transaction.TransactionType !== 'NFTokenAcceptOffer')
			continue

		if(transaction.metaData.TransactionResult !== 'tesSUCCESS')
			continue

		let offer

		for(let { DeletedNode } of transaction.metaData.AffectedNodes){
			if(!DeletedNode)
				continue

			if(DeletedNode.LedgerEntryType !== 'NFTokenOffer')
				continue

			if(DeletedNode.LedgerIndex === transaction.NFTokenBuyOffer
				 || DeletedNode.LedgerIndex === transaction.NFTokenSellOffer){
				offer = {
					...parseOffer({
						index: DeletedNode.LedgerIndex,
						entry: DeletedNode.FinalFields
					}),
					ledgerSequence: DeletedNode.FinalFields.PreviousTxnLgrSeq,
					lastLedgerSequence: ledger.sequence - 1
				}
			}
		}

		if(!offer){
			log.warn(`unable to determine accepted nft offer of ${transaction.hash}`)
			continue
		}

		ctx.db.nftExchanges.createOne({
			data: {
				txHash: transaction.hash,
				account: {
					address: transaction.Account
				},
				offer,
				nft: offer.nft,
				ledgerSequence: ledger.sequence
			}
		})
	}
}