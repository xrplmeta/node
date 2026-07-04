import version from '../../lib/version.js'
import TokenType from '../../xrpl/tokentype.js'
import { getAvailableRange } from '../../db/helpers/ledgers.js'
import { getWorkerQueueSnapshot } from '../worker.js'


export function serveServerInfo(){
	return ({ ctx, worker_queue }) => {
		const iouCount = Number(ctx.db.core.tokens.count({
			where: {
				tokenType: TokenType.IOU
			}
		}))
		const mptCount = Number(ctx.db.core.tokens.count({
			where: {
				tokenType: TokenType.MPT
			}
		}))

		return {
			server_version: version,
			available_range: getAvailableRange({ ctx }),
			trustlists: ctx.config.trustlist
				? ctx.config.trustlist.map(
					list => ({
						id: list.id,
						url: list.url,
						trust_level: list.trustLevel
					})
				)
				: [],
			total_tokens: iouCount + mptCount + 1,
			total_ious: iouCount,
			total_mpts: mptCount,
			total_nfts: 0,
			...(
				worker_queue === true
					? { worker_queue: getWorkerQueueSnapshot({ ctx }) }
					: {}
			)
		}
	}
}

export function adjustServerInfoResponse(){
	return response => {
		response.total_tokens = response.total_ious + 1
		delete response.total_ious
		delete response.total_mpts
		return response
	}
}