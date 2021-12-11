import { log } from '@xrplmeta/common/lib/log.js'
import { wait, unixNow } from '@xrplmeta/common/lib/time.js'
import { keySort, decimalCompare } from '@xrplmeta/common/lib/data.js'
import { currencyHexToUTF8 } from '@xrplmeta/common/lib/xrpl.js'
import Decimal from '@xrplmeta/common/lib/decimal.js'
import initScanDB from '../../ledger/scandb.js'



export default ({repo, config, xrpl, loopLedgerTask}) => {
	loopLedgerTask(
		{
			task: 'ledger.states',
			interval: config.ledger.stateInterval,
			backfillLedgers: config.ledger.stateHistoryLedgers,
			backfillInterval: config.ledger.stateHistoryInterval,
		},
		async (index, isBackfill) => {
			let replaceAfter = isBackfill
				? null
				: Math.floor(index / config.ledger.stateHistoryInterval) 
					* config.ledger.stateHistoryInterval

			log.time(`states.scan`, `starting ${isBackfill ? 'backfill' : 'full'} scan of ledger #${index}`)

			let scandbFile = config.ledger.stateProcessInMemory
				? `:memory:`
				: `${config.data.dir}/scan.db`


			let scandb = initScanDB(scandbFile)
			let queue = fillStateQueue(xrpl, index)
			let chunk
			let scanned = 0
			let start = Date.now()

			if(log.level === 'debug')
				scandb.enableQueryProfiling()

			log.time(`states.collect`)

			while(chunk = await queue()){
				log.time(`states.chunk`)

				await scandb.tx(async () => {
					for(let state of chunk){

						if(state.LedgerEntryType === 'RippleState'){
							let currency = currencyHexToUTF8(state.HighLimit.currency)
							let issuer = state.HighLimit.value === '0' ? state.HighLimit.issuer : state.LowLimit.issuer
							let holder = state.HighLimit.value !== '0' ? state.HighLimit.issuer : state.LowLimit.issuer

							scandb.balances.insert({
								account: holder,
								trustline: {currency, issuer},
								balance: state.Balance.value.replace(/^-/, '')
							})
						}else if(state.LedgerEntryType === 'AccountRoot'){
							scandb.accounts.insert({
								address: state.Account,
								emailHash: state.EmailHash || null,
								domain: state.Domain 
									? Buffer.from(state.Domain, 'hex')
										.toString()
										.replace(/^https?:\/\//, '')
										.replace(/\/$/, '')
									: null
							})

							scandb.balances.insert({
								account: state.Account,
								trustline: null,
								balance: new Decimal(state.Balance)
									.div('1000000')
									.toString()
							})
						}else if(state.LedgerEntryType === 'Offer'){
							let base
							let quote
							let gets
							let pays

							if(typeof state.TakerGets === 'string'){
								base = null
								gets = new Decimal(state.TakerGets)
									.div('1000000')
									.toString()
							}else{
								base = {
									currency: currencyHexToUTF8(state.TakerGets.currency),
									issuer: state.TakerGets.issuer
								}
								gets = state.TakerGets.value
							}

							if(typeof state.TakerPays === 'string'){
								quote = null
								pays = new Decimal(state.TakerPays)
									.div('1000000')
									.toString()
							}else{
								quote = {
									currency: currencyHexToUTF8(state.TakerPays.currency),
									issuer: state.TakerPays.issuer
								}
								pays = state.TakerPays.value
							}

							scandb.offers.insert({
								account: state.Account,
								base,
								quote,
								gets,
								pays
							})
						}
					}
				})
				
				scanned += chunk.length
				log.time(`states.chunk`, `scanned`, scanned, `entries (chunk took %)`)
			}

			log.time(`states.collect`, `collected all ledger states in %`)
			log.time(`states.compute`, `computing metadata`)

			let accounts = []
			let balances = []
			let stats = []
			let distributions = []
			let liquidity = new Decimal(0)

			let relevantTrustlines = scandb.iterate(
				`SELECT 
					Trustlines.id, 
					currency,  
					address as issuer,
					domain as issuerDomain,
					emailHash as issuerEmailHash
				FROM 
					Trustlines 
					INNER JOIN Accounts ON (Accounts.id = Trustlines.issuer)`
			)

			for(let trustline of relevantTrustlines){
				let balances = scandb.balances.all({trustline})

				if(balances.length < config.ledger.minTrustlines)
					continue


				let nonZeroBalances = keySort(
					balances.filter(({balance}) => balance !== '0'),
					({balance}) => new Decimal(balance),
					decimalCompare.DESC
				)

				let count = balances.length
				let holders = nonZeroBalances.length
				let bid = new Decimal(0)
				let ask = new Decimal(0)
				let supply = nonZeroBalances
					.reduce((sum, {balance}) => sum.plus(balance), new Decimal(0))

				
				for(let { account, balance } of balances){
					let offers = scandb.all(
						`SELECT * FROM Offers
						WHERE account = ?
						AND (base = ? OR quote = ?)`,
						account,
						trustline.id,
						trustline.id,
					)

					if(offers.length > 0){
						for(let offer of offers){
							let xrpBalance = scandb.balances.get({
								account, 
								trustline: null
							})

							if(xrpBalance){
								if(offer.quote === null){
									let amount = Decimal.min(offer.pays, xrpBalance.balance)

									bid = bid.plus(amount)
									liquidity = liquidity.plus(amount)
								}else if(offer.base === null){
									let amount = Decimal.min(offer.gets, xrpBalance.balance)

									liquidity = liquidity.plus(amount)
								}
							}

							if(offer.quote === trustline.id){
								ask = ask.plus(Decimal.min(offer.pays, balance))
							}
						}
					}
				}



				if(!isBackfill){
					let whales = nonZeroBalances.slice(0, config.ledger.captureWhales)

					for(let { account, balance } of whales){
						let { address } = scandb.accounts.get({id: account})

						balances.push({
							account: address,
							trustline: {
								currency: trustline.currency,
								issuer: trustline.issuer
							},
							balance
						})
					}

					if(!accounts.some(account => account.address === trustline.issuer)){
						accounts.push({
							address: trustline.issuer,
							domain: trustline.issuerDomain,
							emailHash: trustline.issuerEmailHash
						})
					}
				}

				stats.push({
					ledger: index,
					trustline: {
						currency: trustline.currency,
						issuer: trustline.issuer
					},
					count,
					supply: supply.toString(),
					bid: bid.toString(),
					ask: ask.toString(),
					replaceAfter
				})

				if(supply.gt('0')){
					let percenters = config.ledger.topPercenters
						.map(percent => {
							let group = nonZeroBalances.slice(0, Math.ceil(holders * percent / 100))
							let wealth = group.reduce((sum, {balance}) => sum.plus(balance), new Decimal(0))
							let share = wealth.div(supply).times(100)

							return {
								percent,
								share: share.toNumber()
							}
						})

					distributions.push({
						ledger: index,
						trustline: {
							currency: trustline.currency,
							issuer: trustline.issuer
						},
						percenters,
						replaceAfter
					})
				}
			}
			
			log.time(`states.compute`, `computed metadata in %`)
			log.time(`states.insert`,
				`inserting:`,
				accounts.length, `accounts,`,
				balances.length, `balances,`,
				stats.length, `trustlines,`,
				distributions.length, `distributions`
			)

			repo.states.insert({
				index,
				accounts: scandb.accounts.count(),
				trustlines: scandb.trustlines.count(),
				balances: scandb.balances.count(),
				offers: scandb.offers.count(),
				liquidity: liquidity.toString()
			})

			await repo.criticalTx(() => {
				accounts.forEach(x => repo.accounts.insert(x))
				balances.forEach(x => repo.balances.insert(x))
				stats.forEach(x => repo.stats.insert(x))
				distributions.forEach(x => repo.distributions.insert(x))
			})

			log.time(`states.insert`, `inserted rows in %`)

			scandb.close()

			log.time(`states.scan`, `completed ${isBackfill ? 'backfill' : 'full'} scan of ledger #${index} in %`)
		}
	)
}


function fillStateQueue(xrpl, index){
	let chunkSize = 100000
	let ledgerData
	let lastMarker
	let queue = []
	let done = false
	let next = async () => {
		while(queue.length === 0)
			if(done)
				return null
			else
				await wait(100)

		log.info(`ledger data queue: ${queue.length}/3`)

		return queue.shift()
	}

	;(async () => {
		while(true){
			while(queue.length >= chunkSize * 3)
				await wait(100)

			try{
				ledgerData = await xrpl.request({
					command: 'ledger_data',
					ledger_index: index,
					marker: lastMarker,
					limit: 100000,
					priority: 100
				})
			}catch(e){
				log.info(`could not obtain ledger data:\n`, e)
				await wait(1000)
				continue
			}

			queue.push(ledgerData.state)
			lastMarker = ledgerData.marker

			if(!lastMarker){
				done = true
				break
			}
		}
	})()

	return next
}