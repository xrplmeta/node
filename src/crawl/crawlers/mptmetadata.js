import { parse as parseXLS89 } from '@xrplkit/xls89'
import { fetch as fetchMPTokenMetadata } from '../../xrpl/ledgerentry.js'
import TokenType from '../../xrpl/tokentype.js'
import { scheduleIterator } from '../schedule.js'
import {  writeTokenProps } from '../../db/helpers/props.js'

export default async function({ ctx }){
    let config = ctx.config.mptmetadata

    if (!config || config.disable){
        throw new Error(`disabled by config`)
    }

    while(true) {
        await scheduleIterator({
            ctx,
            type: 'token',
            task: 'mptmetadata',
            where: {
                tokenType: TokenType.MPT
            },
            interval: config.fetchInterval,
            concurrency: config.concurrency,
            routine: async (token) => {
                const result = await fetchMPTokenMetadata(
                    {ctx, sequence: 'validated', mptIssuanceId: token.mptIssuanceId}
                )

                if (!result.metadata)
                    return;
                
                let {token: props} = parseXLS89(result.metadata)

                writeTokenProps({
                    ctx,
                    token,
                    props,
                    source: `ledger/mptmetadata/${mptIssuanceId}`
                })
            }
        })
    }
}