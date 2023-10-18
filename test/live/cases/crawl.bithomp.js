import run from '../../../src/crawl/crawlers/bithomp.js'
import { openDB } from '../../../src/db/index.js'


export default async ({ config }) => {
	let ctx = { config }

	Object.assign(ctx, {
		db: await openDB({ ctx })
	})

	await run({ ctx })
}