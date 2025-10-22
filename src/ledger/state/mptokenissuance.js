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

// TODO: Need to optimize this logic since MPTokenMetadata is currently immutable.
// Currently it works.
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

    if (!metadata)
        return

    let {token: props} = parseXLS89(metadata)
    
    if (Object.entries(props).length === 0){
        clearTokenProps({
            ctx,
            token,
            source: 'ledger'
        })
    }else{
        const optionalProps = {
            asset_subclass: undefined,
            uris: undefined,
            additional_info: undefined
        }

        writeTokenProps({
            ctx,
            token,
            props: {...optionalProps, ...props},
            source: 'ledger'
        })        
    }
}