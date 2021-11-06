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
			file: './dist/cli.js',
			format: 'esm',
			name: 'bundle'
		}
	}
]