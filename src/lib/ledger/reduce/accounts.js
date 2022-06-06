import log from '@mwni/log'
import { write as writeProps } from '../../meta/props.js'


export async function reduce({ state, ledgerIndex, ...ctx }){
	let counter = 0
	let accounts = await state.accounts.iter({
		where: {
			NOT: {
				change: null
			}
		}
	})

	for await(let account of accounts){
		await updateAccount({ ...ctx, account, state, ledgerIndex })

		log.accumulate.info({
			line: [
				`pulled`,
				++counter,
				`of`,
				accounts.length,
				`accounts from state (+%pulledAccounts in %time)`
			],
			pulledAccounts: 1
		})
	}

	log.flush()
}

async function updateAccount({ account, state, meta }){
	let issuingTrustlineCount = await state.trustlines.count({
		where: {
			issuer: { id: account.id }
		}
	})

	if(issuingTrustlineCount > 0){
		await writeProps({
			meta,
			props: {
				emailHash: account.emailHash,
				domain: account.domain
				? Buffer.from(account.domain, 'hex').toString()
				: undefined
			},
			source: 'xrpl',
			account
		})
	}
}