import log from '@mwni/log'
import { wait } from '@xrplkit/time'
import { sum, gt, sub, toString } from '@xrplkit/xfl/native'
import { storeMetas } from '../../meta/props.js'
import { read as readMetrics, write as writeMetrics } from '../../meta/token/metrics.js'
import { read as readWhales, write as writeWhales } from '../../meta/token/whales.js'


export async function reduce({ state, ledgerIndex, ...ctx }){
	let counter = 0
	let total = await state.trustlines.count({
		distinct: ['currency', 'issuer'],
		where: {
			NOT: {
				change: null
			}
		}
	})

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
		//await extractIssuerMeta({ ...ctx, issuer: token.issuer })
		await updateMetrics({ ...ctx, token, state, ledgerIndex })
		await wait(1)

		log.accumulate.info({
			line: [
				`pulled`,
				++counter,
				`of`,
				total,
				`tokens from state (+%pulledTokens in %time)`
			],
			pulledTokens: 1
		})
	}

	log.flush()
}

async function extractIssuerMeta({ issuer, config, meta, ledger }){
	await storeMetas({
		meta,
		metas: {
			emailHash: issuer.emailHash,
			domain: issuer.domain
			? Buffer.from(issuer.domain, 'hex').toString()
			: undefined
		},
		issuer
	})
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

				let insertWhaleAt = -1

				while(insertWhaleAt < whales.length){
					let whale = whales[insertWhaleAt + 1]

					if(whale && gt(whale.balance, balance))
						break

					insertWhaleAt++
				}

				if(insertWhaleAt !== -1){
					whales = [
						...whales.slice(whales.length >= maxWhales ? 1 : 0, insertWhaleAt),
						{ account: holder, balance },
						...whales.slice(insertWhaleAt)
					]
				}

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

