import mithril from './mithril.js'
//import stream from './stream.js'

let patchCache = []
let rootCache = []

const coreExtensions = {
	view: (args, rnode) => {
		let node = args[0]
		let stack = [rnode]

		if(node.broadcast){
			while(stack.length > 0){
				let child = stack.shift()

				if(!child || typeof child !== 'object')
					continue

				child.broadcast = Object.assign({}, node.broadcast)
				Object.assign(child, child.broadcast)

				if(child.children)
					stack = stack.concat(child.children)

				if(node.ctx && node.ctx.t){
					if(typeof child.text === 'string' && child.text.charAt(0) === '@'){
						child.text = node.ctx.t(child.text.slice(1))
					}else if(child.tag === '#' && typeof child.children === 'string' && child.children.charAt(0) === '@'){
						child.children = node.ctx.t(child.children.slice(1))
					}
				}
			}
		}

		return rnode
	},
	oninit: (args, ret) => {
		let node = args[0]
		let waitFor = args[1]

		if(ret instanceof Promise){
			node.state.loading = true

			ret = ret.then(() => node.state.loading = !!node.state._internalLoading)

			if(waitFor)
				waitFor(ret)
			else{
				ret = ret.then(() => m.redraw())
			}
		}

		return ret
	}
}

function applyPatch(module, patches, pre){
	Object.keys(patches).forEach(key => {
		let org = module[key]

		module[key] = function(node){
			if(pre){
				patches[key].call(this, node)

				if(org)
					return org.apply(this, arguments)
			}else{
				return patches[key].call(this, arguments, 
					org ? org.apply(this, arguments) : undefined)
			}
		}
	})

	return module
}

function patchModule(module, patches, pre){
	if(typeof module === 'object'){
		return applyPatch(Object.assign({}, module), patches, pre)
	}else if(typeof module === 'function'){
		let org = module

		if(module.prototype && module.prototype.view){
			module = function(){}
			module.prototype = applyPatch(org.prototype, patches, pre)
			return module
		}else{
			return (...args) => applyPatch(org.apply(null, args), patches, pre)
		}
	}else{
		return module
	}
}

function patchModuleCached(module, patches, pre){
	let cache = patchCache.find(c => c.org === module && c.patches === patches)

	if(cache)
		return cache.patched

	let patched = patchModule(module, patches, pre)

	patchCache.push({org: module, patches, patched})

	return patched
}

function patchRoot(module, deps){
	let org = module
	let cache = rootCache.find(c => c.org === org && c.deps === deps)

	if(cache)
		return cache.patched

	module = patchModule(module, coreExtensions)
	module = patchModule(module, {
		oninit: node => {
			Object.assign(node, deps, {broadcast: deps})
		}
	}, true)

	rootCache.push({org, patched: module, deps})

	return module
}

function m(selector, attrs, ...children){
	if(attrs && attrs.classes){
		attrs.class = attrs.classes.filter(c => c).join(' ')
		delete attrs.classes
	}

	if(children.length <= 1){
		children = children[0]
	}

	if(selector === 'a'){
		if(attrs && attrs.href && attrs.href.charAt(0) !== '#'){
			selector = mithril.route.Link
		}
	}

	return mithril(
		typeof selector === 'string' ? selector : patchModuleCached(selector, coreExtensions), 
		attrs, 
		children
	)
}

Object.assign(m, mithril)

//m.stream = stream


m.route = function(root, defaultRoute, routes, deps){
	routes = Object.entries(routes).reduce((r, [route, module]) => {
		if(typeof module === 'function' || module.view){
			r[route] = patchRoot(module, deps)
		}else{
			r[route] = applyPatch(module, {
				onmatch: (args, ret) => patchRoot(ret, deps),
				render: (args, ret) => {
					Object.assign(ret, deps, {broadcast: deps})
					return ret
				}
			})
		}

		return r
	}, {})

	mithril.route.call(m, root, defaultRoute, routes)
}

Object.assign(m.route, mithril.route)
Object.defineProperty(m.route, 'prefix', {
	get: () => mithril.route.prefix,
	set: prefix => mithril.route.prefix = prefix,
})

m.route.Link = {
	view: node => {
		Object.assign({}, node.attrs, {
			onclick: e => {
				let scrollSnapshot = {
					window: window.scrollY,
					containers: {}
				}

				Array.from(document.querySelectorAll('*')).forEach(el => {
					if(el.dataset.scrollId){
						scrollSnapshot.containers[el.dataset.scrollId] = el.scrollTop
					}
				})

				window.scrollSnapshots[m.route.get()] = scrollSnapshot

				if(node.attrs.onclick){
					node.attrs.onclick(e)
				}
			}
		})

		return mithril.route.Link.view(node)
	}
}

m.route.Router = {
	view: node => {
		let path = node.ctx.route.current.path.trimRight('/')
		let routes = node.attrs.routes
		let match = Object.entries(routes).find(([route, component]) => {
			if(route.trimRight('/') === path)
				return true
		})
		let component = match[1]

		return m(component)
	}
}

m.mount = function(element, Component){
	Component = patchModuleCached(Component, coreExtensions)
	mithril.mount.call(m, element, Component)
}

const ct = m

export { ct, patchModule, applyPatch, patchModuleCached }