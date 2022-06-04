import { reduce as reduceTokens } from './tokens.js'


export async function reduce({ state, ...ctx }){
	let { ledgerIndex } = await state.journal.readOne({ last: true })

	await reduceTokens({ ...ctx, state, ledgerIndex })
	//await walkBooks(ctx)
}