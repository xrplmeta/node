import fs from 'fs'
import initRepo from '@xrplmeta/repo'


let repo = initRepo({
	data: {
		dir: 'V:/xrpl/xrplmeta'
	}
})


repo.tx(() => {
	
})