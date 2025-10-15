import { parse as parseXLS89 } from '@xrplkit/xls89'
import { fetch as fetchMPTokenMetadata } from '../../xrpl/ledgerentry.js'
import TokenType from '../../xrpl/tokentype.js'
import { scheduleIteratorTemp } from '../schedule.js'
import {  clearTokenPropsTemp, writeTokenPropsTemp } from '../../db/helpers/props.js'

export default async function({ ctx }){
    let config = ctx.config.source.mptmetadata

    if (!config || config.disable){
        throw new Error(`disabled by config`)
    }

    while(true) {
        await scheduleIteratorTemp({
            ctx,
            type: 'token',
            task: 'mptmetadata',
            where: {
                tokenType: TokenType.MPT
            },
            interval: config.fetchInterval,
            concurrency: config.concurrency,
            routine: async ({ mptIssuanceId }) => {
                const result = await fetchMPTokenMetadata(
                    {ctx, sequence: 'validated', mptIssuanceId}
                )

                if (!result.metadata)
                    return;
                
                let {token: props} = parseXLS89(result.metadata)

                if(Object.keys(props).length === 0){
                    clearTokenPropsTemp({
                        ctx,
                        token: {
                            mptIssuanceId
                        },
                        source: `ledger/mptmetadata/${mptIssuanceId}`
                    })
                }else{
                    writeTokenPropsTemp({
                        ctx,
                        token: {
                            mptIssuanceId
                        },
                        props,
                        source: `ledger/mptmetadata/${mptIssuanceId}`
                    })
                }
            }
        })
    }
}