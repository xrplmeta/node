import { openDB } from '../../src/db/index.js'

export async function createContext({ debugQueries=false }={}){
	let ctx = {
		config: {
			debug: {
				queries: debugQueries
			}
		}
	}

	return {
		...ctx,
		db: await openDB({
			inMemory: true,
			ctx
		})
	}
}