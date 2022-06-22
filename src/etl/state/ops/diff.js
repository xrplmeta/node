import { sum, sub, gt, eq } from '@xrplkit/xfl'
import { writeBalance } from '../../../data/balances.js'
import { expireTokenOffer, writeTokenOffer } from '../../../data/token/offers.js'
import { writeTokenMetrics, readTokenMetrics } from '../../../data/token/metrics.js'


export function Account({ ctx, account, deltas }){
	for(let { final } of deltas){
		if(!ctx.inBackfill){
			ctx.db.accounts.createOne({ 
				data: final 
			})
		}

		writeBalance({
			ctx,
			account,
			token: { 
				currency: 'XRP',
				issuer: null
			},
			ledgerSequence: ctx.ledgerSequence,
			balance: final
				? final.balance
				: '0'
		})
	}
}

export function Token({ ctx, token, deltas }){
	token = ctx.db.tokens.createOne({
		data: token
	})

	let latestPreviousSequence = Math.min(
		...deltas.map(
			({ previous, final }) => {
				return final?.previousSequence || previous?.previousSequence
			}
		)
	)

	let metrics = {
		trustlines: 0,
		holders: 0,
		supply: 0,
		...readTokenMetrics({ 
			ctx, 
			token, 
			ledgerSequence: ctx.ledgerSequence,
			metrics: {
				trustlines: true,
				holders: true,
				supply: true
			}
		})
	}

	for(let { previous, final } of deltas){
		writeBalance({
			ctx,
			account: final.account || previous.account,
			token,
			ledgerSequence: ctx.ledgerSequence,
			balance: final
				? final.balance
				: '0'
		})
		
		if(previous && final){
			metrics.supply = sum(
				metrics.supply,
				sub(final.balance, previous.balance)
			)

			if(eq(previous.balance, 0) && gt(final.balance, 0)){
				metrics.holders++
			}else if(eq(final.balance, 0) && gt(previous.balance, 0)){
				metrics.holders--
			}
		}else if(final){
			metrics.trustlines++

			if(gt(final.balance, 0)){
				metrics.supply = sum(metrics.supply, final.balance)
				metrics.holders++
			}
		}else{
			metrics.trustlines--

			if(gt(previous.balance, 0)){
				metrics.supply = sub(metrics.supply, previous.balance)
				metrics.holders--
			}
		}
	}
	
	writeTokenMetrics({
		ctx,
		token,
		ledgerSequence: latestPreviousSequence,
		metrics
	})
}

export function Book({ ctx, book, deltas }){
	for(let { previous, final } of deltas){
		if(previous){
			expireTokenOffer({
				ctx,
				book,
				account: previous.account,
				accountSequence: previous.accountSequence,
				ledgerSequence: ctx.ledgerSequence
			})
		}

		if(final){
			writeTokenOffer({
				ctx,
				book,
				account: final.account,
				accountSequence: final.accountSequence,
				ledgerSequence: final.previousSequence,
				quality: final.quality,
				size: final.size
			})
		}
	}
}

export function NFTPage({ ctx, account, deltas }){
	
}

export function NFTOffer({ ctx, nft, deltas }){
	
}