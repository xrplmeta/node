import crypto from 'crypto'
import log from '@mwni/log'
import { div, sum, toString } from '@xrplkit/xfl/native'
import { sort } from '@xrplkit/xfl/extras'
import { write as writeOffer } from '../../meta/token/offers.js'

export function reduce({ state, meta, ledgerIndex, ...ctx }){
	let counter = 0
	let books = state.currencyOffers.readMany({
		distinct: ['book'],
		where: {
			NOT: {
				change: null
			}
		}
	})

	for(let { book } of books){
		updateBook({ ...ctx, bookId: book.id, state, meta, ledgerIndex })
		
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