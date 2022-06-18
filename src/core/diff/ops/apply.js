import { sum, sub, gt, eq } from '@xrplkit/xfl'
import { read as readTokenMetrics, write as writeTokenMetrics } from '../../../lib/meta/token/metrics.js'
import { read as readTokenWhales, write as writeTokenWhales } from '../../../lib/meta/token/whales.js'
import { read as readTokenOffers, write as writeTokenOffers } from '../../../lib/meta/token/offers.js'


export function Account({ ctx, account, deltas }){
	for(let { previous, final } of deltas){
		if(final){
			ctx.meta.accounts.createOne({ 
				data: final 
			})
		}else{
			ctx.meta.accounts.deleteOne({
				where: {
					address: previous.address
				}
			})
		}
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
			let whale = { 
				account: final.account, 
				balance: final.balance,
				sequenceStart: final.previousSequence
			}

			let greaterWhaleIndex = whales
				.findIndex(whale => gt(whale.balance, final.balance))

			if(greaterWhaleIndex === -1){
				whales.push(whale)
			}else if(greaterWhaleIndex === 0){
				if(whales.length < maxWhales)
					whales.unshift(whale)
			}else{
				whales.splice(greaterWhaleIndex, 0, whale)
			}

			if(whales.length > maxWhales)
				whales.shift()
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
				stacks.push({
					...book,
					quality: final.quality,
					size: final.size,
					offersCount: 1,
					sequenceStart: final.previousSequence
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

/*

function updateBook({ bookId, state, meta, ledgerSequence }){
	let base
	let quote
	let book = state.books.readOne({
		where: {
			id: bookId
		},
		include: {
			takerPays: {
				issuer: true
			},
			takerGets: {
				issuer: true
			}
		}
	})

	if(book.takerPays){
		quote = {
			currency: book.takerPays.currency,
			issuer: {
				address: book.takerPays.issuer.address
			}
		}
	}

	if(book.takerGets){
		base = {
			currency: book.takerGets.currency,
			issuer: {
				address: book.takerGets.issuer.address
			}
		}
	}

	let directories = {}
	let offers = state.currencyOffers.readMany({
		where: {
			book: {
				id: bookId
			}
		}
	})

	for(let offer of offers){
		let dir = directories[offer.directory]

		if(!dir){
			try{
				dir = directories[offer.directory] = {
					directory: offer.directory,
					rate: div(offer.takerPays, offer.takerGets),
					volume: 0
				}
			}catch{
				continue
			}
		}

		dir.volume = sum(dir.volume, offer.takerGets)
	}

	let sortedDirectories = sort(
		Object.values(directories),
		'rate'
	)

	for(let rank=0; rank<sortedDirectories.length; rank++){
		let dir = sortedDirectories[rank]

		writeOffer({
			meta,
			ledgerSequence,
			offer: {
				...dir,
				base,
				quote,
				rank,
				startledgerSequence: ledgerSequence,
				directory: crypto.createHash('md5')
					.update(dir.directory)
					.digest('hex')
					.slice(0, 12)
					.toUpperCase()
			}
		})
	}
}*/