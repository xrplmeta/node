import hyperscript from './hyperscript/index.js'
import makeMount from './mount.js'
import makeRoute from './route.js'
import render from './render.js'
import Vnode from './vnode.js'
import hooks from './hooks.js'
import * as pathname from './pathname.js'

const mountSpace = makeMount()
const route = makeRoute(mountSpace)

export default function m() { 
	return hyperscript.apply(this, arguments) 
}

m.m = hyperscript
m.trust = hyperscript.trust
m.fragment = hyperscript.fragment
m.render = render
m.mount = mountSpace.mount
m.redraw = mountSpace.redraw
m.route = route
m.vnode = Vnode
m.hooks = hooks
m.pathname = pathname
