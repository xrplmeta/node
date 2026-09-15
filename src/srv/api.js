import { sanitizeRange, sanitizePoint, sanitizeLimitOffset, sanitizeSourcePreferences } from './sanitizers/common.js'
import {
	sanitizeToken,
	sanitizeTokenListSortBy,
	sanitizeNameLike,
	sanitizeTrustLevels,
	sanitizeIOUToken
} from './sanitizers/token.js'
import { adjustServerInfoResponse, serveServerInfo } from './procedures/server.js'
import {
	serveTokenSummary,
	serveTokenSeries,
	serveTokenList,
	serveTokenExchanges,
	serveTokenHolders,
	subscribeTokenList,
	unsubscribeTokenList,
	adjustTokenResponse,
	adjustTokensResponse
} from './procedures/token.js'
import { serveLedger } from './procedures/ledger.js'
import TokenType from '../xrpl/tokentype.js'
import {
	addLedgerV1DeprecationWarning,
	addServerInfoV1DeprecationWarning,
	addTokenHoldersV1DeprecationWarning,
	addTokensV1DeprecationWarning,
	addTokenV1DeprecationWarning,
	addTokenExchangesV1DeprecationWarning
} from './warnings.js'


export const server_info_v1 = compose([
	serveServerInfo(),
	adjustServerInfoResponse(),
	addServerInfoV1DeprecationWarning(),
	tag({ mustRunMainThread: true, cost: 1 })
])

export const server_info = compose([
	serveServerInfo(),
	tag({ mustRunMainThread: true, cost: 1 })
])

export const ledger_v1 = compose([
	sanitizePoint(),
	serveLedger(),
	addLedgerV1DeprecationWarning(),
	tag({ cost: 1 })
])

export const ledger = compose([
	sanitizePoint(),
	serveLedger(),
	tag({ cost: 1 })
])

export const tokens_v1 = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	sanitizeNameLike(),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy({ tokenType: TokenType.IOU }),
	sanitizeSourcePreferences(),
	serveTokenList({ tokenType: TokenType.IOU }),
	adjustTokensResponse(),
	addTokensV1DeprecationWarning(),
	tag({ cost: tokenListCost })
])

export const tokens = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	sanitizeNameLike(),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy(),
	sanitizeSourcePreferences(),
	serveTokenList(),
	tag({ cost: tokenListCost })
])

export const iou_tokens = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	sanitizeNameLike(),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy({ tokenType: TokenType.IOU }),
	sanitizeSourcePreferences(),
	serveTokenList({ tokenType: TokenType.IOU }),
	adjustTokensResponse(),
	tag({ cost: tokenListCost })
])

export const mpt_tokens = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	sanitizeNameLike(),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy({ tokenType: TokenType.MPT }),
	sanitizeSourcePreferences(),
	serveTokenList({ tokenType: TokenType.MPT }),
	adjustTokensResponse(),
	tag({ cost: tokenListCost })
])

export const tokens_subscribe_v1 = compose([
	sanitizeToken({ key: 'tokens', array: true }),
	sanitizeSourcePreferences(),
	subscribeTokenList(),
	tag({
		mustRunMainThread: true,
		cost: ({ tokens }) => Array.isArray(tokens) ? Math.max(1, tokens.length) : 1
	})
])

export const tokens_unsubscribe_v1 = compose([
	sanitizeToken({ key: 'tokens', array: true }),
	unsubscribeTokenList(),
	tag({ mustRunMainThread: true, cost: 0 })
])

export const token_v1 = compose([
	sanitizeIOUToken({ key: 'token' }),
	sanitizeSourcePreferences(),
	serveTokenSummary(),
	adjustTokenResponse(),
	addTokenV1DeprecationWarning(),
	tag({ cost: 2 })
])

export const token = compose([
	sanitizeToken({ key: 'token' }),
	sanitizeSourcePreferences(),
	serveTokenSummary(),
	tag({ cost: 2 })
])

export const token_series_v1 = compose([
	sanitizeIOUToken({ key: 'token' }),
	sanitizeRange({ withInterval: true }),
	serveTokenSeries(),
	tag({ cost: tokenSeriesCost })
])

export const token_series = compose([
	sanitizeToken({ key: 'token' }),
	sanitizeRange({ withInterval: true }),
	serveTokenSeries(),
	tag({ cost: tokenSeriesCost })
])

export const token_exchanges_v1 = compose([
	sanitizeIOUToken({ key: 'base', allowXRP: true }),
	sanitizeIOUToken({ key: 'quote', allowXRP: true }),
	sanitizeRange({ defaultToFullRange: true }),
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 1000 }),
	serveTokenExchanges(),
	addTokenExchangesV1DeprecationWarning(),
	tag({ cost: tokenExchangesCost })
])

export const token_exchanges = compose([
	sanitizeToken({ key: 'base', allowXRP: true }),
	sanitizeToken({ key: 'quote', allowXRP: true }),
	sanitizeRange({ defaultToFullRange: true }),
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 1000 }),
	serveTokenExchanges(),
	tag({ cost: tokenExchangesCost })
])

export const token_holders_v1 = compose([
	sanitizeIOUToken({ key: 'token' }),
	sanitizePoint({ defaultToLatest: true }),
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	serveTokenHolders(),
	addTokenHoldersV1DeprecationWarning(),
	tag({ cost: tokenHoldersCost })
])

export const token_holders = compose([
	sanitizeToken({ key: 'token' }),
	sanitizePoint({ defaultToLatest: true }),
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	serveTokenHolders(),
	tag({ cost: tokenHoldersCost })
])


function parseLimit(limit, fallback, max){
	let n = parseInt(limit)

	return Number.isFinite(n) && n > 0
		? Math.min(n, max)
		: fallback
}

function tokenListCost({ limit, expand_meta, include_sources, include_changes } = {}){
	return 3
		+ Math.ceil(parseLimit(limit, 100, 100000) / 1000)
		+ (expand_meta || include_sources || include_changes ? 3 : 0)
}

function tokenSeriesCost({ sequence, time } = {}){
	let points = 100
	let range = sequence || time

	if(range && typeof range === 'object'){
		let start = parseInt(range.start)
		let end = parseInt(range.end)
		let interval = parseInt(range.interval)

		if([start, end, interval].every(Number.isFinite) && interval > 0 && end > start){
			points = (end - start) / interval
		}
	}

	return 3 + Math.ceil(Math.min(points, 100000) / 100)
}

function tokenExchangesCost({ limit } = {}){
	return 5 + Math.ceil(parseLimit(limit, 100, 1000) / 100)
}

function tokenHoldersCost({ limit } = {}){
	return 5 + Math.ceil(parseLimit(limit, 100, 100000) / 1000)
}

function compose(functions){
	let func = args => functions
		.filter(f => typeof f === 'function')
		.reduce((v, f) => f(v), args)

	return functions
		.filter(f => !!f.tag)
		.reduce((f, { tag }) => Object.assign(f, tag), func)
}

function tag(properties){
	return { tag: properties }
}