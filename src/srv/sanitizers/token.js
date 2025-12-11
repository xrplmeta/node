import { currencyUTF8ToHex } from '@xrplkit/tokens'
import { isValidClassicAddress } from 'ripple-address-codec'
import { isValidMPTIssuanceId } from '../../xrpl/mpt.js'
import TokenType from '../../xrpl/tokentype.js'


const iouSortKeymap = {
	trustlines_delta_24h: 'trustlinesDelta24H',
	trustlines_percent_24h: 'trustlinesPercent24H',
	trustlines_delta_7d: 'trustlinesDelta7D',
	trustlines_percent_7d: 'trustlinesPercent7D',
	holders: 'holders',
	holders_delta_24h: 'holdersDelta24H',
	holders_percent_24h: 'holdersPercent24H',
	holders_delta_7d: 'holdersDelta7D',
	holders_percent_7d: 'holdersPercent7D',
	supply: 'supply',
	supply_delta_24h: 'supplyDelta24H',
	supply_percent_24h: 'supplyPercent24H',
	supply_delta_7d: 'supplyDelta7D',
	supply_percent_7d: 'supplyPercent7D',
	marketcap: 'marketcap',
	marketcap_delta_24h: 'marketcapDelta24H',
	marketcap_percent_24h: 'marketcapPercent24H',
	marketcap_delta_7d: 'marketcapDelta7D',
	marketcap_percent_7d: 'marketcapPercent7D',
	price_percent_24h: 'pricePercent24H',
	price_percent_7d: 'pricePercent7D',
	volume_24h: 'volume24H',
	volume_7d: 'volume7D',
	exchanges_24h: 'exchanges24H',
	exchanges_7d: 'exchanges7D',
	takers_24h: 'takers24H',
	takers_7d: 'takers7D',
	trustlines: 'trustlines',
}

const mptSortKeymap = Object.fromEntries(
	Object.entries(iouSortKeymap)
		.filter(([key]) => !key.includes('trustlines'))
)

function parseIOU({ ctx, currency, issuer }){
	if(!isValidClassicAddress(issuer))
		throw {
			type: `invalidParam`,
			message: `The issuing address ${issuer} is malformed.`,
			expose: true
		}

	let iouToken = ctx.db.core.tokens.readOne({
		where: {
			currency: currencyUTF8ToHex(currency),
			issuer: {
				address: issuer
			}
		},
		include: {
			issuer: true
		}
	})
	
	if(!iouToken){
		throw {
			type: `entryNotFound`,
			message: `The token '${currency}' issued by '${issuer}' does not exist.`,
			expose: true
		}
	}

	return iouToken
}

function parseMPT({ ctx, mptIssuanceId }){
	if (!isValidMPTIssuanceId(mptIssuanceId))
		throw {
			type: `invalidParam`,
			message: `The mpt_issuance_id - ${mptIssuanceId} malformed.`,
			expose: true
		}

	let mpToken = ctx.db.core.tokens.readOne({
		where: {
			mptIssuanceId
		},
		include: {
			issuer: true
		}
	})

	if(!mpToken){
		throw {
			type: `entryNotFound`,
			message: `The MPT token - ${mptIssuanceId} does not exist.`,
			expose: true
		}
	}

	return mpToken
}

export function sanitizeIOUToken({ key, array = false, allowXRP = false }){
	function parse(ctx, { currency, issuer }){
		if(currency === 'XRP'){
			if(allowXRP)
				return {
					id: 1,
					currency: 'XRP'
				}
			else
				throw {
					type: `invalidParam`,
					message: `XRP is not allowed as parameter.`,
					expose: true
				}
		}
		
		return parseIOU({ ctx, currency, issuer })
	}

	return ({ ctx, ...args }) => {
		if(!args.hasOwnProperty(key))
			throw {
				type: `missingParam`,
				message: `No token specified.`,
				expose: true
			}

		if(array){
			return {
				...args,
				ctx,
				[key]: args[key].map(token => parse(ctx, token)),
			}
		}else{
			return {
				...args,
				ctx,
				[key]: parse(ctx, args[key]),
			}
		}
	}
}

export function sanitizeToken({ key, array = false, allowXRP = false }){
	function parse(ctx, { currency, issuer, mptIssuanceId }){
		if (mptIssuanceId != null){
			return parseMPT({ ctx, mptIssuanceId })
		}

		if(currency === 'XRP'){
			if(allowXRP)
				return {
					id: 1,
					currency: 'XRP'
				}
			else
				throw {
					type: `invalidParam`,
					message: `XRP is not allowed as parameter.`,
					expose: true
				}
		}
		
		return parseIOU({ ctx, currency, issuer })
	}

	return ({ ctx, ...args }) => {
		if(!args.hasOwnProperty(key))
			throw {
				type: `missingParam`,
				message: `No token specified.`,
				expose: true
			}

		if(array){
			return {
				...args,
				ctx,
				[key]: args[key].map(token => parse(ctx, token)),
			}
		}else{
			return {
				...args,
				ctx,
				[key]: parse(ctx, args[key]),
			}
		}
	}
}

export function sanitizeNameLike(){
	return ({ ctx, name_like, ...args }) => {
		if(name_like != null){
			if(typeof name_like !== 'string'){
				throw {
					type: `invalidParam`,
					message: `The name_like term has to be a string.`,
					expose: true
				}
			}

			if(name_like.length === 0){
				throw {
					type: `invalidParam`,
					message: `The name_like term has to be at least one character long.`,
					expose: true
				}
			}
		}

		return {
			...args,
			ctx,
			name_like
		}
	}
}

export function sanitizeTrustLevels(){
	return ({ ctx, trust_level, trust_levels, ...args }) => {
		trust_levels = trust_level || trust_levels

		if(trust_levels){
			if(!Array.isArray(trust_levels)){
				throw {
					type: `invalidParam`,
					message: `The trust levels need to be specified as an array.`,
					expose: true
				}
			}

			trust_levels = trust_levels.map(level => parseInt(level))

			if(trust_levels.some(level => level < 0 || level > 3)){
				throw {
					type: `invalidParam`,
					message: `The trust levels need to be between 0 and 3.`,
					expose: true
				}
			}
		}

		return {
			...args,
			ctx,
			trust_levels
		}
	}
}

export function sanitizeTokenListSortBy({ tokenType } = {}){
	const sortKeymap = tokenType === TokenType.IOU ? iouSortKeymap : mptSortKeymap

	return ({ ctx, sort_by, ...args }) => {
		if(sort_by){
			sort_by = sortKeymap[sort_by]

			if(!sort_by){
				throw {
					type: `invalidParam`,
					message: `This sorting mode is not allowed. Possible values are: ${
						Object.keys(sortKeymap)
							.map(key => `${key}`)
							.join(', ')
					}'`,
					expose: true
				}
			}
		}

		return {
			...args,
			ctx,
			sort_by
		}
	}
}