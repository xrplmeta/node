import crypto from 'crypto'
import log from '@mwni/log'
import { div, sum } from '@xrplkit/xfl/native'
import { sort } from '@xrplkit/xfl/extras'

export async function reduce({ state, meta, ledgerIndex, ...ctx }){
	let counter = 0
	let books = await state.currencyOffers.iter({
		distinct: [
			'takerPaysCurrency', 
			'takerPaysIssuer', 
			'takerGetsCurrency', 
			'takerGetsIssuer'
		],
		where: {
			NOT: {
				change: null
			}
		}
	})

	for await(let book of books){
		await updateBook({ ...ctx, book, state, meta, ledgerIndex })

		log.accumulate.info({
			line: [
				`pulled`,
				++counter,
				`of`,
				books.length,
				`books from state (+%pulledBooks in %time)`
			],
			pulledBooks: 1
		})
	}
}

async function updateBook({ book, state, meta, ledgerIndex }){
	let directories = {}
	let offers = await state.currencyOffers.readMany({
		where: {
			...book
		},
		include: {
			account: true,
			takerPaysCurrency: true,
			takerPaysIssuer: true,
			takerGetsCurrency: true,
			takerGetsIssuer: true,
		}
	})

	for(let offer of offers){
		let dir = directories[offer.directory]

		if(!dir){
			let base
			let quote
			let rate = div(offer.takerPaysValue, offer.takerGetsValue)

			if(offer.takerPaysIssuer){
				quote = {
					currency: {
						code: offer.takerPaysCurrency.code
					},
					issuer: {
						address: offer.takerPaysIssuer.address
					}
				}
			}
	
			if(offer.takerGetsIssuer){
				base = {
					currency: {
						code: offer.takerGetsCurrency.code
					},
					issuer: {
						address: offer.takerGetsIssuer.address
					}
				}
			}

			dir = directories[offer.directory] = {
				quote,
				base,
				rate,
				volume: 0,
				uid: crypto.createHash('md5')
			}
		}

		dir.volume = sum(dir.volume, offer.takerGetsValue)
		dir.uid.update(offer.account.address)
		dir.uid.update(offer.sequence.toString())
	}

	let sortedDirectories = sort(
		Object.values(directories),
		'rate'
	)

	for(let rank=0; rank<sortedDirectories.length; rank++){
		let dir = sortedDirectories[rank]

		await meta.tokenOffers.createOne({
			data: {
				...dir,
				rank,
				startLedgerIndex: ledgerIndex,
				uid: dir.uid
					.digest('hex')
					.slice(0, 12)
					.toUpperCase()
			}
		})
	}
}