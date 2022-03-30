import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { exec as compile } from 'pkg'
import { rollup } from 'rollup'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
import natives from 'rollup-plugin-natives'
import gulp from 'gulp'

const entries = [
	'../crawler/crawler.js',
	'../server/server.js'
]

const nativeModules = [
	'better-sqlite3'
]

const state = {
	modules: []
}


async function createNodeBundles(){
	for(let entry of entries){
		let entryDir = path.dirname(entry)
		let entryName = path.basename(entry)
		let outputFile = path.join('bundles', 'node', entryName)

		let bundle = await rollup({
			input: entry,
			plugins: [
				resolve({
					preferBuiltins: true,
					resolveOnly: [/@xrplmeta.*/]
				})
			]
		})

		let { output } = await bundle.write({
			format: 'es',
			file: outputFile
		})

		state.modules.push(...Object.keys(output[0].modules))
	}
}

async function createIntermediateBundles(){
	for(let entry of entries){
		let entryDir = path.dirname(entry)
		let entryName = path.basename(entry)
		let outputFile = path.join('intermediate', entryName)

		let bundle = await rollup({
			input: entry,
			inlineDynamicImports: true,
			external: nativeModules,
			plugins: [
				transform(),
				resolve({
					preferBuiltins: true,
					skip: nativeModules
				}),
				commonjs(),
				json()
			],
			//onwarn: () => null
		})

		let { output } = await bundle.write({
			format: 'cjs',
			file: outputFile
		})
	}
}

async function compileBinaries(){
	let platform = process.platform
	let platformDir = path.join('bundles', platform)
	let binaryExt = platform === 'win32'
		 ? '.exe'
		 : ''

	for(let entry of entries){
		let { name } = path.parse(entry)

		let bundleFile = path.join('intermediate', `${name}.js`)
		let binaryFile = path.join(platformDir, `${name}${binaryExt}`)

		await compile([
			bundleFile, 
			'--target', `${platform}`,
			'--config', path.join('intermediate', 'package.json'),
			'--output', binaryFile
		])
	}
}

async function createNodeDescriptor(){
	let root = path.resolve('..')
	let descriptor = {
		name: 'xrplmeta',
		type: 'module',
		dependencies: {}
	}

	let sourceDescriptors = state.modules.map(
		modulePath => path.join(
			'..',
			path.resolve(modulePath)
				.slice(root.length + 1)
				.split(path.sep)
				[0],
			'package.json'
		)
		
	)

	for(let descriptorPath of sourceDescriptors){
		let part = JSON.parse(fs.readFileSync(descriptorPath))

		descriptor = {
			...descriptor,
			version: part.version,
			dependencies: {
				...descriptor.dependencies,
				...part.dependencies
			}
		}
	}

	for(let k in descriptor.dependencies){
		if(/^@xrplmeta/.test(k))
			delete descriptor.dependencies[k]
	}

	fs.writeFileSync(
		path.join('bundles', 'node', 'package.json'), 
		JSON.stringify(descriptor, null, 4)
	)
}

async function createIntermediateDescriptor(){
	fs.writeFileSync(
		path.join('intermediate', 'package.json'),
		JSON.stringify({
			pkg: {
				assets: [
					'node_modules/better-sqlite3/build/Release/*'
				]
			}
		})
	)
}

async function copyNativeExtensions(){
	gulp.src('../db/node_modules/better-sqlite3/**')
		.pipe(gulp.dest(`./intermediate/node_modules/better-sqlite3/`))
}

async function copyTemplates(){
	gulp.src('./templates/**')
		.pipe(gulp.dest(`./bundles/node/`))
		.pipe(gulp.dest(`./bundles/${process.platform}/`))
}


function transform(){
	return {
		transform: code => {
			if(/^await/gm.test(code)){
				let lines = code.split('\n')
				let firstAwaitIndex = lines.findIndex(line => line.startsWith('await'))

				if(firstAwaitIndex === -1)
					return code

				code = [
					...lines.slice(0, firstAwaitIndex - 1),
					`;(async () => {`,
					...lines.slice(firstAwaitIndex - 1),
					`})()`
				]
					.join('\n')
			}
	
			return code
				.replace(/fileURLToPath\(import\.meta\.url\)/g, '__filename')
		}
	}
}

export default gulp.series(
	createNodeBundles,
	createNodeDescriptor,
	createIntermediateBundles,
	createIntermediateDescriptor,
	copyNativeExtensions,
	compileBinaries,
	copyTemplates
)