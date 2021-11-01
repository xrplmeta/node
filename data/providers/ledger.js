import { BaseProvider } from './base.js'
import { wait } from '../../common/time.js'
import { log, pretty } from '../../common/logging.js'
import Decimal from '../../common/decimal.js'



export default class extends BaseProvider{
	constructor({repo, nodes, config}){
		super()

		this.repo = repo
		this.nodes = nodes
		this.config = config
		this.log = log.for('ledger', 'cyan')
	}

	async run(){
		while(true){
			let mostRecent = Math.floor(Date.now() / (this.config.scanInterval * 1000)) * this.config.scanInterval
			let next = null

			for(let t=mostRecent; t>=this.config.scanUntil; t-=this.config.scanInterval){
				let operation = await this.repo.getMostRecentOperation({type: 'ledger-scan', subject: `t${t}`})

				if(operation)
					continue


				next = t
				break
			}

			if(!next){
				await wait(1000)
				continue
			}

			await this.repo.recordOperation('ledger-scan', `t${next}`, this.scan(next, next === mostRecent))
		}
	}


	async scan(t, full){
		let ledgerIndex = await this.findLedgerIndexAtTime(t)
		let scanned = 0
		let balances = {}
		let accounts = {}
		let lastMarker

		this.log(`scanning ledger #${ledgerIndex}...`)

		while(true){
			try{
				var result = await this.nodes.request({
					command: 'ledger_data',
					ledger_index: ledgerIndex,
					marker: lastMarker,
					limit: 100000
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
				}
			}

			scanned += result.state.length

			this.log(`scanned ${pretty(scanned)} entries: ${pretty(Object.keys(balances).length)} trustlines`)

			lastMarker = result.marker
			
			//if(!lastMarker)
				break
		}

		this.log(`computing distrubutions`)

		let trustlines = Object.entries(balances)
			.map(([key, balances]) => {
				let [currency, issuer] = key.split(':')
				let count = balances.length
				let holders = balances.filter(balance => balance.value.gt(0))
				let holdersCount = holders.length
				let amount = holders.reduce((sum, balance) => sum.plus(balance.value), new Decimal(0))
				let whales = []
				let distributions = []

				if(count < this.config.minTrustlines)
					return null

				if(!amount.gt(0))
					return null

				holders.sort((a, b) => {
					if(b.value.gt(a.value))
						return 1
					else if(a.value.gt(b.value))
						return -1
					else
						return 0
				})

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
						count,
						amount: amount.toString()
					},
					whales,
					distributions
				}
			})
			.filter(row => row)

		this.log(`writing ${trustlines.length} trustlines to db`)

		await this.repo.setTrustlines(t, trustlines.map(({stat}) => stat))


		if(full){
			this.log(`writing metas, whales & distrubutions to db`)

			await this.repo.setMetas(trustlines.map(({stat}) => ({
				meta: accounts[stat.issuer],
				type: 'issuer',
				subject: stat.issuer,
				source: 'ledger'
			})))

			for(let {stat, whales, distributions} of trustlines){
				await this.repo.setWhales(stat, whales)
				await this.repo.setDistributions(t, stat, distributions)
			}
		}

		this.log(`scan complete`)
	}

	getNextScanTime(){
		let mostRecent = Math.floor(Date.now() / (this.config.scan_interval * 1000)) * this.config.scan_interval
		let next = null

		for(let t=mostRecent; t>=this.config.scanUntil; t-=this.config.scan_interval){
			if(this.repo.hasScannedAtTime(t))
				continue

			next = t
			break
		}

		return next
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