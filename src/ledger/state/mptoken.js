import { writeBalance } from "../../db/helpers/balances.js"
import { readTokenMetrics, writeTokenMetrics } from "../../db/helpers/tokenmetrics.js"
import { eq, gt, sum, sub } from "@xrplkit/xfl"
import { accountFromMPTIssuanceId } from "../../xrpl/mpt.js"
import TokenType from "../../xrpl/tokentype.js"

export function parse({ entry }){
    return {
        account: entry.Account,
        mptAmount: entry.MPTAmount || 0,
        mptIssuanceId: entry.MPTokenIssuanceID,
        ledgerSequence: entry.LedgerSequence
    }
}

export function diff({ ctx, previous, final }){
    if (ctx.backwards)
        return

    let account = final?.account || previous?.account
    let mptIssuanceId = final?.mptIssuanceId || previous?.mptIssuanceId
    let issuer = accountFromMPTIssuanceId(mptIssuanceId)

    let token = ctx.db.core.tokens.createOne({
        data: {
            issuer: {
                address: issuer
            },
            mptIssuanceId,
            tokenType: TokenType.MPT
        }
    })

    // Read current metrics
    let { holders, supply } = readTokenMetrics({
        ctx,
        token,
        metrics: { holders: true, supply: true },
        ledgerSequence: ctx.ledgerSequence
    })

    let metrics = {
        holders: holders || 0,
        supply: supply || 0,
    }

    // Update metrics based on MPTAmount changes
    if(previous && final){
        // Modified: update supply, check holder status changes
        if (previous.mptAmount === final.mptAmount) {
            previous.mptAmount = 0
        }
        metrics.supply = sum(
            metrics.supply,
            sub(final.mptAmount, previous.mptAmount)
        )

        if(eq(previous.mptAmount, 0) && gt(final.mptAmount, 0)){
            metrics.holders++
        }else if(eq(final.mptAmount, 0) && gt(previous.mptAmount, 0)){
            metrics.holders--
        }
    }else if(final){
        // Created: increment holders if MPTAmount > 0
        metrics.supply = sum(metrics.supply, final.mptAmount)

        if(gt(final.mptAmount, 0)){
            metrics.holders++
        }
    }else{
        // Deleted: decrement holders if MPTAmount was > 0
        metrics.supply = sub(metrics.supply, previous.mptAmount)

        if(gt(previous.mptAmount, 0)){
            metrics.holders--
        }
    }

    // Write balance
    if(final){
        writeBalance({
            ctx,
            account: { address: account },
            token,
            ledgerSequence: final.ledgerSequence,
            balance: final.mptAmount,
        })
    }else{
        writeBalance({
            ctx,
            account: { address: account },
            token,
            ledgerSequence: ctx.ledgerSequence,
            balance: 0,
        })
    }

    // Write metrics
    writeTokenMetrics({ ctx, token, metrics, ledgerSequence: ctx.ledgerSequence })
}
