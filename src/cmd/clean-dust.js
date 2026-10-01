import log from '@mwni/log'
import { openDB } from '../db/index.js'
import { markCacheDirtyForTokenExchanges } from '../cache/todo.js'
import TokenType from '../xrpl/tokentype.js'


export default async function({ config, args }){
	const dustValueXRP = config.ledger.filterDustBelowXrp

	if(dustValueXRP === undefined){
		log.error(`config value LEDGER.filter_dust_below_xrp is not set - nothing to clean`)
		process.exit(1)
	}

	const ctx = {
		config,
		log,
		db: await openDB({ 
			ctx: { config }
		})
	}

	const xrp = ctx.db.core.tokens.readOne({
		where: {
			tokenType: TokenType.XRP
		}
	})

	log.time.info(`dust.scan`, `scanning for exchanges with XRP side below ${dustValueXRP}`)

	const dustExchanges = ctx.db.core.tokenExchanges.readMany({
		where: {
			OR: [
				{
					takerPaidToken: xrp,
					takerPaidValue: {
						lessThan: dustValueXRP
					}
				},
				{
					takerGotToken: xrp,
					takerGotValue: {
						lessThan: dustValueXRP
					}
				}
			]
		},
		include: {
			takerPaidToken: true,
			takerGotToken: true
		}
	})

	log.time.info(`dust.scan`, `found ${dustExchanges.length} dust exchange(s) in %`)

	if(dustExchanges.length === 0)
		return

	if(args.dryRun || args['dry-run']){
		log.info(`dry run - not deleting anything`)
		return
	}

	const affectedTokens = new Map()

	for(let exchange of dustExchanges){
		for(let token of [exchange.takerPaidToken, exchange.takerGotToken]){
			if(token.id !== xrp.id)
				affectedTokens.set(token.id, token)
		}
	}

	log.time.info(`dust.delete`, `deleting ${dustExchanges.length} dust exchange(s)`)

	ctx.db.core.tx(() => {
		for(let exchange of dustExchanges){
			ctx.db.core.tokenExchanges.deleteOne({
				where: {
					id: exchange.id
				}
			})
		}
	})

	log.time.info(`dust.delete`, `deleted in %`)
	log.info(`marking cache dirty for ${affectedTokens.size} affected token(s)`)

	for(let token of affectedTokens.values()){
		markCacheDirtyForTokenExchanges({ ctx, token })
	}

	log.info(`done - affected token caches will be refreshed by the running node, or run "rebuild-cache"`)
}
