import fs from 'fs'
import init from './repo/index.js'


export default file => {
	if(file !== ':memory:')
		if(fs.existsSync(file))
			fs.unlinkSync(file)

	return init({
		file,
		journalMode: 'MEMORY',
		cacheSize: 10000
	})
}