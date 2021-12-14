import { log } from '@xrplmeta/common/lib/log.js'
import { wait, unixNow } from '@xrplmeta/common/lib/time.js'
import { keySort, decimalCompare } from '@xrplmeta/common/lib/data.js'
import { currencyHexToUTF8 } from '@xrplmeta/common/lib/xrpl.js'
import Decimal from '@xrplmeta/common/lib/decimal.js'
import initSnapshot from '../../ledger/snapshot.js'



export default ({repo, config, xrpl, loopLedgerTask}) => {
	loopLedgerTask(
		{
			task: 'snapshot',
			interval: config.ledger.snapshotInterval,
			backfillLedgers: config.ledger.snapshotHistoryLedgers,
			backfillInterval: config.ledger.snapshotHistoryInterval,
		},
		async (index, isBackfill) => {
			let replaceAfter = isBackfill
				? null
				: Math.floor(index / config.ledger.snapshotHistoryInterval) 
					* config.ledger.snapshotHistoryInterval

			log.time(`snapshot`, `starting ${isBackfill ? 'backfill' : 'full'} snapshot of ledger #${index}`)

			let snapshotFile = config.ledger.snapshotProcessInMemory
				? `:memory:`
				: `${config.data.dir}/snapshot.db`


			let snapshot = initSnapshot(snapshotFile)
			let queue = fillQueue(xrpl, index)
			let chunk
			let scanned = 0
			let start = Date.now()

			if(log.level === 'debug')
				snapshot.enableQueryProfiling()

			log.time(`snapshot.record`)

			while(chunk = await queue()){
				log.time(`snapshot.chunk`)

				await snapshot.tx(async () => {
					for(let state of chunk){

						if(state.LedgerEntryType === 'RippleState'){
							let currency = currencyHexToUTF8(state.HighLimit.currency)
							let issuer = state.HighLimit.value === '0' ? state.HighLimit.issuer : state.LowLimit.issuer
							let holder = state.HighLimit.value !== '0' ? state.HighLimit.issuer : state.LowLimit.issuer

							snapshot.balances.insert({
								account: holder,
								trustline: {currency, issuer},
								balance: state.Balance.value.replace(/^-/, '')
							})
						}else if(state.LedgerEntryType === 'AccountRoot'){
							snapshot.accounts.insert({
								address: state.Account,
								emailHash: state.EmailHash || null,
								domain: state.Domain 
									? Buffer.from(state.Domain, 'hex')
										.toString()
										.replace(/^https?:\/\//, '')
										.replace(/\/$/, '')
									: null
							})

							snapshot.balances.insert({
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

							snapshot.offers.insert({
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
				log.time(`snapshot.chunk`, `scanned`, scanned, `entries (chunk took %)`)
			}

			log.time(`snapshot.record`, `took snapshot in %`)
			log.time(`snapshot.compute`, `computing metadata`)

			let accounts = []
			let balances = []
			let stats = []
			let distributions = []
			let liquidity = new Decimal(0)

			let relevantTrustlines = snapshot.iterate(
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
				let lines = snapshot.balances.all({trustline})

				if(lines.length < config.ledger.minTrustlines)
					continue


				let nonZeroBalances = keySort(
					lines.filter(({balance}) => balance !== '0'),
					({balance}) => new Decimal(balance),
					decimalCompare.DESC
				)

				let count = lines.length
				let holders = nonZeroBalances.length
				let bid = new Decimal(0)
				let ask = new Decimal(0)
				let supply = nonZeroBalances
					.reduce((sum, {balance}) => sum.plus(balance), new Decimal(0))

				
				for(let { account, balance } of lines){
					let offers = snapshot.all(
						`SELECT * FROM Offers
						WHERE account = ?
						AND (base = ? OR quote = ?)`,
						account,
						trustline.id,
						trustline.id,
					)

					if(offers.length > 0){
						for(let offer of offers){
							let xrpBalance = snapshot.balances.get({
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
						let { address } = snapshot.accounts.get({id: account})

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



				let stat = {
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
				}

				if(supply.gt('0')){
					for(let percent of config.ledger.topPercenters){
						let group = nonZeroBalances.slice(0, Math.ceil(holders * percent / 100))
						let wealth = group.reduce((sum, {balance}) => sum.plus(balance), new Decimal(0))
						let share = wealth.div(supply).times(100)
						let key = `percent${percent.toString().replace('.', '')}`

						stat[key] = share.toNumber()
					}
				}

				stats.push(stat)
			}
			
			log.time(`snapshot.compute`, `computed metadata in %`)
			log.time(`snapshot.insert`,
				`inserting:`,
				accounts.length, `accounts,`,
				balances.length, `balances,`,
				stats.length, `trustlines,`
			)

			repo.states.insert({
				index,
				accounts: snapshot.accounts.count(),
				trustlines: snapshot.trustlines.count(),
				balances: snapshot.balances.count(),
				offers: snapshot.offers.count(),
				liquidity: liquidity.toString()
			})

			await repo.criticalTx(() => {
				accounts.forEach(x => repo.accounts.insert(x))
				balances.forEach(x => repo.balances.insert(x))
				stats.forEach(x => repo.stats.insert(x))
			})

			log.time(`snapshot.insert`, `inserted rows in %`)

			snapshot.close()

			log.time(`snapshot`, `completed ${isBackfill ? 'backfill' : 'full'} scan of ledger #${index} in %`)
		}
	)
}


function fillQueue(xrpl, index){
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

		log.debug(`ledger data queue: ${queue.length}/3`)

		return queue.shift()
	}

	let n = 0

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

			if(!lastMarker || n++>=2){
				done = true
				break
			}
		}
	})()

	return next
}