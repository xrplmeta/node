import { parse as parseXLS89 } from '@xrplkit/xls89'
import { fetch as fetchMPTokenMetadata } from '../../xrpl/ledgerentry.js'
import TokenType from '../../xrpl/tokentype.js'
import { scheduleIteratorTemp } from '../schedule.js'

export default async function({ ctx }){
    let config = ctx.config.source.mptmetadata

    if (!config || config.disable) {
        throw new Error(`disabled by config`)
    }

    while(true) {
        await scheduleIteratorTemp({
            ctx,
            type: "token",
            task: "mptmetadata",
            where: {
                tokenType: TokenType.MPT
            },
            interval: config.fetchInterval,
            concurrency: ctx.config.source.mptmetadata.concurrency,
            routine: async ({ mptIssuanceId }) => {
                const result = await fetchMPTokenMetadata(
                    {ctx, sequence: "validated", mptIssuanceId}
                )

                if (!result.metadata)
                    return;
                
                try {
                    let resp = parseXLS89(result.metadata)
                    console.log(resp)
                } catch(err) {
                    console.log(err)
                }
            }
        })
    }

}