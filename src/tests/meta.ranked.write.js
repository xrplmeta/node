import { open } from '../store/meta.js'
import { writeRanked } from '../core/meta/io.js'
import { eq } from '@xrplkit/xfl'

let ctx = {
	config: {
		data: {
			dir: '.'
		}
	}
}

ctx.meta = open({ ctx })

let token = ctx.meta.tokens.createOne({
	data: {
		currency: 'XAU',
		issuer: {
			address: 'rrrrrrrrrrrrrrrrrrrrrhoLvTp'
		}
	}
})

writeRanked({
	ctx,
	table: 'tokenWhales',
	where: {
		token
	},
	include: {
		account: true
	},
	ledgerIndex: 1,
	items: [
		{
			token,
			account: {
				address: 'rn97Zbg9V6biqJoZ6EQ8RtuaMUTYHWFXyw'
			},
			balance: '10'
		},
		{
			token,
			account: {
				address: 'ra5F8PphThJeP2W8fCuygXPNPGMr3qYzkC'
			},
			balance: '100'
		},
		{
			token,
			account: {
				address: 'rHtAhRdhzMhhGcMZvFY3oEUHyUEsKqQHKW'
			},
			balance: '1000'
		},
		{
			token,
			account: {
				address: 'rDrLA3ne3go4yLf8FHgicxkHL3tTE7TRUf'
			},
			balance: '10000'
		}
	],
	compare: {
		unique: (a, b) => a.account.address === b.account.address,
		diff: (a, b) => eq(a.balance, b.balance)
	},
	rankBy: 'balance'
})