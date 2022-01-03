import fs from 'fs'
import init from '@xrplmeta/repo'


export default (file, inMemory) => {
	if(file !== ':memory:')
		if(fs.existsSync(file))
			fs.unlinkSync(file)

	return init({
		file,
		journalMode: 'MEMORY',
		cacheSize: 10000
	})
}