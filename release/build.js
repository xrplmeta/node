import fs from 'fs'
import { rollup } from 'rollup'


fs.mkdirSync('./release/dist/bin', {recursive: true})
fs.mkdirSync('./release/dist/release/templates', {recursive: true})
fs.copyFileSync('./release/templates/config.toml', './release/dist/release/templates/config.toml')


let bundle = await rollup({
	input: './cli.js'
})

let { output } = await bundle.generate({
	format: 'es'
})

fs.writeFileSync(
	'./release/dist/bin/xrplmeta.js',
	`#!/usr/bin/env node\n\n`
	+ output[0].code
		.replace()
)

let devDescriptor = JSON.parse(
	fs.readFileSync('./package.json', 'utf-8')
)

let descriptor = {
	name: 'xrplmeta',
	type: 'module',
	version: devDescriptor.version,
	dependencies: devDescriptor.dependencies,
	bin: {
		xrplmeta: 'bin/xrplmeta.js'
	}
}

fs.writeFileSync(
	'./release/dist/package.json',
	JSON.stringify(descriptor, null, 4)
)