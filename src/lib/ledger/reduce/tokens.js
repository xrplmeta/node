import log from '@mwni/log'
import { sum, gt, sub } from '@xrplkit/xfl/native'
import { read as readMetrics, write as writeMetrics } from '../../meta/token/metrics.js'
import { read as readWhales, write as writeWhales } from '../../meta/token/whales.js'


export async function reduce({ state, ledgerIndex, ...ctx }){
	let counter = 0
	let tokens = await state.trustlines.iter({
		distinct: ['currency', 'issuer'],
		include: {
			currency: true,
			issuer: true,
			account: true
		},
		where: {
			NOT: {
				change: null
			}
		}
	})

	for await(let token of tokens){
		await updateMetrics({ ...ctx, token, state, ledgerIndex })

		log.accumulate.info({
			line: [
				`pulled`,
				++counter,
				`of`,
				tokens.length,
				`tokens from state (+%pulledTokens in %time)`
			],
			pulledTokens: 1
		})
	}

	log.flush()
}


async function updateMetrics({ token, meta, state, ledgerIndex, config }){
	let { currency, issuer } = token
	let maxWhales = config.ledger.tokens.captureWhales
	let ignoreBelowTrustlines = config.ledger.tokens.ignoreBelowTrustlines

	let metrics = {
		trustlines: await state.trustlines.count({
			where: {
				currency: { 
					code: currency.code 
				},
				issuer: { 
					address: issuer.address 
				},
			}
		}),
		holders: await state.trustlines.count({
			where: {
				currency: { 
					code: currency.code 
				},
				issuer: { 
					address: issuer.address 
				},
				NOT: {
					balance: 0
				}
			}
		}),
		supply: 0,
		...await readMetrics({ 
			meta,
			ledgerIndex,
			supply: true
		})
	}

	if(metrics.holders === 0 && metrics.trustlines < ignoreBelowTrustlines){
		await meta.tokens.delete({
			where: {
				currency: { code: currency.code },
				issuer: { address: issuer.address },
			}
		})
		return
	}

	let { id: tokenId } = await meta.tokens.createOne({
		data: {
			currency: { code: currency.code },
			issuer: { address: issuer.address },
		}
	})

	let whales = await readWhales({
		meta,
		ledgerIndex,
		token: { id: tokenId }
	})

	let trustlines = await state.trustlines.iter({
		where: {
			NOT: {
				change: null
			},
			currency: { 
				code: currency.code 
			},
			issuer: { 
				address: issuer.address 
			},
		},
		include: {
			holder: true
		}
	})

	await state.tx(async () => {
		for await(let { id: trustlineId, holder, balance, change } of trustlines){
			whales = whales
				.filter(whale => whale.account.address !== holder.address)

			if(change === 'deleted'){
				metrics.supply = sub(metrics.supply, balance)
				metrics.trustlines--
				metrics.holders--

				await state.trustlines.delete({
					where: {
						id: trustlineId
					}
				})
			}else{
				metrics.supply = sum(metrics.supply, balance)

				let whale = { account: holder, balance }
				let greaterWhaleIndex = whales
					.findIndex(whale => gt(whale.balance, balance))


				if(greaterWhaleIndex === -1){
					whales.push(whale)
				}else if(greaterWhaleIndex === 0){
					if(whales.length < maxWhales)
						whales.unshift(whale)
				}else{
					whales.splice(greaterWhaleIndex, 0, whale)
				}

				if(whales.length > maxWhales)
					whales.shift()


				/*await state.trustlines.update({
					data: {
						change: null
					},
					where: {
						id: trustlineId
					}
				})*/
			}
		}

		await writeMetrics({
			meta,
			token: { id: tokenId },
			ledgerIndex,
			...metrics
		})

		

		await writeWhales({
			meta,
			token: { id: tokenId },
			ledgerIndex,
			whales
		})
	})
}

