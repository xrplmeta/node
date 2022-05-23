import log from '@mwni/log'


export async function create({ config, ledger }){
	let state = await ledger.getState()

	log.info(`creating checkpoint at ledger #${state.ledgerIndex}`)

	let issuedCurrencies = []

	for(let side of ['low', 'high']){
		let accountKey = `${side}Account`
		let issuerKey = `${side}Issuer`

		let partIssuedCurrencies = await ledger.rippleStates.readMany({
			include: {
				currency: true,
				[accountKey]: true,
			},
			where: {
				[issuerKey]: true,
			},
			distinct: ['currency', accountKey]
		})

		for(let row of partIssuedCurrencies){
			let currency = row.currency.code
			let issuer = row[accountKey].address

			if(issuedCurrencies.some(ic => ic.currency === currency || ic.issuer === issuer))
				continue

			issuedCurrencies.push({ currency, issuer })
		}
	}
	
	log.info(`got`, issuedCurrencies.length, `issued currencies to walk through`)

	for(let issuedCurrency of issuedCurrencies){
		await processIssuedCurrency({ issuedCurrency, config, ledger })
	}
}


async function processIssuedCurrency({ issuedCurrency, config, ledger }){
	let { currency, issuer } = issuedCurrency

	let rippleStates = await ledger.rippleStates.iter({
		where: {
			OR: [
				{
					currency: { code: currency },
					lowAccount: { address: issuer },
					lowIssuer: true
				},
				{
					currency: { code: currency },
					highAccount: { address: issuer },
					highIssuer: true
				}
			]
		},
		include: {
			lowAccount: true,
			highAccount: true
		}
	})

	for await(let rippleState of rippleStates){
		console.log(rippleState)
	}

	
}