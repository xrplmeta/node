import { fork } from 'nanotasks'
import { EventEmitter } from '@mwni/events'

export default async function({ ctx, log }){
	fork({ func: streamLive, args: { ctx, log: log.branch({name: 'live'}) } })
	fork({ func: streamBackfill, args: { ctx, log: log.branch({name: 'backfill'}) } })

	ctx.events.on('works', () => console.log('good'))
}


export async function streamLive({ ctx, log }){
	ctx.events.emit('works')
}

export async function streamBackfill({ ctx, log }){
	ctx.events.on('works', () => console.log('perfection'))
}