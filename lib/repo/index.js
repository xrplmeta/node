import DB from '../db.js'
import * as modules from './modules.js'


export default config => new DB({
	journalMode: 'WAL',
	file: `${config.data?.dir}/repo.db`,
	...config,
	modules
})