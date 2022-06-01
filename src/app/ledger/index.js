import log from '@mwni/log'
import { spawn } from 'nanotasks'


export async function run({ config, xrpl }){
	let ctx = { config, xrpl, log }
	
	await spawn('./snapshot.js:run', ctx)
	
	await Promise.all([
		spawn('./live.js:run', ctx),
		spawn('./backfill.js:run', ctx)
	])
}