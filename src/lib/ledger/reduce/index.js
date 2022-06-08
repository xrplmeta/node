import { reduce as reduceTokens } from './tokens.js'
import { reduce as reduceAccounts } from './accounts.js'
import { reduce as reduceBooks } from './books.js'


export async function reduce({ state, meta, ...ctx }){
	let { ledgerIndex } = await state.journal.readOne({ last: true })

	console.log(ledgerIndex)

	await meta.tx(async () => {
		await reduceTokens({ ...ctx, state, meta, ledgerIndex })
		await reduceAccounts({ ...ctx, state, meta, ledgerIndex })
		await reduceBooks({ ...ctx, state, meta, ledgerIndex })
	})

	await state.tx(async () => {
		for(let table of ['trustlines', 'accounts', 'currencyOffers']){
			await state[table].update({
				data: {
					change: null
				}
			})
		}
	})
}