import { fork } from 'child_process'
import { wait } from '@xrplworks/time'
import log from './log.js'

const registry = []


export async function spawn({task, configPath, xrpl}){
	while(true){
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
			if(message.type === 'kill'){
				for(let { task, process } of registry){
					if(task === message.task){
						process.kill()
					}
				}
			}
		})

		registry.push({
			task,
			process: subprocess
		})

		log.info(`spawned [${task}]`)

		await new Promise(resolve => {
			subprocess.on('exit', code => {
				log.error(`subprocess [${task}] exited with code ${code}`)
				xrpl.discard(subprocess)
				registry.splice(registry.findIndex(r => r.process === subprocess), 1)
				resolve()
			})
		})

		await wait(3000)
	}
}