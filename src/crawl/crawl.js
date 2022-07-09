import log from '@mwni/log'
import crawlers from './crawlers/index.js'


export async function startCrawlers({ ctx }){
	await Promise.all(
		crawlers.map(
			({ name, start }) => start({ ctx })
				.catch(
					error => log.warn(
						`crawler "${name}" encountered fatal error:\n`, 
						error.stack
					)
				)
		)
	)
}