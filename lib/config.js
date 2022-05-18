import os from 'os'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import log from '@mwni/log'
import { parse as parseToml } from '@xrplworks/toml'


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function find(){
	let preferredPath = path.join(os.homedir(), '.xrplmeta', 'config.toml')
	let paths = ['config.toml', preferredPath]

	for(let path of paths){
		if(fs.existsSync(path))
			return path
	}

	return preferredPath
}


export function load(file, createIfMissing){
	if(!fs.existsSync(file)){
		log.warn(`no config at "${file}" - creating new from template`)

		if(createIfMissing)
			create(file)
	}

	let content = fs.readFileSync(file, 'utf-8')
	let config = parseToml(content, 'camelCase')

	// schema checks here

	return config
}

export function create(file){
	let dir = path.dirname(file)
	let root = path.dirname(process.argv[1])
	let templatePath = path.join(__dirname, '../release/templates/config.toml')
	let template = fs.readFileSync(templatePath, 'utf-8')
	let customizedTemplate = template
		.replace(
			'# dir = "<path>"', 
			`dir = "${dir.replace(/\\/g, '\\\\')}"`
		)

	if(!fs.existsSync(dir))
		fs.mkdirSync(dir)

	fs.writeFileSync(file, customizedTemplate)
}

export function override(config, overrides){
	return config
}