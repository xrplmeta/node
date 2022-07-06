import { readTokenMetricSeries } from './utils.js'


export function serveTokenSeries(){
	return ({ ctx, token, sequence, time, metric, ...opts }) => {
		let interval = parseInt(opts.interval)
		let series

		if(!interval || interval <= 0){
			throw {
				type: `invalidParam`,
				message: `The 'interval' argument has to be greater than zero.`,
				expose: true
			}
		}

		if(metric === 'trustlines'){
			series = readTokenMetricSeries({
				ctx,
				table: 'tokenTrustlines',
				token,
				range: sequence,
				interval
			})
		}else if(metric === 'supply'){
			series = readTokenMetricSeries({
				ctx,
				table: 'tokenSupply',
				token,
				range: sequence,
				interval
			})
		}else{
			throw {
				type: `invalidParam`,
				message: `Invalid metric. Allowed values are: price, volume, trustlines, holders, supply, marketcap`,
				expose: true
			}
		}

		if(series.length === 0)
			return []

		series[0].ledgerSequence = Math.max(
			series[0].ledgerSequence,
			sequence.start
		)

		if(time){
			return series.map(
				point => ({
					time: ctx.db.ledgers.readOne({
						where: { 
							sequence: point.ledgerSequence 
						}
					}).closeTime, 
					value: point.value.toString() 
				})
			)
		}else{
			return series.map(
				point => ({
					sequence: Number(point.ledgerSequence), 
					value: point.value.toString() 
				})
			)
		}
	}
}
