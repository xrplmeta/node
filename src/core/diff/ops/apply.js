import { sum, sub, gt, eq } from '@xrplkit/xfl'
import { read as readTokenMetrics, write as writeTokenMetrics } from '../../meta/token/metrics.js'
import { read as readTokenWhales, write as writeTokenWhales } from '../../meta/token/whales.js'


export function AccountRoot({ ctx, deltas }){
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

export function RippleState({ ctx, deltas }){
	const maxWhales = ctx.config.ledger.tokens.captureWhales

	let token = ctx.meta.tokens.createOne({
		data: deltas[0].token
	})

	let metrics = {
		trustlines: 0,
		holders: 0,
		supply: 0,
		...readTokenMetrics({ 
			ctx, 
			token, 
			ledgerIndex: ctx.ledgerIndex,
			forward: ctx.forwardDiff,
			metrics: {
				trustlines: true,
				holders: true,
				supply: true
			}
		})
	}

	let whales = readTokenWhales({
		ctx,
		ledgerIndex,
		token
	})

	for(let { previous, final } of deltas){
		if(previous && final){
			metrics.supply = sum(
				metrics.supply,
				sub(final.balance, previous.final)
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

		if(previous){
			whales = whales.filter(
				whale => whale.account.address !== previous.account.address
			)
		}

		if(final){
			let whale = { account: final.account, balance: final.balance }
			let greaterWhaleIndex = whales
				.findIndex(whale => gt(whale.balance, balance))


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
		ledgerIndex,
		metrics
	})
	
	writeTokenWhales({
		ctx,
		token,
		ledgerIndex,
		whales
	})
}

export function CurrencyOffer({ ctx, deltas }){
	let { takerPaysToken, takerGetsToken } = deltas[0]
	let base
	let quote

	if(takerPaysToken){
		quote = {
			currency: takerPaysToken.currency,
			issuer: {
				address: takerGetsToken.issuer.address
			}
		}
	}

	if(takerGetsToken){
		base = {
			currency: takerGetsToken.currency,
			issuer: {
				address: takerGetsToken.issuer.address
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
			ledgerIndex,
			offer: {
				...dir,
				base,
				quote,
				rank,
				startLedgerIndex: ledgerIndex,
				directory: crypto.createHash('md5')
					.update(dir.directory)
					.digest('hex')
					.slice(0, 12)
					.toUpperCase()
			}
		})
	}
}

export function NFTokenPage({ ctx, deltas }){
	
}

export function NFTokenOffer({ ctx, deltas }){
	
}



function updateBook({ bookId, state, meta, ledgerIndex }){
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
			ledgerIndex,
			offer: {
				...dir,
				base,
				quote,
				rank,
				startLedgerIndex: ledgerIndex,
				directory: crypto.createHash('md5')
					.update(dir.directory)
					.digest('hex')
					.slice(0, 12)
					.toUpperCase()
			}
		})
	}
}