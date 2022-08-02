import { sanitizeRange, sanitizePoint, sanitizeLimitOffset, sanitizeSourcePreferences } from './sanitizers/common.js'
import { sanitizeToken, sanitizeTokenListSortBy, sanitizeTrustLevels } from './sanitizers/token.js'
import { serveServerInfo } from './procedures/server.js'
import { serveTokenSummary, serveTokenSeries, serveTokenPoint, serveTokenList, subscribeTokenList, unsubscribeTokenList } from './procedures/token.js'
import { serveLedger } from './procedures/ledger.js'


export const server_info = compose([
	serveServerInfo()
])

export const ledger = compose([
	sanitizePoint({ clamp: false }),
	serveLedger()
])

export const tokens = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 1000 }),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy(),
	sanitizeSourcePreferences(),
	serveTokenList()
])

export const tokens_subscribe = compose([
	sanitizeToken({ key: 'tokens', array: true }),
	sanitizeSourcePreferences(),
	subscribeTokenList()
])

export const tokens_unsubscribe = compose([
	sanitizeToken({ key: 'tokens', array: true }),
	unsubscribeTokenList()
])

export const token = compose([
	sanitizeToken({ key: 'token' }),
	sanitizeSourcePreferences(),
	serveTokenSummary()
])

export const token_metric = compose([
	sanitizeToken({ key: 'token' }),
	sanitizePoint({ clamp: false }),
	serveTokenPoint()
])

export const token_series = compose([
	sanitizeToken({ key: 'token' }),
	sanitizeRange({ withInterval: true }),
	serveTokenSeries()
])


function compose(functions){
	return args => functions.reduce(
		(v, f) => f(v),
		args	
	)
}