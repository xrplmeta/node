import xrpl from 'xrpl'

const client = new xrpl.Client('ws://node.xrptrader.org:4920', {authorization: 'admin:superad'})


;(async () => {
	await client.connect()

	let total = 0
	let fetches = 0
	let lastMarker = undefined

	while(true){
		let { result } = await client.request({
			command: 'ledger_data',
			ledger_index: 67162805,
			marker: lastMarker,
			limit: 100000
		})

		for(let state of result.state){
			console.log(state)
		}

		lastMarker = result.marker
		total += result.state.length
		fetches++

		console.log(`total: ${total}, fetches: ${fetches}, marker: ${lastMarker}`)

		if(!result.marker)
			break
	}
})()