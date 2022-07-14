import log from '@mwni/log'
import crawlers from './crawlers/index.js'


export async function startCrawlers({ ctx }){
	let active = {}

	for(let { name, start } of crawlers){
		active[name] = start({ ctx })
			.catch(error => {
				log.warn(`skipping crawler [${name}]:`, error.message)
				delete active[name]
			})
	}

	await Promise.resolve()
	await Promise.all(Object.entries(active).map(
		([name, promise]) => {
			log.info(`started crawler [${name}]`)
			return promise
		}
	))
}