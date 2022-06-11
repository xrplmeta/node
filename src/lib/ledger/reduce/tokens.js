import log from '@mwni/log'
import { sum, gt, sub } from '@xrplkit/xfl/native'
import { read as readMetrics, write as writeMetrics } from '../../meta/token/metrics.js'
import { read as readWhales, write as writeWhales } from '../../meta/token/whales.js'
import { write as writeProps } from '../../meta/props.js'
import { detect as detectLegacyNFT } from '../../meta/legacy-nft/detection.js'


export function reduce({ state, ledgerIndex, ...ctx }){
	let counter = 0
	let tokens = state.trustlines.readMany({
		distinct: ['token'],
		where: {
			NOT: {
				change: null
			}
		}
	})

	for(let { token } of tokens.reverse()){
		updateMetrics({ ...ctx, tokenId: token.id, state, ledgerIndex })

		log.accumulate.info({
			text: [
				`reduced`,
				++counter,
				`of`,
				tokens.length,
				`tokens from ledger state (+%reducedTokens in %time)`
			],
			data: {
				reducedTokens: 1
			}
		})
	}
}


function updateMetrics({ tokenId, meta, state, ledgerIndex, config }){
	let { currency, issuer } = state.tokens.readOne({
		where: {
			id: tokenId
		},
		include: {
			issuer: true
		}
	})

	let maxWhales = config.ledger.tokens.captureWhales
	let ignoreBelowTrustlines = config.ledger.tokens.ignoreBelowTrustlines

	let metrics = {
		trustlines: state.trustlines.count({
			where: {
				token: {
					id: tokenId
				}
			}
		}),
		holders: state.trustlines.count({
			where: {
				token: {
					id: tokenId
				},
				NOT: {
					balance: 0
				}
			}
		}),
		supply: 0,
		...readMetrics({ 
			meta,
			ledgerIndex,
			supply: true
		})
	}

	let { id } = meta.tokens.createOne({
		data: {
			currency,
			issuer: { address: issuer.address },
		}
	})
	
	let whales = readWhales({
		meta,
		ledgerIndex,
		token: { id }
	})
	
	let trustlines = state.trustlines.readMany({
		where: {
			token: {
				id: tokenId
			},
			NOT: {
				change: null
			},
		},
		include: {
			account: true
		}
	})
	
	for(let { id: trustlineId, account, balance, change } of trustlines){
		whales = whales
			.filter(whale => whale.account.address !== account.address)

		if(change === 'deleted'){
			metrics.supply = sub(metrics.supply, balance)
			metrics.trustlines--
			metrics.holders--

			state.trustlines.delete({
				where: {
					id: trustlineId
				}
			})
		}else{
			metrics.supply = sum(metrics.supply, balance)

			let whale = { account, balance }
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
		}
	}

	if()

	if(metrics.holders === 0 && metrics.trustlines < ignoreBelowTrustlines){
		meta.tokens.delete({
			where: {
				currency,
				issuer: { address: issuer.address },
			}
		})
		return
	}
	
	writeMetrics({
		meta,
		token: { id },
		ledgerIndex,
		...metrics
	})
	
	writeWhales({
		meta,
		token: { id },
		ledgerIndex,
		whales
	})

	if(issuer.change){
		updateIssuer({ account: issuer, state, meta })
	}
}

async function updateIssuer({ account, state, meta }){
	writeProps({
		meta,
		props: {
			blackholed: account.blackholed,
			emailHash: account.emailHash,
			domain: account.domain
				? Buffer.from(account.domain, 'hex').toString()
				: undefined
		},
		source: 'xrpl',
		account: { address: account.address }
	})
}