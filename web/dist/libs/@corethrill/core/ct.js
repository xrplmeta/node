import m from './thrill/index.js'

function c(selector, attrs, ...children){
	if(attrs && attrs.classes){
		attrs.class = attrs.classes.filter(c => c).join(' ')
		delete attrs.classes
	}

	if(children.length <= 1){
		children = children[0]
	}

	if(selector === 'a'){
		if(attrs && attrs.href && attrs.href.charAt(0) !== '#'){
			selector = m.route.Link
		}
	}else if(selector === 'frag'){
		selector = '['
	}

	return m(selector, attrs, children)
}

Object.assign(c, m)

c.hooks.addPost('view', (ret, node) => {
	if(node.ctx){
		let stack = [ret]

		while(stack.length > 0){
			let v = stack.pop()

			if(!v || typeof v !== 'object')
				continue

			v.ctx = node.ctx

			if(node.ctx && node.ctx.t){
				if(typeof v.text === 'string' && v.text.charAt(0) === '@'){
					v.text = node.ctx.t(v.text.slice(1))
				}else if(v.tag === '#' && typeof v.children === 'string' && v.children.charAt(0) === '@'){
					v.children = node.ctx.t(v.children.slice(1))
				}
			}


			if(v.children && typeof v.children === 'object'){
				if(Array.isArray(v.children))
					stack.push(...v.children)
				else
					stack.push(v.children)
			}
		}
	}

	return ret
})

export default c