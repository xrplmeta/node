import version from '../../lib/version.js'
import { getAvailableRange } from '../../db/helpers/ledgers.js'


export function serveServerInfo(){
	return ({ ctx }) => {
		return {
			server_version: version,
			available_range: getAvailableRange({ ctx }),
			tokenslists: ctx.config.crawl?.tokenlist
				? ctx.config.crawl?.tokenlist.map(
					list => ({
						id: list.id,
						url: list.url,
						trust_level: list.trustLevel
					})
				)
				: [],
			total_tokens: Number(ctx.db.tokens.count()),
			total_nfts: 0
		}
	}
}