import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { exec as compile } from 'pkg'
import { rollup } from 'rollup'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const platform = 'win'

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

let descriptor = {
	name: 'xrplmeta',
	type: 'module',
	dependencies: {}
}


async function createBundles(){
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
	}
}


async function createDescriptor(){
	for(let entry of entries){
		let descriptors = [
			path.join(path.dirname(entry), 'package.json'),
			...resolveOnly.map(name => 
				path.join('..', name.split('/')[1], 'package.json')
			)
		]

		descriptor = descriptors
			.map(file => JSON.parse(fs.readFileSync(file)))
			.reduce(
				(composite, descriptor) => ({
					...composite,
					dependencies: {
						...composite.dependencies,
						...descriptor.dependencies
					}
				}), 
				descriptor
			)
	}

	for(let name of resolveOnly){
		delete descriptor.dependencies[name]
	}

	fs.writeFileSync(
		path.join(__dirname, 'bundles', 'node', 'package.json'), 
		JSON.stringify(descriptor, null, 4)
	)

	console.log(`wrote composite package descriptor to ./bundles/node/package.json`)
}


async function createBinaries(){
	let intermediateDir = path.join(__dirname, 'intermediate')
	let platformDir = path.join(__dirname, 'bundles', platform)
	let nodeBunldeDir = path.join(__dirname, 'bundles', 'node')
	let descriptorPath = path.join(intermediateDir, 'package.json')
	let binaryExt = platform === 'win'
		 ? '.exe'
		 : ''

	let nodeBundles = fs.readdirSync(nodeBunldeDir)
		.filter(file => file.endsWith('.js'))
		.map(file => path.join(nodeBunldeDir, file))

	let intermediateDescriptor = {
		...descriptor,
		type: undefined,
		pkg: {
			assets: [
				'node_modules/better-sqlite3/build/Release/*'
			]
		}
	}

	if(!fs.existsSync(intermediateDir))
		fs.mkdirSync(intermediateDir)

	if(!fs.existsSync(platformDir))
		fs.mkdirSync(platformDir)

	fs.writeFileSync(
		descriptorPath, 
		JSON.stringify(intermediateDescriptor, null, 4)
	)
	
	try{
		execSync('npm i', {cwd: intermediateDir})
	}catch(e){
		console.log(`dependency install failed - compiling binary anyways`)
	}


	for(let bundleFile of nodeBundles){
		let { name } = path.parse(bundleFile)

		let outputFile = path.join(intermediateDir, `${name}.js`)
		let binaryFile = path.join(platformDir, `${name}${binaryExt}`)
		let code = fs.readFileSync(bundleFile, 'utf-8')
		let lines = code.split('\n')
		let firstAwaitIndex = lines.findIndex(line => line.startsWith('await'))
		let newLines = firstAwaitIndex >= 0
			? [
				...lines.slice(0, firstAwaitIndex - 1),
				`;(async () => {`,
				...lines.slice(firstAwaitIndex - 1),
				`})()`
			]
			: lines
		
		fs.writeFileSync(
			outputFile, 
			newLines
				.join('\n')
				.replace(/fileURLToPath\(import\.meta\.url\)/g, '__filename')
		)

		let bundle = await rollup({
			input: outputFile,
			plugins: [
				resolve({
					resolveOnly: [
						'node-fetch',
						'data-uri-to-buffer',
						'fetch-blob',
						'formdata-polyfill'
					]
				}),
				commonjs(),
				json()
			],
			inlineDynamicImports: true,
			onwarn: message => null
		})

		await bundle.write({
			format: 'cjs',
			file: outputFile
		})

		console.log(`transpiled node bundle at ${outputFile} for compilation`)


		await compile([outputFile, '--target', `node17-${platform}`, '--config', descriptorPath, '--output', binaryFile]);
	}
}


async function copyTemplates(){
	fs.copyFileSync('templates/crawler.toml', `bundles/node/crawler.toml`)
	fs.copyFileSync('templates/crawler.toml', `bundles/${platform}/crawler.toml`)
	fs.copyFileSync('templates/server.toml', 'bundles/node/server.toml')
	fs.copyFileSync('templates/server.toml', `bundles/${platform}/server.toml`)

	console.log(`copied config templates`)
}




await createBundles()
await createDescriptor()
await createBinaries()
await copyTemplates()