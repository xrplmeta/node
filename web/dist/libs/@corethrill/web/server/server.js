import './mock.js'
import { c, ModelRegistry, BaseModel } from '@corethrill/core'
import fs from 'fs'
import pu from 'path'
import Koa from 'koa'
import Router from '@koa/router'
import serve from 'koa-static'
import mount from 'koa-mount'
import parse from 'koa-body'
import toHTML from './render.js'
import Layout from './layout.js'
import State from '../shared/state.js'
import Volatile from '../shared/volatile.js'
import Rest from './rest.js'
import I18n from '../shared/localization/i18n.js'
import I18nParse from '../shared/localization/parse.js'
import fetch from 'isomorphic-fetch'
import netpath from './netpath.js'
import beautify from 'js-beautify'


export default class Server{
	constructor(blueprint){
		this.log('starting...')

		this.blueprint = blueprint
		this.errorHandlers = []
		this.models = []
		this.setup()
		this.build()
	}

	setup(){
		let load = function(path){
			if(this.cache && this.cache[path])
				return this.cache[path]

			let content = fs.readFileSync(path).toString()

			if(this.cache)
				this.cache[path] = content

			return content
		}

		this.assets = {
			styles: {
				load,
				cache: this.blueprint.assets.styles?.cache !== false ? {} : null,
				global: [
					...(this.blueprint.assets.styles?.global || [])
						.map(f => netpath.join(this.blueprint.assets.styles?.dir || '' , f))
				]
			},
			scripts: {
				load,
				cache: this.blueprint.assets.scripts?.cache !== false ? {} : null,
				global: [
					this.blueprint.assets.client,
					...(this.blueprint.assets.scripts?.global || [])
						.map(f => netpath.join(this.blueprint.assets.scripts?.dir || '' , f))
				]	
			},
			icons: {
				serveDir: this.blueprint.assets.icons?.dir,
				global: [
					...(this.blueprint.assets.icons?.global || [])
						.map(icon => ({
							...icon, 
							file: netpath.join(this.blueprint.assets.icons?.dir || '', icon.file),
							uri: netpath.join('/icons', icon.file)
						}))
				]	
			}
		}
	}

	async build(){
		this.koa = new Koa()
		this.router = new Router()

		for(let [route, thing] of Object.entries(this.blueprint.routes)){
			if(typeof thing === 'string'){
				this.serveStatic(route, thing)
			}else if(thing.view){
				this.servePage(route, thing)
			}else if(thing.prototype instanceof BaseModel){
				this.serveModel(route, thing)
			}else if(thing){
				this.mountResolver(route, thing)
			}
		}

		if(this.assets.icons.serveDir){
			this.serveStatic('/icons', this.assets.icons.serveDir)
		}

		let port = this.blueprint.server?.port || 80

		if(this.blueprint.server?.behindProxy){
			this.koa.use(async (ctx, next) => {
				ctx.state.ip = ctx.headers['x-forwarded-ip'] || ctx.headers['X-Forwarded-Ip'] || ctx.ip

				return await next(ctx)
			})
		}

		this.koa.use(async (ctx, next) => {
			try{
				ctx.state.exposed = {}
				
				return await next(ctx)
			}catch(e){
				for(let {handler, error} of this.errorHandlers){
					if( e instanceof error){
						await handler(ctx, e)
						return
					}
				}

				if(e.expose){
					ctx.status = e.statusCode || 400
					ctx.body = e
				}else if(!e.statusCode || e.statusCode === 500){
					ctx.status = 500
					ctx.body = {message: `Internal Server Error`}

					this.error('internal error occured at:', ctx.path, '\n', e)
				}else{
					ctx.status = e.statusCode
					ctx.body = {message: `HTTP Error ${e.statusCode}`}
				}
			}
		})
		this.koa.use(this.router.routes(), this.router.allowedMethods())
		this.server = this.koa.listen(port)
		this.log('listening on port', port)
	}


	serveStatic(route, dest){
		this.router.all(route + '/(.*)', mount(route, serve(dest)))
		this.log('serving', dest, 'on', route)
	}

