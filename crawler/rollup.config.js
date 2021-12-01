import copy from 'rollup-plugin-copy'
import resolve from '@rollup/plugin-node-resolve'

export default [
	{
		input: './cli.js',
		plugins: [
			resolve({
				resolveOnly: ['@xrplmeta/common']
			}),
			copy({
				targets: [
					{src: 'package.json', dest: 'dist'},
					{src: 'config.toml', dest: 'dist'},
				]
			})
		],
		output: {
			file: './dist/crawler.js',
			format: 'esm',
			name: 'bundle'
		}
	}
]