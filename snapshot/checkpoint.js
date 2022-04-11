import log from '../lib/log.js'
import Snapshot from './model/index.js'
import Capture from './capture.js'


export async function run({ config, xrpl }){
	let snapshot = new Snapshot(`${config.data.dir}/live.db`)

	if(!await snapshot.isEmpty()){
		log.info(`no checkpoint to be made - exiting gracefully`)
		process.exit(0)
	}

	let { ledger: {ledger_index: ledgerIndex} } = await xrpl.request({
		command: 'ledger', 
		ledger_index: 'validated'
	})

	let capture = new Capture({ config, xrpl, ledgerIndex })

	log.info(`capturing checkpoint at ledger #${ledgerIndex} - this may take a long time`)

	while(capture.ongoing){
		let batch = capture.queue.splice(0, 100000)

		await snapshot.tx(async () => {
			for(let state of batch){
				snapshot.add(state)
			}
		})
	}
}
