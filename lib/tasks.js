import { fork } from 'child_process'
import { wait } from '@xrplworks/time'
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
				`--task`, task
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
			log.error(`subprocess [${task}] fatal error:`)
			log.error(error)
		})

		subprocess.on('message', message => {
			if(message.signal){
				signals.push(message.signal)
			}
		})


		log.info(`spawned [${task}]`)

		await new Promise(resolve => {
			subprocess.on('exit', code => {
				log.error(`subprocess [${task}] exited with code ${code}`)
				xrpl.discard(subprocess)
				resolve()
			})
		})

		await wait(3000)
	}
}