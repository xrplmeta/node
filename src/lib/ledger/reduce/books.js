import crypto from 'crypto'
import log from '@mwni/log'
import { div, sum, toString } from '@xrplkit/xfl/native'
import { sort } from '@xrplkit/xfl/extras'
import { write as writeOffer } from '../../meta/token/offers.js'

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
			text: [
				`reduced`,
				++counter,
				`of`,
				books.length,
				`books from ledger state (+%reducedBooks in %time)`
			],
			data: {
				reducedBooks: 1
			}
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
				directory: offer.directory,
				quote,
				base,
				rate,
				volume: 0
			}
		}

		dir.volume = sum(dir.volume, offer.takerGetsValue)
	}

	let sortedDirectories = sort(
		Object.values(directories),
		'rate'
	)

	for(let rank=0; rank<sortedDirectories.length; rank++){
		let dir = sortedDirectories[rank]

		await writeOffer({
			meta,
			ledgerIndex,
			offer: {
				...dir,
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