import { mptIssuanceIdFromIssuerAndSequence } from "../../xrpl/mpt.js"
import TokenType from "../../xrpl/tokentype.js"

export function parse({ entry }){
    return {
        issuer: entry.Issuer,
        sequence: entry.Sequence
    }
}

export function diff({ ctx, final }){
    if (!final)
        return
    
    ctx.db.core.tokens.createOne({
        data: {
            issuer: {
                address: final.issuer
            },
            mptIssuanceId: mptIssuanceIdFromIssuerAndSequence(final.issuer, final.sequence),
            tokenType: TokenType.MPT
        }
    })
}