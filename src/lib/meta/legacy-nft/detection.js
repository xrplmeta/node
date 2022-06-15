import { eq, gt } from '@xrplkit/xfl'

const maxValue = '1000000000000000e-85'

export function detect(metrics){
	if(eq(metrics.supply, 0))
		return false

	if(gt(metrics.supply, maxValue))
		return false

	return true
}