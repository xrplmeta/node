import { reduce as reduceTokens } from './tokens.js'
import { reduce as reduceAccounts } from './accounts.js'
import { reduce as reduceBooks } from './books.js'


export async function reduce({ state, ...ctx }){
	let { ledgerIndex } = await state.journal.readOne({ last: true })

	await reduceTokens({ ...ctx, state, ledgerIndex })
	await reduceAccounts({ ...ctx, state, ledgerIndex })
	await reduceBooks({ ...ctx, state, ledgerIndex })
}