import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { rollup } from 'rollup'
import resolve from '@rollup/plugin-node-resolve'


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const resolveOnly = [
	'@xrplmeta/toml',
	'@xrplmeta/db',
	'@xrplmeta/repo',
	'@xrplmeta/log',
	'@xrplmeta/utils'
]

const entries = [
	'../crawler/crawler.js',
	'../server/server.js'
]

let composite = {
	name: 'xrplmeta',
	type: 'module',
	dependencies: {}
}


for(let entry of entries){
	console.log(`bundling ${entry}...`)

	let entryDir = path.dirname(entry)
	let entryName = path.basename(entry)
	let outputFile = path.join(__dirname, 'bundles', 'node', entryName)

	let bundle = await rollup({
		input: entry,
		plugins: [
			resolve({resolveOnly})
		]
	})

	await bundle.write({
		format: 'es',
		file: outputFile
	})

	console.log(`wrote bundle to ./bundles/node/${entryName}`)

	let descriptors = [
		path.join(entryDir, 'package.json'),
		...resolveOnly.map(name => path.join('..', name.split('/')[1], 'package.json'))
	]

	composite = descriptors
		.map(file => JSON.parse(fs.readFileSync(file)))
		.reduce(
			(composite, descriptor) => ({
				...composite,
				dependencies: {
					...composite.dependencies,
					...descriptor.dependencies
				}
			}), 
			composite
		)
}

for(let name of resolveOnly){
	delete composite.dependencies[name]
}


fs.writeFileSync(
	path.join(__dirname, 'bundles', 'node', 'package.json'), 
	JSON.stringify(composite, null, 4)
)

console.log(`wrote composite package descriptor to ./bundles/node/package.json`)


fs.copyFileSync('templates/crawler.toml', 'bundles/node/crawler.toml')
fs.copyFileSync('templates/server.toml', 'bundles/node/server.toml')

console.log(`copied config templates`)