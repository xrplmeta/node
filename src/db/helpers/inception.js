import { markCacheDirtyForTokenInception } from '../../cache/todo.js'


/**
 * Records the ledger in which a token came into existence.
 * For IOUs this is the ledger in which the issuer first put supply
 * into circulation, for MPTs the ledger in which the issuance
 * object was created.
 *
 * Only ever moves the value towards older ledgers, so repeated calls
 * (e.g. during backfill, which always presents older ledgers) converge
 * on the true inception.
 */
export function writeTokenInception({ ctx, token, ledgerSequence = ctx.ledgerSequence }){
	if(!ledgerSequence)
		return

	if(token.inceptionLedgerSequence != null && token.inceptionLedgerSequence <= ledgerSequence)
		return

	ctx.db.core.tokens.updateOne({
		data: {
			inceptionLedgerSequence: ledgerSequence
		},
		where: {
			id: token.id
		}
	})

	token.inceptionLedgerSequence = ledgerSequence

	markCacheDirtyForTokenInception({ ctx, token })
}


export function readTokenInceptionTime({ ctx, token }){
	if(token.inceptionLedgerSequence == null)
		return undefined

	let ledger = ctx.db.core.ledgers.readOne({
		where: {
			sequence: token.inceptionLedgerSequence
		}
	})

	return ledger?.closeTime
}
