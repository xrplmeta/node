import { fork } from 'child_process'
import { wait } from '@xrplkit/time'
import log from './log.js'


const signals = []


export async function spawn({task, configPath, xrpl, waitFor}){
	if(waitFor)
		log.info(`task [${task}] will wait for signal "${waitFor}"`)

	while(true){
		if(waitFor && !signals.includes(waitFor)){
			await wait(100)
			continue
		}

		let subprocess = fork(
			process.argv[1], 
			[
				`work`,
				`--config`, configPath,
				`--task`, task,
				`--worker`
			],
			{
				silent: true
			}
		)

		log.subprocess(subprocess)
		xrpl.register(subprocess)
		
		subprocess.stderr.on('data', data => {
			log.error(`subprocess [${task}] error:\n${data.toString()}`)
		})

		subprocess.on('error', error => {
			if(error.code === 'ERR_IPC_CHANNEL_CLOSED')
				return
				
			log.error(`subprocess [${task}] fatal error:`)
		})

		subprocess.on('message', message => {
			if(message.signal){
				signals.push(message.signal)
			}
		})


		log.info(`spawned [${task}]`)

		await new Promise(resolve => {
			subprocess.on('exit', code => {
				xrpl.discard(subprocess)

				if(code){
					log.error(`subprocess [${task}] exited with code ${code}`)
					resolve()
				}else{
					log.info(`subprocess [${task}] finished`)
					return
				}
				
			})
		})

		await wait(3000)
	}
}