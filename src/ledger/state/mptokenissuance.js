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
        updateTokenAndAccountProps({ctx, token, mptokenMetadata: final.mptokenMetadata, overwriteAccountProps: true})
        return
    }

    let isDeleted = ctx.backwards ? final && !previous : previous && !final
    let adjustIssuerNameProp = isDeleted
    if (!isDeleted && final?.mptokenMetadata != previous?.mptokenMetadata){
        if (!ctx.backwards) {
            updateTokenAndAccountProps({ctx, token, mptokenMetadata: final.mptokenMetadata, overwriteAccountProps: false})
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

    if (adjustIssuerNameProp) {
        let rows = ctx.db.core.mptokenMetadataUpdates.readManyRaw({
			query: 
				`select
                    tp.value, mmu.ledgerSequence
                from
                    MPTokenMetadataUpdate mmu
                inner join Token t
                inner join Account a
                inner join TokenProp tp
                where
                    t.issuer = a.id
                    and t.id = mmu.token
                    and t.id = tp.token
                    and tp.key = 'issuer_name'
                    and tp."source" = 'ledger'
                    and mmu.deleted = false
                    and a.id = ?
                order by
                    mmu.ledgerSequence desc,
                    mmu.transactionIndex desc;`,
			params: [
				token.issuer.id
			]
		})
        let rowsWithKnownOrder = rows.filter(row => row.ledgerSequence != null)
        let rowsWithUnknownOrder = rows.filter(row => row.ledgerSequence == null)
        let issuerName = rowsWithKnownOrder.length > 0 ? rowsWithKnownOrder[0].value : (rowsWithUnknownOrder.length > 0 ? rowsWithUnknownOrder[0].value : null)

        // Remove surrounding quotes
        if (issuerName && typeof issuerName === 'string') {
            issuerName = issuerName.substring(1, issuerName.length - 1)
        }

        writeAccountProps({ctx, account: token.issuer, props: {name: issuerName}, source: 'ledger'})
    }
}

function updateTokenAndAccountProps({ctx, token, mptokenMetadata, overwriteAccountProps}) {
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
    if (overwriteAccountProps && Object.keys(props) != 0)
        writeAccountProps({ctx, account: token.issuer, props: {name: props.issuer_name}, source: 'ledger'})
}