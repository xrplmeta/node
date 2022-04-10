import fs from 'fs'
import { execSync } from 'child_process'

function construct(name){
	console.log(`installing database adapter for "${name}"`)
	execSync(`${process.argv[0]} node_modules/prisma/build/index.js migrate dev --schema database/${name}.prisma`)

	fs.unlinkSync(`database/templates/${name}.db-journal`)
}

process.env.SNAPSHOT_FILE = `file:templates/snapshot.db`
process.env.META_FILE = `file:templates/meta.db`

try{
	construct('snapshot')
	construct('meta')
}catch{
	throw `database setup failed. please check error messages above.`
}