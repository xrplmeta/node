// This logic might be removed in future, and the MPTs will be stored in Tokens table based on objects created/modified as

import TokenType from "../../xrpl/tokentype.js"

// a result of DEX trade.
export function parse({entry}) {
    return {
        issuer: {address: entry.Issuer}, 
        mptIssuanceId: entry.mpt_issuance_id,
    }
}

export function diff({ ctx, final }){
    if (!final)
        return
    
    ctx.db.core.tokensTemp.createOne({
        data: {...final, tokenType: TokenType.MPT}
    })    
}