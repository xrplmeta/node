import DB from '@xrplmeta/db'
import * as modules from './modules.js'


export default config => {
	return new DB({
		...config,
		file: `${config.data.dir}/meta.db`,
		modules,
		journalMode: 'WAL',
		readonly: config.readonly
	})
}