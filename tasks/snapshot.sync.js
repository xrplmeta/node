import log from '../lib/log.js'
import { unixNow, wait } from '@xrplworks/time'
import Snapshot from '../snapshot/model.js'
import Checkpoint from '../snapshot/checkpoint.js'

export const spec = {
	id: 'snapshot.sync'
}


export async function run({ xrpl, config }){
	let snapshot = new Snapshot(`${config.data.dir}/live.db`)
	let checkpoint = new Checkpoint({ snapshot, xrpl, config })
	
	await checkpoint.create()
}
