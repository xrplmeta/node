import { sanitizeRange, sanitizePoint, sanitizeLimitOffset, sanitizeSourcePreferences } from './sanitizers/common.js'
import { sanitizeToken, sanitizeTokenListSortBy, sanitizeNameLike, sanitizeTrustLevels, sanitizeIOUToken } from './sanitizers/token.js'
import { adjustServerInfoResponse, serveServerInfo } from './procedures/server.js'
import { serveTokenSummary, serveTokenSeries, serveTokenList, subscribeTokenList, unsubscribeTokenList, serveTokenExchanges, serveTokenHolders, adjustTokenResponse, adjustTokensResponse } from './procedures/token.js'
import { serveLedger } from './procedures/ledger.js'
import TokenType from '../xrpl/tokentype.js'
import { addLedgerV1DeprecationWarning, addServerInfoV1DeprecationWarning, addTokenHoldersV1DeprecationWarning, addTokensV1DeprecationWarning, addTokenV1DeprecationWarning } from './warnings/warning.js'


export const server_info_v1 = compose([
	serveServerInfo(),
	adjustServerInfoResponse(),
	addServerInfoV1DeprecationWarning()
])

export const server_info = compose([
	serveServerInfo()
])

export const ledger_v1 = compose([
	sanitizePoint(),
	serveLedger(),
	addLedgerV1DeprecationWarning()
])

export const ledger = compose([
	sanitizePoint(),
	serveLedger()
])

export const tokens_v1 = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	sanitizeNameLike(),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy({ tokenType: TokenType.IOU }),
	sanitizeSourcePreferences(),
	serveTokenList({ tokenType: TokenType.IOU }),
	adjustTokensResponse(),
	addTokensV1DeprecationWarning()
])

export const tokens = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	sanitizeNameLike(),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy(),
	sanitizeSourcePreferences(),
	serveTokenList()
])

export const iou_tokens = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	sanitizeNameLike(),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy({ tokenType: TokenType.IOU }),
	sanitizeSourcePreferences(),
	serveTokenList({ tokenType: TokenType.IOU }),
	adjustTokensResponse(),
])

export const mpt_tokens = compose([
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	sanitizeNameLike(),
	sanitizeTrustLevels(),
	sanitizeTokenListSortBy({ tokenType: TokenType.MPT }),
	sanitizeSourcePreferences(),
	serveTokenList({ tokenType: TokenType.MPT }),
	adjustTokensResponse(),
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

export const iou_token = compose([
	sanitizeIOUToken({ key: 'token' }),
	sanitizeSourcePreferences(),
	serveTokenSummary(),
	adjustTokenResponse(),
	addTokenV1DeprecationWarning()
])

export const token = compose([
	sanitizeToken({ key: 'token' }),
	sanitizeSourcePreferences(),
	serveTokenSummary(),
])

export const token_series = compose([
	sanitizeIOUToken({ key: 'token' }),
	sanitizeRange({ withInterval: true }),
	serveTokenSeries()
])

export const token_exchanges = compose([
	sanitizeIOUToken({ key: 'base', allowXRP: true }),
	sanitizeIOUToken({ key: 'quote', allowXRP: true }),
	sanitizeRange({ defaultToFullRange: true }),
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 1000 }),
	serveTokenExchanges()
])

export const iou_token_holders = compose([
	sanitizeIOUToken({ key: 'token' }),
	sanitizePoint({ defaultToLatest: true }),
	sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 100000 }),
	serveTokenHolders(),
	addTokenHoldersV1DeprecationWarning()
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