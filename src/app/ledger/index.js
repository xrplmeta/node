import log from '@mwni/log'
import { spawn } from 'nanotasks'


export async function spawnApp({ config, xrpl }){
	let ctx = { config, xrpl, log }
	let snapshotTask
	let liveTask
	let backfillTask
	
	return {
		async run(){
			snapshotTask = await spawn('./snapshot.js:spawnTask', ctx)
			await snapshotTask.run()

			//liveTask = await spawn('./live.js:spawn', ctx)
			//backfillTask = await spawn('./backfill.js:spawn', ctx)
		},
		async terminate(){
			if(snapshotTask)
				await snapshotTask.terminate()
		}
	}
}