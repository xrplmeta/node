import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const schemas = {}

for(let file of fs.readdirSync(path.join(__dirname))){
	let { name, ext } = path.parse(file)

	if(ext === '.json')
		schemas[name] = JSON.parse(
			fs.readFileSync(
				path.join(__dirname, file)
			)
		)
}

export default schemas