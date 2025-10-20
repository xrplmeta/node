export async function fetch({ ctx,  sequence, mptIssuanceId }){
    let { result } = await ctx.xrpl.request({ 
        command: 'ledger_entry', 
        ledger_index: sequence,
        mpt_issuance: mptIssuanceId,
    })

    return {
        issuer: result.node.Issuer,
        metadata: result.node.MPTokenMetadata
    }
}