import fs from 'fs'
import { expect } from 'chai'
import { createContext } from './env.js'
import { writeAccountProps, writeTokenProps } from '../../src/db/helpers/props.js'
import { updateIconCacheFor } from '../../src/cache/icons.js'


const ctx = await createContext()

const accounts = [
	{
		address: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq',
		props: {
			name: 'GateHub',
			icon: 'https://static.xrplmeta.org/icons/gatehub.png',
			trust_level: 3
		}
	},
	{
		address: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B',
		props: {
			name: 'Bitstamp',
			icon: 'https://static.xrplmeta.org/icons/bitstamp.png',
			trust_level: 3
		}
	}
]

const tokens = [
	{
		currency: 'USD',
		issuer: {
			address: accounts[0].address
		},
		props: {
			name: 'US Dollar',
			icon: 'https://static.xrplmeta.org/icons/USD.png',
			asset_class: 'fiat'
		}
	},
	{
		currency: 'USD',
		issuer: {
			address: accounts[1].address
		},
		props: {
			name: 'US Dollar',
			icon: 'https://static.xrplmeta.org/icons/USD.png',
			asset_class: 'fiat'
		}
	}
]

for(let { address, props } of accounts){
	writeAccountProps({
		ctx,
		account: {
			address
		},
		props,
		source: 'manual'
	})
}

for(let { currency, issuer, props } of tokens){
	writeTokenProps({
		ctx,
		token: {
			currency,
			issuer
		},
		props,
		source: 'manual'
	})
}

describe(
	'Icon Cache',
	() => {
		it(
			'should download token icons according to icon prop',
			async () => {
				for(let token of tokens){
					await updateIconCacheFor({ 
						ctx, 
						token: {
							currency: token.currency,
							issuer: token.issuer
						}
					})
				}

				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/C676A0DE05.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/C676A0DE05@512.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/C676A0DE05@256.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/C676A0DE05@128.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/C676A0DE05@64.png`)).to.be.true
			}
		)

		it(
			'should link the cached icon to the token cache',
			async () => {
				let tokenCache1 = ctx.db.cache.tokens.readOne({
					where: {
						token: 2
					}
				})

				let tokenCache2 = ctx.db.cache.tokens.readOne({
					where: {
						token: 3
					}
				})

				expect(tokenCache1.cachedIcons).to.be.deep.equal({
					[tokens[0].props.icon]: 'C676A0DE05.png'
				})

				expect(tokenCache2.cachedIcons).to.be.deep.equal({
					[tokens[1].props.icon]: 'C676A0DE05.png'
				})
			}
		)

		it(
			'should unlink the cached icon if no longer in token props',
			async () => {
				writeTokenProps({
					ctx,
					token: {
						currency: tokens[0].currency,
						issuer: tokens[0].issuer
					},
					props: {
						...tokens[0].props,
						icon: undefined
					},
					source: 'manual'
				})

				await updateIconCacheFor({ 
					ctx, 
					token: {
						currency: tokens[0].currency,
						issuer: tokens[0].issuer
					}
				})

				let tokenCache = ctx.db.cache.tokens.readOne({
					where: {
						token: 2
					}
				})

				expect(tokenCache.cachedIcons).to.be.deep.equal({})
			}
		)

		it(
			'delete the icon if it has no more users',
			async () => {
				writeTokenProps({
					ctx,
					token: {
						currency: tokens[1].currency,
						issuer: tokens[1].issuer
					},
					props: {
						...tokens[1].props,
						icon: undefined
					},
					source: 'manual'
				})

				await updateIconCacheFor({ 
					ctx, 
					token: {
						currency: tokens[1].currency,
						issuer: tokens[1].issuer
					}
				})

				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/C676A0DE05.png`)).to.be.false
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/C676A0DE05@512.png`)).to.be.false
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/C676A0DE05@256.png`)).to.be.false
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/C676A0DE05@128.png`)).to.be.false
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/C676A0DE05@64.png`)).to.be.false
			}
		)

		it(
			'should do the same for issuer icons',
			async () => {
				for(let account of accounts){
					await updateIconCacheFor({ 
						ctx, 
						account: {
							address: account.address
						}
					})
				}

				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/0D821A3269.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/0D821A3269@512.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/0D821A3269@256.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/0D821A3269@128.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/0D821A3269@64.png`)).to.be.true

				let tokenCache = ctx.db.cache.tokens.readOne({
					where: {
						token: 2
					}
				})

				expect(tokenCache.cachedIcons).to.be.deep.equal({
					[accounts[0].props.icon]: '0D821A3269.png'
				})
			}
		)
	}
)