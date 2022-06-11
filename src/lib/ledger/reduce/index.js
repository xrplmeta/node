import { reduce as reduceTokens } from './tokens.js'
import { reduce as reduceBooks } from './books.js'


export async function reduce({ state, meta, ...ctx }){
	let { ledgerIndex } = state.journal.readOne({ last: true })

	meta.tx(() => {
		reduceTokens({ ...ctx, state, meta, ledgerIndex })
		reduceBooks({ ...ctx, state, meta, ledgerIndex })
	})


	await state.tx(async () => {
		for(let table of ['trustlines', 'accounts', 'currencyOffers']){
			await state[table].delete({
				where: {
					change: 'deleted'
				}
			})

			await state[table].update({
				data: {
					change: null
				}
			})
		}
	})
}