import { clearTokenProps, writeAccountProps, writeTokenProps } from "../../db/helpers/props.js"
import { mptIssuanceIdFromIssuerAndSequence } from "../../xrpl/mpt.js"
import TokenType from "../../xrpl/tokentype.js"
import { parse as parseXLS89 } from '@xrplkit/xls89'

export function parse({ entry }){
    return {
        issuer: entry.Issuer,
        sequence: entry.Sequence,
        mptokenMetadata: entry.MPTokenMetadata
    }
}

export function diff({ ctx, ledgerSequence, transactionIndex, previous, final }){
    let issuer = final?.issuer || previous?.issuer
    let sequence = final?.sequence || previous?.sequence

    let token = {
        issuer: {
            address: issuer
        },
        mptIssuanceId: mptIssuanceIdFromIssuerAndSequence(issuer, sequence),
        tokenType: TokenType.MPT
    }
    token = ctx.db.core.tokens.createOne({
        data: token
    })

    let row = ctx.db.core.mptokenMetadataUpdates.createOne({
        data: {
            token
        }
    })

    // Parse and persist metadata when applying ledger state
    if (ledgerSequence == null || transactionIndex == null) {
        updateTokenAndAccountProps({ctx, token, mptokenMetadata: final.mptokenMetadata, overwriteIssuerNameProp: true})
        return
    }

    let isDeleted = ctx.backwards ? final && !previous : previous && !final
    let adjustIssuerNameProp = isDeleted

    if (!isDeleted && final?.mptokenMetadata != previous?.mptokenMetadata){
        if (!ctx.backwards) {
            updateTokenAndAccountProps({ctx, token, mptokenMetadata: final.mptokenMetadata, overwriteIssuerNameProp: false})
            adjustIssuerNameProp = true
        }
        
        // Consider only the latest update to metadata during backfill phase
        if (ctx.backwards && row.ledgerSequence == null && row.transactionIndex == null){
            adjustIssuerNameProp = true
        }

        if (ledgerSequence >= row.ledgerSequence && transactionIndex > row.transactionIndex){
            row.ledgerSequence = ledgerSequence
            row.transactionIndex = transactionIndex
        }
        
        row.ledgerSequence = row.ledgerSequence ?? ledgerSequence
        row.transactionIndex = row.transactionIndex ?? transactionIndex
    }

    ctx.db.core.mptokenMetadataUpdates.updateOne({
        data: {
            ledgerSequence: row.ledgerSequence,
            transactionIndex: row.transactionIndex,
            deleted: isDeleted ? true: row.deleted
        },
        where: {
            id: row.id
        }
    })

    // issuer_name is an account property, however, it is present in token metadata as per XLS-89
    // when an account issues multiple MPTs we use the issuer_name property from the last
    // created/updated MPT and store it as an account property
    if (adjustIssuerNameProp) {
        let rows = ctx.db.core.mptokenMetadataUpdates.readManyRaw({
			query: 
				`select
                    tp.value, mmu.ledgerSequence
                from
                    MPTokenMetadataUpdate mmu
                inner join Token t on t.id = mmu.token
                inner join Account a on a.id = t.issuer
                inner join TokenProp tp on tp.token = t.id
                where
                    tp.key = 'issuer_name'
                    and tp.source = 'ledger'
                    and mmu.deleted = false
                    and a.id = ?
                order by
                    mmu.ledgerSequence desc,
                    mmu.transactionIndex desc;`,
			params: [
				token.issuer.id
			]
		})
        let metadataWithKnownOrder = rows.filter(row => row.ledgerSequence != null)
        let metadataWithUnknownOrder = rows.filter(row => row.ledgerSequence == null)
        let issuerName = metadataWithKnownOrder.length > 0 ? metadataWithKnownOrder[0].value : (metadataWithUnknownOrder.length > 0 ? metadataWithUnknownOrder[0].value : null)

        // Remove surrounding quotes
        if (issuerName && typeof issuerName === 'string') {
            issuerName = issuerName.substring(1, issuerName.length - 1)
        }

        writeAccountProps({ctx, account: token.issuer, props: {name: issuerName}, source: 'ledger'})
    }
}

function updateTokenAndAccountProps({ctx, token, mptokenMetadata, overwriteIssuerNameProp}) {
    let {token: props} = parseXLS89(mptokenMetadata)
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
    if (overwriteIssuerNameProp && Object.keys(props) != 0)
        writeAccountProps({ctx, account: token.issuer, props: {name: props.issuer_name}, source: 'ledger'})
}