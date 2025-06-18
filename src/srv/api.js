import { sanitizeRange, sanitizePoint, sanitizeLimitOffset, sanitizeSourcePreferences } from './sanitizers/common.js'
import { sanitizeToken, sanitizeTokenListSortBy, sanitizeNameLike, sanitizeTrustLevels } from './sanitizers/token.js'
import { serveServerInfo } from './procedures/server.js'
import { serveTokenSummary, serveTokenSeries, serveTokenPoint, serveTokenList, subscribeTokenList, unsubscribeTokenList, serveTokenExchanges, serveTokenHolders } from './procedures/token.js'
import { serveLedger } from './procedures/ledger.js'


export const server_info = compose([
	serveServerInfo()
])

export const ledger = compose([
	sanitizePoint(),
	serveLedger()
])

export const tokens = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	sanitizeNameLike(),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy(),
	sanitizeSourcePreferences(),
	serveTokenList()
])

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

export const token_metric = compose([
	sanitizeToken({ key: 'token' }),
	sanitizePoint(),
	serveTokenPoint()
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