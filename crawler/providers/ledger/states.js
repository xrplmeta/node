import { log } from '../../../common/lib/log.js'
import { wait, unixNow } from '../../../common/lib/time.js'
import { keySort, decimalCompare } from '../../../common/lib/data.js'
import { currencyHexToUTF8 } from '../../../common/lib/xrpl.js'
import Decimal from '../../../common/lib/decimal.js'
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

			log.info(`starting ${isBackfill ? 'backfill' : 'full'} scan of ledger #${index}`)

			let scandbFile = config.ledger.stateProcessInMemory
				? `:memory:`
				: `${config.data.dir}/scan.db`

			let scandb = initScanDB(scandbFile)
			let queue = fillStateQueue(xrpl, index)
			let scanned = 0

			while(!queue.done){
				let chunk = await queue.next()

				await scandb.tx(async () => {
					for(let state of chunk){
						if(state.LedgerEntryType === 'RippleState'){
							let currency = currencyHexToUTF8(state.HighLimit.currency)
							let issuer = state.HighLimit.value === '0' ? state.HighLimit.issuer : state.LowLimit.issuer
							let holder = state.HighLimit.value !== '0' ? state.HighLimit.issuer : state.LowLimit.issuer

							scandb.balances.insert({
								account: holder,
								trustline: {currency, issuer},
								balance: state.Balance.value.replace('-', '')
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
				log.info(`scanned`, scanned, `entries`)
			}

			log.info(`computing and inserting metadata`)

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
				let nonZeroBalances = keySort(
					balances.filter(({balance}) => balance !== '0'),
					({balance}) => new Decimal(balance),
					decimalCompare.DESC
				)

				if(nonZeroBalances.length < config.ledger.minTrustlines)
					continue

				let count = balances.length
				let holders = nonZeroBalances.length
				let bid = new Decimal(0)
				let ask = new Decimal(0)
				let supply = nonZeroBalances
					.reduce((sum, {balance}) => sum.plus(balance), new Decimal(0))

				let distributions = config.ledger.topPercenters
					.map(percent => {
						let group = nonZeroBalances.slice(0, Math.ceil(holders * percent / 100))
						let wealth = group.reduce((sum, {balance}) => sum.plus(balance), new Decimal(0))
						let share = wealth.div(supply).times(100)

						return {
							percent,
							share: share.valueOf()
						}
					})
				
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
							if(offer.quote === trustline.id){
								ask = ask.plus(Decimal.min(offer.pays, balance))
							}else if(offer.quote === null){
								let { balance: xrp } = scandb.balances.get({
									account, 
									trustline: null
								})

								bid = bid.plus(Decimal.min(offer.pays, xrp))
							}
						}
					}
				}

				if(!isBackfill){
					let whales = nonZeroBalances.slice(0, config.ledger.captureWhales)

					for(let { account, balance } of whales){
						let { address } = scandb.accounts.get({id: account})

						repo.balances.insert({
							account: address,
							trustline: {
								currency: trustline.currency,
								issuer: trustline.issuer
							},
							balance
						})
					}

					repo.accounts.insert({
						address: trustline.issuer,
						domain: trustline.issuerDomain,
						emailHash: trustline.issuerEmailHash
					})
				}

				repo.stats.insert({
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

				repo.distributions.insert({
					ledger: index,
					trustline: {
						currency: trustline.currency,
						issuer: trustline.issuer
					},
					percenters: distributions,
					replaceAfter
				})
			}

			log.info(`complete`)
		}
	)
}


function fillStateQueue(xrpl, index){
	let chunkSize = 100000
	let ledgerData
	let lastMarker
	let queue = []
	let handle = {
		done: false,
		next: async () => {
			while(queue.length === 0)
				await wait(100)

			return queue.shift()
		}
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

			if(!lastMarker)
				break
		}
	})()

	return handle
}

