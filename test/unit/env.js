import { open as openDB } from '../../src/db/index.js'

export function createContext({ debugQueries=false }={}){
	let ctx = {
		config: {
			debug: {
				queries: debugQueries
			}
		}
	}

	return {
		...ctx,
		db: openDB({
			inMemory: true,
			ctx
		})
	}
}