	servePage(route, component){
		this.router.get(route, async ctx => {
			let context = {
				page: {
					title: undefined,
					status: 200,
					meta: [
						{charset: 'utf-8'},
						{name: 'viewport', content: 'width=device-width, initial-scale=1, shrink-to-fit=no'}
					],
					styles: this.assets.styles.global.map(path => ({
						inline: true, 
						content: this.assets.styles.load(path)
					})),
					scripts: this.assets.scripts.global.map(path => ({
						inline: true, 
						content: this.assets.scripts.load(path)
					})),
					icons: this.assets.icons.global.map(icon => ({
						rel: icon.type,
						href: icon.uri
					})),
					goto: (route, opts) => {
						ctx.redirect(route)
					}
				},
				api: new Rest({
					base: 'http://localhost:' + this.blueprint.server.port,
					headers: {
						'x-forwarded-ip': ctx.request.headers['x-forwarded-ip'] || ctx.ip,
						'cookie': ctx.request.headers['cookie']
					}
				}),
				cookies: {
					get: ctx.cookies.get.bind(ctx.cookies), 
					set: (key, value, opts) => {
						ctx.cookies.set(key, value, {
							httpOnly: opts.httpOnly === undefined ? false : opts.httpOnly, 
							...opts
						})
					}
				},
				state: new State(ctx.state.exposed),
				volatile: new Volatile(),
				i18n: null,
				redraw: () => {},
				isServer: true,
			}

			context.models = new ModelRegistry(context, this.models)

			let contentVDom = c(component, {...ctx.params, ...ctx.query, ctx: context})
			let contentHTML

			try{
				contentHTML = await toHTML(contentVDom)
			}catch(e){
				this.error('error while rendering page at', ctx.path, '\n', e)
			}

			if(ctx.status === 301 || ctx.status === 302)
				return

			context.state.prefetched = context.api.cache

			let pageVDom = c(Layout, {ctx: context}, c.trust(contentHTML))
			let pageHTML = await toHTML(pageVDom)

			if(this.blueprint.server.pretty){
				pageHTML = beautify.html(pageHTML, {
					indent_with_tabs: true,
					content_unformatted: ['script', 'style'],
				})
			}

			ctx.status = context.page.status
			ctx.body = pageHTML
		})

		this.log('mounted', 'page', 'on', route)
	}



	serveModel(route, model){
		this.models.push({route, model})

		if(model.server?.routes){
			for(let {path, method, handler} of model.server.routes){
				if(method === 'post'){
					this.router[method](netpath.join(route, path), parse())
				}

				this.router[method](netpath.join(route, path), async ctx => {
					try{
						let state = {ctx, ...ctx.params}

						if(model.server.instantiate){
							await model.server.instantiate.call(state, ctx)
						}

						ctx.body = await handler.call(state, ctx)
					}catch(e){
						if(e instanceof Error){
							throw e
						}else{
							ctx.status = e.status || 400
							ctx.body = e
						}
					}
				})
			}
		}

		this.log('mounted', 'model', 'on', route)
	}

	mountResolver(route, resolver){
		if(route === '*')
			route = '(.*)'

		if(resolver.middleware){
			this.router.all(route, resolver.middleware)
		}

		this.log('mounted', 'resolver', 'on', route)
	}


	shutdown(){
		this.server.close()
	}

	log(...args){
		console.log('[\x1b[32mserver\x1b[0m]', ...args)
	}

	error(...args){
		console.error('[\x1b[31mserver\x1b[0m]', ...args)
	}
}



