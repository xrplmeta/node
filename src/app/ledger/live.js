import log from '@mwni/log'

export async function run(ctx){
	if(ctx.log)
		log.pipe(ctx.log)

	
}