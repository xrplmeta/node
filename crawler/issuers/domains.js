import { createFetch } from '../../lib/http.js'
import { parse as parseXLS26 } from '../../lib/xls26.js'
import log from '../../lib/log.js'
import { scheduleTimeRoutine } from '../routine.js'
import { accumulate as accumulateUpdates } from '../../lib/status.js'


export function willRun(config){
	return !!config.domains
}

export function run({ config, repo }){
	let fetch = createFetch({
		timeout: 5,
		headers: {
			'user-agent': config.domains.user_agent ||
				'XRPL-Meta-Crawler (https://xrplmeta.org)'
		}
	})

	scheduleTimeRoutine({
		id: 'domains',
		interval: config.domains.refreshInterval,
		forEvery: 'account',
		routine: async (t, accountId) => {
			let { address, domain } = await repo.accounts.get({id: accountId})
			let xls26
			let metas = []
			
			if(!domain)
				return

			let tomlUrl = `http://${domain}/.well-known/xrp-ledger.toml`

			accumulateUpdates({'% xrp-ledger.toml lookups': 1})

			try{
				let { status, data } = await fetch(tomlUrl)
				
				if(status !== 200){
					log.debug(`issuer (${address}) HTTP ${status}: ${tomlUrl}`)
					return
				}

				xls26 = parseXLS26(data)
			}catch(error){
				log.debug(`issuer (${address}) ${error.message}: ${tomlUrl}`)
				return
			}

			for(let { address: addr, ...meta } of xls26.issuers){
				if(addr !== address)
					continue

				metas.push({
					meta,
					account: address,
					source: 'domain'
				})
			}

			for(let { currency, issuer, ...meta } of xls26.tokens){
				if(issuer !== address)
					continue

				metas.push({
					meta,
					token: {
						currency,
						issuer
					},
					source: 'domain'
				})
			}

			for(let { meta } of metas){
				delete meta.trusted
			}

			for(let meta of metas){
				repo.tokenMetas.insert(meta)
			}


			log.debug(`issuer (${address}) wrote ${metas.length} metas from ${tomlUrl}`)

			if(metas.length > 0)
				accumulateUpdates({'% extracted metas': metas.length})

			accumulateUpdates({'% xrp-ledger.toml scans': 1})
		}
	})
}