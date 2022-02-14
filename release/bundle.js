import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { rollup } from 'rollup'
import resolve from '@rollup/plugin-node-resolve'


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const include = [
	'@xrplmeta/'
]


async function bundle(entry){
	console.log(`bundling ${entry}...`)

	let bundle = await rollup({
		input: entry,
		plugins: [
			resolve({
				resolveOnly: ['@xrplmeta/common']
			})
		]
	})



	let pkg = JSON.parse(fs.readFileSync('package.json'))
	let commonPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')))
	let name = pkg.name.split('/')[1]
	let outputFile = `./dist/${name}.js`
	let compositePkg = {
		...pkg,
		dependencies: {
			...commonPkg.dependencies,
			...pkg.dependencies,
			'@xrplmeta/common': undefined
		},
		scripts: undefined
	}

	console.log(`bundling ${name}...`)

	let bundle = await rollup({
		input: 'cli.js',
		plugins: [
			resolve({
				resolveOnly: ['@xrplmeta/common']
			})
		]
	})

	await bundle.write({
		format: 'es',
		file: outputFile
	})
	console.log(`wrote bundle to ${outputFile}`)

	fs.writeFileSync(`dist/package.json`, JSON.stringify(compositePkg, null, 4))
	console.log(`wrote composite package descriptor to ./dist/package.json`)

	fs.copyFileSync('config.toml', 'dist/config.toml')
	console.log(`copied config.toml`)
}

bundle('../crawler/crawler.js')
bundle('../server/server.js')