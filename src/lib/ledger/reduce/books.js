import crypto from 'crypto'
import log from '@mwni/log'


export async function reduce({ state, meta, ledgerIndex, config }){
	let counter = 0
	let offers = await state.currencyOffers.iter({
		include: {
			account: true,
			takerPaysCurrency: true,
			takerPaysIssuer: true,
			takerGetsCurrency: true,
			takerGetsIssuer: true,
		}
	})
	
	for await(let offer of offers){
		let takerPaysToken
		let takerGetsToken
		let xid = crypto.createHash('md5')
			.update(offer.account.address)
			.update(offer.sequence.toString())
			.digest('hex')
			.slice(0, 12)
			.toUpperCase()

		if(offer.takerPaysIssuer){
			takerPaysToken = {
				currency: {
					code: offer.takerPaysCurrency.code
				},
				issuer: {
					address: offer.takerPaysIssuer.address
				}
			}
		}

		if(offer.takerGetsIssuer){
			takerGetsToken = {
				currency: {
					code: offer.takerGetsCurrency.code
				},
				issuer: {
					address: offer.takerGetsIssuer.address
				}
			}
		}

		await meta.tokenOffers.createOne({
			data: {
				xid,
				takerPaysToken,
				takerGetsToken,
				takerPaysValue: offer.takerPaysValue,
				takerGetsValue: offer.takerGetsValue,
				startLedgerIndex: ledgerIndex
			}
		})

		log.accumulate.info({
			line: [
				`pulled`,
				++counter,
				`of`,
				offers.length,
				`currency offers (+%currencyOffers in %time)`
			],
			currencyOffers: 1
		})
	}
}