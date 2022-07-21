import { sanitizeRange, sanitizePoint, sanitizeLimitOffset, sanitizeSourcePreferences } from './sanitizers/common.js'
import { sanitizeToken, sanitizeTokenListSortBy, sanitizeTrustLevels } from './sanitizers/token.js'
import { serveServerInfo } from './procedures/server.js'
import { serveTokenSummary, serveTokenSeries, serveTokenPoint, serveTokenList } from './procedures/token.js'


export const server_info = compose([
	serveServerInfo()
])

export const tokens = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 1000 }),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy(),
	sanitizeSourcePreferences(),
	serveTokenList()
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



function compose(functions){
	return args => functions.reduce(
		(v, f) => f(v),
		args	
	)
}