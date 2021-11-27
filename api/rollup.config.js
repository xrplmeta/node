import copy from 'rollup-plugin-copy'

export default [
	{
		input: './cli.js',
		plugins: [
			copy({
				targets: [
					{src: 'package.json', dest: 'dist'},
					{src: 'config.toml', dest: 'dist'},
				]
			})
		],
		output: {
			file: './dist/api.js',
			format: 'esm',
			name: 'bundle'
		}
	}
]