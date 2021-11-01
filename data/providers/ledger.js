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
		this.log = log.for({name: 'ledger', color: 'cyan'})
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
		let trustlines = {}
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
					let key = `${currency}:${issuer}`

					if(!trustlines[key])
						trustlines[key] = {count: 0, issued: new Decimal(0)}

					trustlines[key].count++
					trustlines[key].issued = trustlines[key].issued.plus(new Decimal(state.Balance.value).abs())
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

			this.log(`scanned ${pretty(scanned)} entries: ${pretty(Object.keys(trustlines).length)} trustlines`)

			lastMarker = result.marker
			
			if(!lastMarker)
				break
		}

		let trustlineRows = Object.entries(trustlines)
			.map(([key, {count, issued}]) => {
				if(count < this.config.minTrustlines || issued.valueOf() === 0){
					return null
				}

				let [currency, issuer] = key.split(':')

				return {
					currency,
					issuer,
					count,
					issued: issued.toString()
				}
			})
			.filter(row => row)

		this.log(`writing ${trustlineRows.length} trustlines to db`)

		await this.repo.setTrustlines(t, trustlineRows)


		if(full){
			await this.repo.setMetas(trustlineRows.map(row => ({
				meta: accounts[row.issuer],
				type: 'issuer',
				subject: row.issuer,
				source: 'ledger'
			})))
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