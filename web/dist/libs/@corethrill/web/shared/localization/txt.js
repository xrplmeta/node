function getIndent(line){
	let indent = 0

	if(line.length <= 1)
		return [0, '']

	while(line.charAt(0) === '	'){
		line = line.slice(1)
		indent++
	}

	return [indent, line]
}

function parseLevel(lines, index, depth){
	let level = {}

	for(let i=index; i<lines.length; i++){
		let [indent, line] = getIndent(lines[i])

		if(!line)
			continue

		if(indent > depth)
			continue

		if(indent < depth)
			break

		let [key, text] = line.split(':')
		let [next_indent, _] = i<lines.length - 1 ? getIndent(lines[i+1]) : [0,0]

		if(text.charAt(0) === ' ')
			text = text.slice(1)

		if(next_indent > depth){
			level[key] = parseLevel(lines, i+1, next_indent)
		}else{
			level[key] = text.replace('\\n', '\n')
		}
	}

	return level
}

export default function(txt){
	let lines = txt.split('\n')
	return parseLevel(lines, 0, 0)
}