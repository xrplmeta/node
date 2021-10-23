import xrpl from 'xrpl'
import { wait, log } from '../shared/utils.js'



export default class{
	constructor({repo, node}){
		this.repo = repo
		this.client = new xrpl.Client(node)
		this.log = log.for({name: 'discovery', color: 'cyan'})
		this.nodeAddress = node
	}

	async start(interval){
		while(true){
			await wait(1000)

			if(!await this.repo.isOperationDue('discovery', '*', interval))
				continue

			await this.repo.recordOperation('discovery', '*', this.run())
		}
	}

	async run(){
		await this.ensureConnected()

		let ledgerIndex = await this.client.getLedgerIndex()
		let scanned = 0
		let trustlines = {}
		let lastMarker

		this.log(`scanning ledger #${ledgerIndex}...`)

		while(true){
			let { result } = await this.client.request({
				command: 'ledger_data',
				ledger_index: ledgerIndex,
				marker: lastMarker,
				limit: 100000
			})

			for(let state of result.state){
				if(state.LedgerEntryType === 'RippleState'){
					let currency = state.HighLimit.currency
					let issuer = state.HighLimit.value === '0' ? state.HighLimit.issuer : state.LowLimit.issuer
					let key = `${currency}:${issuer}`

					if(!trustlines[key])
						trustlines[key] = 0

					trustlines[key]++
				}
			}

			scanned += result.state.length

			this.log(`scanned ${scanned.toLocaleString('en-US')} entries: ${Object.keys(trustlines).length.toLocaleString('en-US')} trustlines`)

			lastMarker = result.marker
			
			if(!lastMarker)
				break
		}

		this.log(`completed discovery scan, writing results to db...`)

		for(let [key, count] of Object.entries(trustlines)){
			if(count < 2)
				continue

			let [currency, issuer] = key.split(':')

			await this.repo.registerTrustline({currency, issuer, holders: count})
		}

		this.log(`discovery complete`)
	}

	async ensureConnected(){
		if(this.client.isConnected())
			return

		this.log(`connecting to ${this.nodeAddress}...`)
		await this.client.connect()
		this.log(`connection established`)
	}
}