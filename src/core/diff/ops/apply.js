import { sum, sub, gt, eq } from '@xrplkit/xfl'
import { insertOrdered } from '../../../lib/utils.js'
import { write as writeBalance } from '../../../lib/meta/generic/balances.js'
import { read as readTokenMetrics, write as writeTokenMetrics } from '../../../lib/meta/token/metrics.js'
import { read as readTokenWhales, write as writeTokenWhales } from '../../../lib/meta/token/whales.js'
import { read as readTokenOffers, write as writeTokenOffers } from '../../../lib/meta/token/offers.js'


export function Account({ ctx, account, deltas }){
	for(let { previous, final } of deltas){
		if(!ctx.inBackfill){
			ctx.meta.accounts.createOne({ 
				data: final 
			})
		}

		writeBalance({
			ctx,
			account,
			token: { currency: 'XRP' },
			ledgerSequence: ctx.ledgerSequence,
			balance: final
				? final.balance
				: '0'
		})
	}
}

export function Token({ ctx, token, deltas }){
	const maxWhales = ctx.config.ledger.tokens.captureWhales

	token = ctx.meta.tokens.createOne({
		data: token
	})

	let latestPreviousSequence = Math.min(
		...deltas.map(
			({ previous, final }) => final?.previousSequence || previous?.previousSequence
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

	let whales = readTokenWhales({
		ctx,
		ledgerSequence: ctx.ledgerSequence,
		token
	})

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

		whales = whales.filter(
			whale => whale.account.address !== (previous?.account.address || final?.account.address)
		)

		if(final && gt(final.balance, 0)){
			insertOrdered({
				list: whales,
				item: { 
					account: final.account, 
					balance: final.balance,
					sequenceStart: final.previousSequence
				},
				greaterThan: item => gt(item.balance, final.balance),
				maxSize: maxWhales
			})
		}
	}
	
	writeTokenMetrics({
		ctx,
		token,
		ledgerSequence: latestPreviousSequence,
		metrics
	})
	
	writeTokenWhales({
		ctx,
		token,
		ledgerSequence: ctx.ledgerSequence,
		whales
	})
}

export function Book({ ctx, book, deltas }){
	let ledgerSequence = ctx.ledgerSequence
	let stacks = readTokenOffers({ ctx, book, ledgerSequence })

	for(let { previous, final } of deltas){
		let stack = stacks.find(
			stack => eq(stack.quality, previous?.quality || final?.quality)
		)

		if(previous && final){
			if(!stack){
				throw new Error(`missing meta entry`)
			}

			stack.sequenceStart = ledgerSequence
			stack.size = sum(
				stack.size, 
				sub(final.size, previous.size)
			)
		}else if(final){
			if(stack){
				stack.size = sum(stack.size, final.size)
				stack.offersCount++
				stack.sequenceStart = Math.max(stack.sequenceStart, final.previousSequence)
			}else{
				insertOrdered({
					list: stacks,
					item: {
						...book,
						quality: final.quality,
						size: final.size,
						offersCount: 1,
						sequenceStart: final.previousSequence
					},
					greaterThan: item => gt(item.quality, final.quality)
				})
			}
		}else{
			if(!stack){
				console.log(stacks)
				console.log(previous)
				throw new Error(`missing meta entry`)
			}
			
			stack.sequenceStart = ledgerSequence
			stack.size = sub(stack.size, previous.size)
			stack.offersCount--

			if(stack.offersCount <= 0){
				stacks = stacks.filter(
					s => s !== stack
				)
			}
		}
	}

	writeTokenOffers({
		ctx,
		book,
		ledgerSequence,
		offers: stacks
	})
}

export function NFTPage({ ctx, account, deltas }){
	
}

export function NFTOffer({ ctx, nft, deltas }){
	
}