import { decodeAccountID, encodeAccountID } from "ripple-address-codec"
import log from '@mwni/log'
import TokenType from './tokentype.js'

export function isValidMPTIssuanceId(mptIssuanceId){
    return /^[A-Z0-9]{48}$/.test(mptIssuanceId)
}

export function issuerFromMPTIssuanceId(mptIssuanceId){
    const issuerHex = mptIssuanceId.slice(8)
    return encodeAccountID(Buffer.from(issuerHex, 'hex'))
}

export function mptIssuanceIdFromIssuerAndSequence(issuer, sequence){
    const sequenceBuffer = new Uint8Array(4)
    new DataView(sequenceBuffer.buffer).setUint32(0, sequence, false)

    const issuerBuffer = decodeAccountID(issuer)
    const combinedBuffer = Buffer.concat([Buffer.from(sequenceBuffer), issuerBuffer])

    return combinedBuffer.toString('hex').toUpperCase()
}

export function createMPTokenIssuancesFromTransactions({ ctx, ledger }){
    for(let tx of ledger.transactions){
        let meta = tx.meta || tx.metaData
        if(!meta?.AffectedNodes)
            continue

        for(let node of meta.AffectedNodes){
            let entry = node.CreatedNode || node.ModifiedNode || node.DeletedNode
            if(!entry || entry.LedgerEntryType !== 'MPTokenIssuance')
                continue

            let fields = entry.NewFields || entry.FinalFields
            ctx.db.core.tokens.createOne({
                data: {
                    issuer: { address: fields.Issuer },
                    mptIssuanceId: mptIssuanceIdFromIssuerAndSequence(fields.Issuer, fields.Sequence),
                    scale: fields.AssetScale ?? 0,
                    tokenType: TokenType.MPT
                }
            })
        }
    }
}

export async function createMissingMPTokenIssuanceFromObjects({ ctx, objects, ledgerSequence }){
    // Step 1: create Token entries from MPTokenIssuance objects in this chunk
    for(let obj of objects){
        if(obj.LedgerEntryType !== 'MPTokenIssuance')
            continue

        ctx.db.core.tokens.createOne({
            data: {
                issuer: { address: obj.Issuer },
                mptIssuanceId: mptIssuanceIdFromIssuerAndSequence(obj.Issuer, obj.Sequence),
                scale: obj.AssetScale ?? 0,
                tokenType: TokenType.MPT
            }
        })
    }

    // Step 2: collect MPToken references whose issuance is missing in Token table
    let missing = new Set()

    for(let obj of objects){
        if(obj.LedgerEntryType !== 'MPToken')
            continue

        let token = ctx.db.core.tokens.readOne({
            where: {
                mptIssuanceId: obj.MPTokenIssuanceID,
                tokenType: TokenType.MPT
            }
        })

        if(!token){
            missing.add(obj.MPTokenIssuanceID)
        }
    }

    // Step 3: fetch missing issuances from ledger and store
    for(let mptIssuanceId of missing){
        try{
            let { result } = await ctx.xrpl.request({
                command: 'ledger_entry',
                mpt_issuance_id: mptIssuanceId,
                ledger_index: ledgerSequence
            })
            log.warn(`fetched MPT issuance ${mptIssuanceId} from ledger #${ledgerSequence}`)

            ctx.db.core.tokens.createOne({
                data: {
                    issuer: { address: issuerFromMPTIssuanceId(mptIssuanceId) },
                    mptIssuanceId,
                    scale: result.node?.AssetScale ?? 0,
                    tokenType: TokenType.MPT
                }
            })
        }catch(error){
            log.error(`failed to fetch MPT issuance ${mptIssuanceId}: ${error.error || error.message}`)
        }
    }
}

