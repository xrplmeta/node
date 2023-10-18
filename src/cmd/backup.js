import log from '@mwni/log'
import { openDB } from '../db/index.js'


export default async function({ config, destinationFile }){
	let { database } = await openDB({ ctx: { config } })
	
	try{
		await database.backup({
			lockDatabase: true,
			destinationFile,
			progress: v => log.info(`backup progress: ${Math.round(v * 10000)/100} %`)
		})
	}catch(error){
		log.info(`backup failed:\n`, error)
		return
	}

	log.info(`backup finished sucessfully`)
}