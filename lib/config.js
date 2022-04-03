import fs from 'fs'
import path from 'path'
import log from './log.js'
import { load as loadToml } from './toml.js'


export function load(file, createIfMissing){
	if(!fs.existsSync(file)){
		log.warn(`no config at "${file}" - creating new from template`)

		if(createIfMissing)
			create(file)
	}

	let config = loadToml(file)

	// constraint checks here

	return config
}

export function create(file){
	let dir = path.dirname(file)
	let root = path.dirname(process.argv[1])
	let templatePath = path.join(root, 'release', 'templates', 'config.toml')
	let template = fs.readFileSync(templatePath, 'utf-8')
	let customizedTemplate = template
		.replace(
			'#dir = "<path>"', 
			`dir = "${dir.replace(/\\/g, '\\\\')}"`
		)

	if(!fs.existsSync(dir))
		fs.mkdirSync(dir)

	fs.writeFileSync(file, customizedTemplate)
}

