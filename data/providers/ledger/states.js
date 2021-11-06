import { BaseProvider } from '../base.js'
import { wait, unixNow } from '../../../common/time.js'
import { pretty } from '../../lib/logging.js'
import { keySort, decimalCompare } from '../../../common/data.js'
import Decimal from '../../../common/decimal.js'



export default class extends BaseProvider{
	constructor({repo, nodes, config}){
		super('ledger.states')

		this.repo = repo
		this.nodes = nodes
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

			await this.repo.operations.record(
				'ledger.states', 
				`t${next}`, 
				this.scan(next, full, historyHead)
			)
		}
	}


	async scan(t, full, lastHistory){
		let ledgerIndex = await this.findLedgerIndexAtTime(t)
		let scanned = 0
		let books = {}
		let balances = {}
		let accounts = {}
		let lastMarker

		this.log(`scanning ledger #${ledgerIndex} (${new Date(t*1000).toISOString()})`)

		while(true){
			try{
				var result = await this.nodes.request({
					command: 'ledger_data',
					ledger_index: ledgerIndex,
					marker: lastMarker,
					limit: 100000,
					priority: 100
				})
			}catch(error){
				this.log(`could not fetch ledger data: ${error.toString()}`)
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
								domain: state.Domain ? Buffer.from(state.Domain, 'hex').toString() : undefined,
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

			this.log(`scanned ${pretty(scanned)} entries: ${pretty(Object.keys(balances).length)} trustlines`)

			lastMarker = result.marker
			
			if(!lastMarker)
				break
		}

		this.log(`computing distrubutions & liquidities`)

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



		this.log(`writing ${trustlines.length} trustline stats to db`)

		await this.repo.stats.set(
			t, 
			trustlines.map(({stat}) => stat), 
			full ? lastHistory : null
		)


		if(full){
			this.log(`writing metas, whales & distrubutions to db`)

			await this.repo.metas.set(trustlines.map(({stat}) => ({
				meta: accounts[stat.issuer],
				type: 'issuer',
				subject: stat.issuer,
				source: 'ledger'
			})))

			for(let {stat, whales, distributions} of trustlines){
				await this.repo.whales.set(stat, whales)
				await this.repo.distributions.set(t, stat, distributions)
			}
		}

		this.log(`scan complete`)
	}

	async findLedgerIndexAtTime(t){
		let index = undefined

		while(true){
			let result = await this.nodes.request({
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
	}
}