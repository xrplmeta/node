import { parse as parseXLS89 } from '@xrplkit/xls89'
import { mptIssuanceIdFromIssuerAndSequence } from "../../xrpl/mpt.js"
import TokenType from "../../xrpl/tokentype.js"
import { writeAccountProps, writeTokenProps } from '../../db/helpers/props.js'

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
    let metadata = final?.mptokenMetadata || previous?.mptokenMetadata

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

    // Since MPTokenMetadata is immutable, we only need to write props when the token is created
    if (!metadata || (previous && final))
        return

    let {token: props} = parseXLS89(metadata)
    
    writeTokenProps({
        ctx,
        token,
        props,
        source: 'ledger'
    })

    writeAccountProps({
        ctx,
        account: token.issuer,
        props: {
            name: props.issuer_name
        },
        source: 'ledger'
    })
}