/*
c.route.prefix = ''

export default class Server{
	constructor(blueprint){
		this.log('starting...')

		this.koa = new Koa()
		this.blueprint = blueprint
		this.routes = blueprint.routes
		this.router = new Router()
		this.layout = ServerLayout
		this.handlers = []
		
		
		this.initAssets()
		this.initClient()
		this.initLocalization()
		this.initModels()
		this.initApi()
		this.initRoutes()

		this.koa.use(parse({
			multipart: true,
			formidable: {
				multiples: false,
				maxFields: 100,
				maxFieldsSize: (20 * 1024 * 1024)
			}
		}))

		this.koa.use(async (ctx, next) => {
			try{
				ctx.state.exposed = {}
				return await next(ctx)
			}catch(e){
				for(let {handler, error} of this.handlers){
					if( e instanceof error){
						await handler(ctx, e)
						return
					}
				}

				if(e.expose){
					ctx.status = e.statusCode || 400
					ctx.body = e
				}else if(!e.statusCode || e.statusCode === 500){
					ctx.status = 500
					ctx.body = {message: `Internal Server Error`}

					this.log('internal error occured at:', ctx.path, 
						'\n       >', e.message,
						'\n       >', e.stack,
					)
				}else{
					ctx.status = e.statusCode
					ctx.body = {message: `HTTP Error ${e.statusCode}`}
				}
			}
		})

		Object.assign(this.clientConfig, blueprint.config)

		this.routerMiddleware = this.router.routes()
		this.koa.use(this.routerMiddleware, this.router.allowedMethods())

		Promise.resolve()
			.then(() => blueprint.server.configure ? blueprint.server.configure(this) : 0)
			.then(() => {
				this.httpServer = this.koa.listen(blueprint.server.port)
				this.log('listening on port', blueprint.server.port)
			})
	}

	initAssets(){
		this.assets = Object.assign({}, this.blueprint.assets, {
			endpoint: '/res',
			loader: new AssetsLoader(this.blueprint.assets)
		})

		if(this.assets.icons){
			let path = this.assets.endpoint + '/icons'
			
			this.serve(path, this.assets.icons.dir)
		}
	}

	initClient(){
		this.clientConfig = {
			server: {
				api: {endpoint: null}
			}
		}
	}

	initLocalization(){
		this.corpusCache = {}

		if(!this.blueprint.localization || (!this.blueprint.localization.allowed && !this.blueprint.localization.default)){
			this.blueprint.localization = null
			return
		}

		if(!this.blueprint.localization.allowed)
			this.blueprint.localization.allowed = [this.blueprint.localization.default]

		this.blueprint.localization.allowed.forEach(lang => {
			if(!this.blueprint.assets.languages[lang]){
				throw 'missing language file for language "'+lang+'"'
			}

			if(this.blueprint.localization.cache !== false){
				this.corpusCache[lang] = this.getCorpus(lang)
				this.log('loaded localization corpus ('+lang+') into cache')
			}
		})

		this.clientConfig.localization = this.blueprint.localization
	}

	getCorpus(lang){
		if(!lang)
			return null

		if(!this.blueprint.localization)
			return null

		if(this.corpusCache[lang])
			return this.corpusCache[lang]

		let path = this.blueprint.assets.languages[lang]
		let src = fs.readFileSync(path).toString()
		let def = path.endsWith('.yml') 
			? I18nParse.yaml(src) 
			: I18nParse.text(src)

		
		return new I18n().define(def)
	}

	initApi(){
		let config = this.blueprint.api || {}
		let endpointPath = config.path || '/api'

		this.api = new Router()
		this.clientConfig.server.api.endpoint = endpointPath

		if(config.configure){
			config.configure(this.api)
		}

		for(let [key, model] of Object.entries(this.models.server)){
			for(let route of model.server.routes){
				this.api[route.method](netpath.join('/', key, route.path), async ctx => {
					try{
						let state = {ctx}

						if(model.server.instantiate){
							await model.server.instantiate.call(state, ctx)
						}

						ctx.body = await route.handler.call(state, ctx)
					}catch(e){
						if(e instanceof Error){
							throw e
						}else{
							ctx.status = e.status || 400
							ctx.body = e
						}
					}
				})
			}
		}

		this.router.use(endpointPath, this.api.routes(), this.api.allowedMethods())
		this.log('mounted api on', endpointPath)
	}

	initModels(){
		this.models = {server: this.blueprint.models || {}}
		this.models.client = Object.entries(this.models.server)
			.map(([key, model]) => ({key, model: model.client}))
			.reduce((models, {key, model}) => {
				models[key] = model
				return models
			}, {})
	}

	initRoutes(){
		let localizationConfig = this.blueprint.localization || {}

		if(localizationConfig.allowed && localizationConfig.choice === 'path'){
			localizationConfig.allowed.forEach(lang => {
				Object.entries(this.routes).forEach(([route, module]) => {
					this.router.get('/' + lang + route, async (ctx, next) => 
						await this.servePage(ctx, module, lang))

					this.log('mounted', 'page', 'on', '/' + lang + route)
				})
			})

			Object.entries(this.routes).forEach(([route, module]) => {
				let dest = '/' + localizationConfig.default + route
				this.router.get(route, async ctx => ctx.redirect(dest))
				this.log('mounted redirect', route, 'to', dest)
			})
		}else{
			Object.entries(this.routes).forEach(([route, module]) => {
				this.router.get(route, async (ctx, next) => 
					await this.servePage(ctx, module, localizationConfig.default))

				this.log('mounted', 'page', 'on', route)
			})
		}
	}

	pre(middleware){
		this.koa.middleware.splice(2, 0, middleware)
	}

	serve(path, dest){
		this.log('serving', dest, 'on', path)
		this.koa.use(mount(path, serve(dest)))
	}

	redirect(path, dest){
		this.log('will redirect:', path, 'to', dest)
		this.koa.use(mount(path, async ctx => ctx.redirect(dest)))
	}

	tap(path, trigger){
		this.tapRouter = new Router()
		this.tapRouter.all(path, async (ctx, next) => {
			trigger(ctx)
			return await next(ctx)
		})
		this.koa.middleware.splice(
			this.koa.middleware.indexOf(this.routerMiddleware),
			0, this.tapRouter.routes())
	}

	handle(error, handler){
		this.handlers.push({error, handler})
	}

	async servePage(ctx, module, lang){
		let page = this.createPageDelegate(ctx)
		let config = Object.assign({lang: lang && !this.blueprint.localization.solo ? lang : null}, this.clientConfig)
		let state = new State(ctx.state.exposed)
		let volatile = new Volatile()
		let api = new Rest({
			base: 'http://localhost:' + this.blueprint.server.port + this.clientConfig.server.api.endpoint,
			headers: {
				'x-forwarded-ip': ctx.request.headers['x-forwarded-ip'] || ctx.ip,
				'cookie': ctx.request.headers['cookie']
			}
		})
		let corpus = this.getCorpus(lang)
		let cookies = {
			get: ctx.cookies.get.bind(ctx.cookies), 
			set: (key, value, opts) => {
				ctx.cookies.set(key, value, {
					httpOnly: opts.httpOnly === undefined ? false : opts.httpOnly, 
					...opts
				})
			}
		}
		let redraw = () => {}
		let context = {api, state, volatile, page, corpus, config, lang, cookies, redraw}
		let attrs = Object.assign({}, ctx.params, ctx.query, {ctx: context})
		
		context.isServer = true
		context.t = context.corpus
		context.models = new ModelRegistry(context, this.models.client)

		let p = c(module, attrs)
		let contentHTML = await toHTML(p)

		state.prefetched = api.cache

		let pageHTML = await Promise.resolve()
			.then(() => c(this.layout, {page, state, config, corpus}, c.trust(contentHTML)))
			.then(toHTML)

		if(ctx.status === 301 || ctx.status === 302)
			return

		if(this.blueprint.server.pretty)
			pageHTML = beautify.html(pageHTML, {
				indent_with_tabs: true,
				content_unformatted: ['script', 'style'],
			})

		ctx.status = page.status
		ctx.body = pageHTML
	}

	createPageDelegate(ctx){
		let page = {
			title: undefined,
			status: 200,
			meta: [],
			styles: [],
			scripts: [],
			icons: [],
			goto: (route, opts) => {
				ctx.redirect(route)
			}
		}

		if(this.assets.styles && this.assets.styles.global && this.assets.styles.global.length > 0){
			page.styles.push(...this.assets.styles.global.map(style => (
				{inline: true, content: this.assets.loader.getStyle(style)}
			)))
		}

		if(this.assets.scripts && this.assets.scripts.global && this.assets.scripts.global.length > 0){
			page.scripts.push(...this.assets.scripts.global.map(script => (
				{inline: true, content: this.assets.loader.getScript(script)}
			)))
		}

		if(this.assets.icons && this.assets.icons.list){
			page.icons.push(...this.assets.icons.list.map(icon => ({
				rel: icon.type,
				href: this.assets.endpoint + '/icons/' + icon.file
			})))
		}

		page.scripts.push({inline: true, content: this.assets.loader.getScript(this.blueprint.assets.client)})
		page.meta.push({charset: 'utf-8'})
		page.meta.push({name: 'viewport', content: 'width=device-width, initial-scale=1, shrink-to-fit=no'})

		return page
	} 

	shutdown(){
		this.httpServer.close()
	}

	log(...args){
		console.log.apply(console.log, ['[server]'].concat(args))
	}
}


class AssetsLoader{
	constructor(config){
		this.config = Object.assign({scripts:{}, styles:{}}, config)
		this.cache = {}
	}

	get(type, file){
		if(this.cache[file])
			return this.cache[file]

		let dir = file.charAt(0) === '!' ? null : (this.config[type].dir || '')
		let fl = file.charAt(0) === '!' ? file.slice(1) : file
		let pth = dir ? path.join(dir, fl) : fl
		let content = fs.readFileSync(pth).toString()

		if(this.config[type].cache !== false)
			this.cache[file] = content

		return content
	}

	getScript(file){
		return this.get('scripts', file)
	}

	getStyle(file){
		return this.get('styles', file)
	}
}
*/