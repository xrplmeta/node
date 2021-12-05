import DB from '../lib/db.js'
import * as modules from './repo/index.js'


export default config => {
	return new DB({
		file: `${config.data.dir}/meta.db`,
		modules,
		journalMode: 'WAL',
		readonly: config.readonly
	})
}