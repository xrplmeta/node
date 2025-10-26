import { sanitizeRange, sanitizePoint, sanitizeLimitOffset, sanitizeSourcePreferences } from './sanitizers/common.js'
import { sanitizeToken, sanitizeTokenListSortBy, sanitizeNameLike, sanitizeTrustLevels } from './sanitizers/token.js'
import { adjustServerInfoV1Response, serveServerInfo } from './procedures/server.js'
import { serveTokenSummary, serveTokenSeries, serveTokenList, subscribeTokenList, unsubscribeTokenList, serveTokenExchanges, serveTokenHolders } from './procedures/token.js'
import { serveLedger } from './procedures/ledger.js'
import TokenType from '../xrpl/tokentype.js'


export const server_info = compose([
	serveServerInfo(),
	adjustServerInfoV1Response()
])

export const server_info_v2 = compose([
	serveServerInfo()
])

export const ledger = compose([
	sanitizePoint(),
	serveLedger()
])

export const tokens_v2 = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	sanitizeNameLike(),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy(),
	sanitizeSourcePreferences(),
	serveTokenList()
])

export const tokens_ious = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	sanitizeNameLike(),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy(),
	sanitizeSourcePreferences(),
	serveTokenList({ tokenType: TokenType.IOU })
])

export const tokens_mpts = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	sanitizeNameLike(),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy(),
	sanitizeSourcePreferences(),
	serveTokenList({ tokenType: TokenType.MPT })
])

export const tokens = tokens_ious

export const tokens_subscribe = compose([
	sanitizeToken({ key: 'tokens', array: true }),
	sanitizeSourcePreferences(),
	subscribeTokenList(),
	tag({ mustRunMainThread: true })
])

export const tokens_unsubscribe = compose([
	sanitizeToken({ key: 'tokens', array: true }),
	unsubscribeTokenList(),
	tag({ mustRunMainThread: true })
])

export const token = compose([
	sanitizeToken({ key: 'token' }),
	sanitizeSourcePreferences(),
	serveTokenSummary()
])

export const token_series = compose([
	sanitizeToken({ key: 'token' }),
	sanitizeRange({ withInterval: true }),
	serveTokenSeries()
])

export const token_exchanges = compose([
	sanitizeToken({ key: 'base', allowXRP: true }),
	sanitizeToken({ key: 'quote', allowXRP: true }),
	sanitizeRange({ defaultToFullRange: true }),
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 1000 }),
	serveTokenExchanges()
])

export const token_holders = compose([
	sanitizeToken({ key: 'token' }),
	sanitizePoint({ defaultToLatest: true }),
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	serveTokenHolders()
])


function compose(functions){
	return args => functions.reduce(
		(v, f) => f(v),
		args	
	)
}

function tag(properties){
	return f => Object.assign(f, properties)
}