import DB from '@xrplmeta/db'
import * as modules from './modules.js'


export default config => new DB({
	journalMode: 'WAL',
	file: `${config.data?.dir}/meta.db`,
	...config,
	modules
})