/*
export default class extends LedgerProvider{
	constructor({repo, xrpl, config}){
		super({
			interval: this.config.stateInterval
		})

		this.repo = repo
		this.xrpl = xrpl
		this.config = config.ledger
	}

	async run(){
		while(true){
			let now = unixNow()
			let liveHead = Math.floor(now / this.config.scanInterval) * this.config.scanInterval
			let historyHead = Math.floor(now / this.config.historyGrid) * this.config.historyGrid
			let full = false
			let next


			if(!await this.repo.operations.hasCompleted('ledger.states', `t${liveHead}`)){
				next = liveHead
				full = true
			}else{
				for(let t=historyHead; t>=0; t-=this.config.historyGrid){
					if(!await this.repo.operations.hasCompleted('ledger.states', `t${t}`)){
						next = t
						break
					}
				}
			}

			if(!next){
				await wait(1000)
				continue
			}

			try{
				var ledgerIndex = await this.findLedgerIndexAtTime(next)
			}catch(e){
				log.error(`could not get ledger index for time ${next}:`)
				log.error(e)
				await wait(3000)
				continue
			}


			await this.repo.operations.record(
				'ledger.states', 
				`t${next}`, 
				this.scan(next, ledgerIndex, full, historyHead)
			)
		}
	}


	async scan(t, ledgerIndex, full, lastHistory){
		let scanned = 0
		let books = {}
		let balances = {}
		let accounts = {}
		let lastMarker

		log.info(`scanning ledger #${ledgerIndex} (${new Date(t*1000).toISOString()})`)

		while(true){
			let result

			try{
				result = await this.xrpl.request({
					command: 'ledger_data',
					ledger_index: ledgerIndex,
					marker: lastMarker,
					limit: 100000,
					priority: 100
				})
			}catch(error){
				log.error(`could not fetch ledger data:`)
				log.error(error)
				await wait(1000)
				continue
			}

			for(let state of result.state){
				if(state.LedgerEntryType === 'RippleState'){
					let currency = state.HighLimit.currency
					let issuer = state.HighLimit.value === '0' ? state.HighLimit.issuer : state.LowLimit.issuer
					let holder = state.HighLimit.value !== '0' ? state.HighLimit.issuer : state.LowLimit.issuer
					let key = `${currency}:${issuer}`

					if(!balances[key])
						balances[key] = []

					balances[key].push({
						address: holder, 
						value: new Decimal(state.Balance.value).abs()
					})
				}else if(state.LedgerEntryType === 'AccountRoot'){
					if(full){
						if(state.Domain || state.EmailHash){
							accounts[state.Account] = {
								domain: state.Domain 
									? Buffer.from(state.Domain, 'hex')
										.toString()
										.replace(/^https?:\/\//, '')
										.replace(/\/$/, '')
									: undefined,
								emailHash: state.EmailHash
							}
						}
					}
				}else if(state.LedgerEntryType === 'Offer'){
					let currency
					let issuer
					let buy
					let sell

					if(typeof state.TakerGets === 'string'){
						currency = state.TakerPays.currency
						issuer = state.TakerPays.issuer
						sell = new Decimal(state.TakerGets).div('1000000')
					}else if(typeof state.TakerPays === 'string'){
						currency = state.TakerGets.currency
						issuer = state.TakerGets.issuer
						buy = new Decimal(state.TakerPays).div('1000000')
					}else{
						//non XRP pairs not yet supported
						continue
					}

					let key = `${currency}:${issuer}`

					if(!books[key])
						books[key] = {
							buy: new Decimal(0), 
							sell: new Decimal(0)
						}

					if(buy)
						books[key].buy = books[key].buy.plus(buy)
					else if(sell)
						books[key].sell = books[key].sell.plus(sell)
				}
			}

			scanned += result.state.length

			log.info(`scanned`, scanned, `entries:`, Object.keys(balances).length, `trustlines`)

			lastMarker = result.marker
			result = null
			
			if(!lastMarker)
				break
		}

		log.info(`computing distrubutions & liquidities`)

		let trustlines = Object.entries(balances)
			.map(([key, balances]) => {
				let [currency, issuer] = key.split(':')
				let count = balances.length
				let holders = balances.filter(balance => balance.value.gt(0))
				let holdersCount = holders.length
				let amount = holders.reduce((sum, balance) => sum.plus(balance.value), new Decimal(0))
				let whales = []
				let distributions = []
				let liquidity = books[key]

				if(count < this.config.minTrustlines)
					return null

				if(!amount.gt(0))
					return null

				holders = keySort(holders, holder => holder.value, decimalCompare)
					.reverse()

				whales = holders
					.slice(0, this.config.captureWhales)
					.map(balance => ({
						address: balance.address,
						balance: balance.value.toString()
					}))
				
				distributions = this.config.topPercenters
					.map(percent => {
						let group = holders.slice(0, Math.ceil(holdersCount * percent / 100))
						let wealth = group.reduce((sum, balance) => sum.plus(balance.value), new Decimal(0))
						let share = wealth.div(amount).times(100)

						return {
							percent,
							share: share.valueOf()
						}
					})


				return {
					stat: {
						currency,
						issuer,
						accounts: count,
						supply: amount.toString(),
						buy: liquidity ? liquidity.buy.toString() : '0',
						sell: liquidity ? liquidity.sell.toString() : '0',
					},
					whales,
					distributions
				}
			})
			.filter(row => row)


		await this.repo.db.tx(async () => {
			log.info(`writing ${trustlines.length} trustline stats to db`)

			await this.repo.stats.set(
				t, 
				trustlines.map(({stat}) => stat), 
				full ? lastHistory : null
			)


			if(full){
				log.info(`writing metas, whales & distrubutions to db`)

				await this.repo.metas.set(trustlines.map(({stat}) => ({
					meta: accounts[stat.issuer],
					type: 'issuer',
					subject: stat.issuer,
					source: 'ledger'
				})))

				for(let {stat, whales, distributions} of trustlines){
					await this.repo.whales.set(stat, whales)
					await this.repo.distributions.set(
						t, 
						stat, 
						distributions, 
						full ? lastHistory : null
					)
				}
			}
		})

		log.info(`scan complete`)
	}

	async findLedgerIndexAtTime(t){
		let index = undefined
		let attempts = 20

		while(attempts --> 0){
			let result = await this.xrpl.request({
				command: 'ledger',
				ledger_index: index
			})
			let ledger = result.ledger || result.closed.ledger
			let lt = Date.parse(ledger.close_time_human)/1000
			let diff = t - lt
			let stride = Math.floor(diff / 4)

			if(stride === 0)
				return index

			if(!index)
				index = parseInt(ledger.ledger_index)

			index += stride
		}

		throw 'took too long'
	}
}
*/