import { get as getSnapshot, fork as forkSnapshot, createCheckpoint } from '../../snapshot/index.js'


export const name = 'ledger.snapshot'

export async function skip(ctx){
	return ctx.args.only && !ctx.args.only.includes(name)
}

export async function start(ctx){
	let snapshot = getSnapshot({ id: 'live', ctx })

	if(snapshot.incomplete){
		await spawn({
			path: ':createCheckpoint',
			args: [ctx]
		})

		await forkSnapshot()
	}

	let live = await spawn({
		path: 
	})
}

export { createCheckpoint }