import { parse as parseXLS89 } from '@xrplkit/xls89'
import { mptIssuanceIdFromIssuerAndSequence } from "../../xrpl/mpt.js"
import TokenType from "../../xrpl/tokentype.js"
import { clearTokenProps, writeTokenProps } from '../../db/helpers/props.js'

export function parse({ entry }){
    return {
        issuer: entry.Issuer,
        sequence: entry.Sequence,
        mptokenMetadata: entry.MPTokenMetadata
    }
}

export function diff({ ctx, previous, final }){
    let issuer = final?.issuer || previous?.issuer
    let sequence = final?.sequence || previous?.sequence

    let token = {
        issuer: {
            address: issuer
        },
        mptIssuanceId: mptIssuanceIdFromIssuerAndSequence(issuer, sequence),
        tokenType: TokenType.MPT
    }
    ctx.db.core.tokens.createOne({
        data: token
    })

    if (ctx.backward){
        if (final && !previous){
            updateTokenProps({ctx, token, metadata: final.mptokenMetadata})
        }
    }else{
        if (final && final?.mptokenMetadata != previous?.mptokenMetadata){
            updateTokenProps({ctx, token, metadata: final.mptokenMetadata})
        }
    }
}

function updateTokenProps({ctx, token, metadata}){
    let {token: props} = parseXLS89(metadata)
    clearTokenProps({
        ctx,
        token,
        source: 'ledger'
    })
    writeTokenProps({
        ctx,
        token,
        props,
        source: 'ledger'
    })
}