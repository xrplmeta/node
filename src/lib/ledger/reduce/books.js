


async function pull({ config, meta, ledger }){
	let ledgerIndex = await getCurrentIndex({ ledger })
	let counter = 0
	let totalCount = await ledger.currencyOffers.count()
	let offers = await ledger.currencyOffers.iter({
		include: {
			account: true,
			takerPaysCurrency: true,
			takerPaysIssuer: true,
			takerGetsCurrency: true,
			takerGetsIssuer: true
		}
	})

	log.info(`got`, totalCount, `currency offers to walk through`)
	
	for await(let offer of offers){
		let takerPaysToken
		let takerGetsToken

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

		await meta.tokenBookOffers.createOne({
			data: {
				book: {
					takerPaysToken,
					takerGetsToken
				},
				account: {
					address: offer.account.address
				},
				sequence: offer.sequence,
				takerPaysValue: offer.takerPaysValue,
				takerGetsValue: offer.takerGetsValue,
				startLedgerIndex: ledgerIndex
			}
		})

		await wait(1)

		log.accumulate.info({
			line: [
				`processed`,
				++counter,
				`of`,
				totalCount,
				`currency offers (+%currencyOffers in %time)`
			],
			currencyOffers: 1
		})
	}
}