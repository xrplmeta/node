import TokenType from "../../xrpl/tokentype.js"

export function parse({ entry }){
    return {
        issuer: {address: entry.Issuer}, 
        mptIssuanceId: entry.mpt_issuance_id,
    }
}

export function diff({ ctx, final }){
    if (!final)
        return
    
    ctx.db.core.tokens.createOne({
        data: {...final, tokenType: TokenType.MPT}
    })    
}