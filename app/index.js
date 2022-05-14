import { fork } from 'nanotasks'
import NodePool from '../xrpl/pool.js'


const tasks = [
	'ledger/stream',
	'ledger/snapshot',
	'server'
]


export async function run({ config }){
	let xrpl = new NodePool({ config })

	for(let task of tasks){
		await fork({
			file: `./${task}.js`,
			args: { config, xrpl }
		})
	}
}