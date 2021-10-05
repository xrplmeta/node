import { c, ModelRegistry, BaseModel } from '@corethrill/core'
import Rest from './rest.js'
import State from '../shared/state.js'
import Volatile from '../shared/volatile.js'
import cookies from './cookies.js'
import I18n from '../shared/localization/i18n.js'


export default class{
	constructor(blueprint){
		this.ctx = {
			page: {
				title: undefined,
				status: 200,
				meta: [],
				styles: [],
				scripts: [],
				goto: (route, opts) => {
					c.route.set(route, null, opts)
				}
			},
			state: new State(STATE),
			volatile: new Volatile(),
			api: new Rest({}, STATE.prefetched, c.redraw),
			i18n: new I18n().define(typeof CORPUS === 'object' ? CORPUS : {}),
			cookies,
			redraw: c.redraw
		}

		Object.defineProperty(this.ctx.page, 'class', {
			set: function(cls){
				document.documentElement.className = cls
			}
		})

	
		let pages = Object.entries(blueprint.routes).filter(([route, thing]) => thing.view).map(([route, page]) => ({route, page}))
		let models = Object.entries(blueprint.routes).filter(([route, thing]) => thing.prototype instanceof BaseModel).map(([route, model]) => ({route, model}))
		let virtualRoutes = this.buildRoutes(pages)
		let defaultRoute = virtualRoutes.hasOwnProperty('/') ? '/' : Object.keys(virtualRoutes)[0]


		this.ctx.i = this.ctx.i18n
		this.ctx.models = new ModelRegistry(this.ctx, models)
		this.ctx.api.dispatch = () => c.redraw()

		//if(CONFIG.lang && CONFIG.localization.method === 'path')
		//	defaultRoute = '/' + CONFIG.lang + defaultRoute

		c.route.prefix = ''
		c.route(document.body, defaultRoute, virtualRoutes)

		document.documentElement.style.display = ''
	}

	buildRoutes(def){
		let routes = {}
		let current = {page: null, state: null, path: null}
		let delegateComponent = {
			oninit: node => {
				
			},
			oncreate: node => {
				if(current.page.oncreate){
					Object.assign(node.state, current.state)
					
					current.page.oncreate(node)

					Object.assign(current.state, node.state)
				}
			},
			view: node => {
				Object.assign(node.state, current.state)
				node.ctx = this.ctx

				let ret = current.page.view(node)
				let stack = [ret]

				while(stack.length > 0){
					let v = stack.pop()

					if(v && typeof v === 'object')
						v.ctx = this.ctx

					if(v && v.children)
						stack.push(...v.children)
				}

				Object.assign(current.state, node.state)

				return ret
			}
		}

		for(let {route, page} of def){
			routes[route] = {
				onmatch: (args, path, route) => {
					if(this.deriveDiffPath(path) !== this.deriveDiffPath(current.path)){
						current.page = page
						current.state = {}

						if(page.oninit){
							let ret = current.page.oninit({attrs: args, state: current.state, ctx: this.ctx})

							if(ret instanceof Promise)
								ret.then(this.ctx.redraw)
						}

						window.scrollTo(0, 0)
					}
					
					current.path = path

					return delegateComponent
				},
				render: node => node
			}
		}

		return routes
	}

	deriveDiffPath(path){
		if(!path)
			return null

		return path.split(/\?|\#/g)[0]
	}
}




var ocLink = c.route.Link

window.scrollSnapshots = {}

c.route.Link = {
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

		return ocLink.view(node)
	}
}



	/*oncreate: (args, ret) => {
			let node = args[0]
			let dom = node.dom
			let scrollSnapshot = scrollSnapshots[ct.route.get()]

			if(scrollSnapshot){
				Promise.resolve()
					.then(() => new Promise(resolve => setTimeout(resolve, 33)))
					.then(() => {
						window.scrollTo(0, scrollSnapshot.window)

						Object.entries(scrollSnapshot.containers).forEach(([key, pos]) => {
							let el = document.querySelector('[data-scroll-id="'+key+'"]')

							if(el)
								el.scrollTop = pos
						})
					})
			}

			return ret
		}***/
