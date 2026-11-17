import fs from 'fs'
import { expect } from 'chai'
import { createContext } from './env.js'
import { writeAccountProps, writeTokenProps } from '../../src/db/helpers/props.js'
import { updateIconCacheFor } from '../../src/cache/icons.js'
import TokenType from '../../src/xrpl/tokentype.js'
import { getTokenId } from '../../src/db/helpers/common.js'


const ctx = await createContext()

const accounts = [
	{
		address: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq',
		props: {
			name: 'GateHub',
			icon: 'https://xumm.app/cdn-cgi/image/width=250,height=250,quality=75,fit=crop/assets/icons/currencies/ex-gatehub.png',
			trust_level: 3
		}
	},
	{
		address: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B',
		props: {
			name: 'Bitstamp',
			icon: 'https://xumm.app/cdn-cgi/image/width=250,height=250,quality=75,fit=crop/assets/icons/currencies/crypto-btc.png',
			trust_level: 3
		}
	},
	{
		address: 'rJMe5LJDEPZjJD5zubetbZ2UJP2gEoHEAv',
		props: {
			name: 'MPT Test',
			icon: 'https://ripple.com/assets/rlusd-logo.png?issuer=ripple',
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
		tokenType: TokenType.IOU,
		props: {
			name: 'US Dollar',
			icon: 'https://ripple.com/assets/rlusd-logo.png',
			asset_class: 'fiat'
		}
	},
	{
		currency: 'USD',
		issuer: {
			address: accounts[1].address
		},
		tokenType: TokenType.IOU,
		props: {
			name: 'US Dollar',
			icon: 'https://ripple.com/assets/rlusd-logo.png',
			asset_class: 'fiat'
		}
	},
	{
		mptIssuanceId: '000525D8BE61F040420DB5A4CBA0577A70E6BD013E75E00D',
		issuer: {
			address: accounts[2].address
		},
		tokenType: TokenType.MPT,
		props: {
			name: 'MPT US Dollar',
			icon: 'https://ripple.com/assets/rlusd-logo.png',
			asset_class: 'rwa'
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

for(let { currency, issuer, mptIssuanceId, tokenType, props } of tokens){
	writeTokenProps({
		ctx,
		token: {
			currency,
			issuer,
			mptIssuanceId,
			tokenType
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

				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8@512.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8@256.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8@128.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8@64.png`)).to.be.true
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

				let tokenCache3 = ctx.db.cache.tokens.readOne({
					where: {
						token: 4
					}
				})

				expect(tokenCache1.cachedIcons).to.be.deep.equal({
					[tokens[0].props.icon]: 'E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8.png'
				})

				expect(tokenCache2.cachedIcons).to.be.deep.equal({
					[tokens[1].props.icon]: 'E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8.png'
				})

				expect(tokenCache3.cachedIcons).to.be.deep.equal({
					[tokens[2].props.icon]: 'E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8.png'
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

				writeTokenProps({
					ctx,
					token: {
						mptIssuanceId: tokens[2].mptIssuanceId
					},
					props: {
						...tokens[2].props,
						icon: undefined
					},
					source: 'manual'
				})

				await updateIconCacheFor({ 
					ctx, 
					token: {
						mptIssuanceId: tokens[2].mptIssuanceId
					}
				})

				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8.png`)).to.be.false
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8@512.png`)).to.be.false
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8@256.png`)).to.be.false
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8@128.png`)).to.be.false
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8@64.png`)).to.be.false
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

				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/53C43CED0D1E297CF52A5E41BF72379A7C856F1AE164F1EE75FF5D9405AFECED.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/53C43CED0D1E297CF52A5E41BF72379A7C856F1AE164F1EE75FF5D9405AFECED@512.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/53C43CED0D1E297CF52A5E41BF72379A7C856F1AE164F1EE75FF5D9405AFECED@256.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/53C43CED0D1E297CF52A5E41BF72379A7C856F1AE164F1EE75FF5D9405AFECED@128.png`)).to.be.true
				expect(fs.existsSync(`${ctx.config.node.dataDir}/media/icons/53C43CED0D1E297CF52A5E41BF72379A7C856F1AE164F1EE75FF5D9405AFECED@64.png`)).to.be.true

				let tokenCache = ctx.db.cache.tokens.readOne({
					where: {
						token: 2
					}
				})

				expect(tokenCache.cachedIcons).to.be.deep.equal({
					[accounts[0].props.icon]: '53C43CED0D1E297CF52A5E41BF72379A7C856F1AE164F1EE75FF5D9405AFECED.png'
				})
			}
		)
	}
)

describe(
	'Icon Cache: shared files',
	() => {
		const rlusdIcon = 'https://ripple.com/assets/rlusd-logo.png'
		const iconFile = 'E32B0A02D96735AAD168AEEB49792FB0550967FD58E26A544B5F2649D5732DC8'
		const otherIcon = 'https://xumm.app/cdn-cgi/image/width=250,height=250,quality=75,fit=crop/assets/icons/currencies/ex-gatehub.png'
		const issuer = { address: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq' }
		const victim = { currency: 'VIC', issuer, tokenType: TokenType.IOU }
		const attacker = { currency: 'ATK', issuer, tokenType: TokenType.IOU }
		const multi = { currency: 'MUL', issuer, tokenType: TokenType.IOU }

		let ctx

		const setIcon = (token, icon, source = 'manual') => writeTokenProps({
			ctx,
			token,
			props: { icon },
			source
		})

		const update = token => updateIconCacheFor({
			ctx,
			token: {
				currency: token.currency,
				issuer: token.issuer
			}
		})

		const cachedIconsOf = token => ctx.db.cache.tokens.readOne({
			where: {
				token: getTokenId({ ctx, token })
			}
		}).cachedIcons

		const fileExists = () => fs.existsSync(`${ctx.config.node.dataDir}/media/icons/${iconFile}.png`)
			&& fs.existsSync(`${ctx.config.node.dataDir}/media/icons/${iconFile}@64.png`)

		before(async () => {
			ctx = await createContext()
		})

		it(
			'should keep a file another URL with identical bytes still uses',
			async () => {
				setIcon(victim, rlusdIcon)
				setIcon(attacker, `${rlusdIcon}?copy=1`)
				await update(victim)
				await update(attacker)

				setIcon(attacker, undefined)
				await update(attacker)

				expect(fileExists()).to.be.true
				expect(cachedIconsOf(victim)).to.be.deep.equal({
					[rlusdIcon]: `${iconFile}.png`
				})
			}
		)

		it(
			'should delete the file once its last URL is gone',
			async () => {
				setIcon(victim, undefined)
				await update(victim)

				expect(fileExists()).to.be.false
			}
		)

		it(
			'should keep the other icon links when unlinking one',
			async () => {
				setIcon(multi, rlusdIcon, 'manual')
				setIcon(multi, otherIcon, 'other')
				await update(multi)

				setIcon(multi, undefined, 'other')
				await update(multi)

				expect(cachedIconsOf(multi)).to.be.deep.equal({
					[rlusdIcon]: `${iconFile}.png`
				})
			}
		)
	}
)
