import version from '../../lib/version.js'
import { getAvailableRange } from '../../db/helpers/ledgers.js'


export function serveServerInfo(){
	return ({ ctx }) => {
		return {
			server_version: version,
			available_range: getAvailableRange({ ctx }),
			tokenlists: ctx.config.source.tokenlists
				? ctx.config.source.tokenlists.map(
					list => ({
						id: list.id,
						url: list.url,
						trust_level: list.trustLevel
					})
				)
				: [],
			total_tokens: Number(ctx.db.core.tokens.count()),
			total_nfts: 0
		}
	}
}