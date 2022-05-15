import { fork } from 'nanotasks'
import { EventEmitter } from '@mwni/events'

export default async function({ config, xrpl, log }){
	let events = new EventEmitter

	fork({ func: streamLive, args: { config, xrpl, log, events } })
	fork({ func: streamBackfill, args: { config, xrpl, log, events } })
}


async function streamLive({ config, xrpl, log }){
	
}

async function streamBackfill({ config, xrpl, log }){
	
}