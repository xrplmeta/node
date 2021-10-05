import c from './ct.js'
import EventEmitter from './events.js'

export class ModelRegistry{
	constructor(ctx, routes){
		this.ctx = ctx
		this.cache = {}
		this.routes = routes.map(({route, model}) => ({
			route,
			model,
			check: c.pathname.compileTemplate(route),
		}))
	}

	get(p){
		for(let route of this.routes){
			let {path, params} = c.pathname.parse(p)

			if(route.check({path, params})){
				return () => Object.assign(
					new route.model(this.ctx),
					{
						ctx: this.ctx, 
						api: this.ctx.api.extend({base: path}),
						...params
					}
				)
			}
		}

		return null
	}

	new(route, params){
		let path = c.pathname.build(route, params)
		let ctor = this.get(path)

		if(!ctor)
			throw new Error(`no model exists at path "${route}"`)

		return ctor()
	}

	persistent(route, params){
		let path = c.pathname.build(route, params)

		if(this.cache[path])
			return this.cache[path]

		let model = this.new(route, params)

		this.cache[path] = model

		return model
	}

	instanceof(instance, id){
		for(let route of this.routes){
			let {path, params} = c.pathname.parse(c.pathname.build(id, {}))


			if(route.check({path, params})){
				return instance instanceof route.model
			}
		}

		return false
	}
}


export class BaseModel extends EventEmitter{
	assign(data){
		let overrides = {}

		if(this.assignMappers){
			for(let key of Object.keys(data)){
				for(let { mapper } of this.assignMappers.filter(m => m.key === key)){
					overrides[key] = mapper(overrides[key] || data[key])
				}
			}
		}

		Object.assign(this, data, overrides)
		return this
	}

	assignMap(key, mapper){
		if(!this.assignMappers){
			this.assignMappers = []
		}

		if(typeof mapper === 'string'){
			let route = mapper
			let arrayBased = route.charAt(0) === '[' && route.charAt(route.length-1) === ']'

			if(arrayBased)
				route = route.slice(1, -1)

			mapper = input => {
				if(this.ctx.models.instanceof(input, route))
					return input

				return this.ctx.models.new(route, input)
					.assign(input)
			}

			if(arrayBased){
				let singleMapper = mapper

				mapper = input => Array.isArray(input) ? input.map(i => singleMapper(i)) : singleMapper(i)
			}
		}

		this.assignMappers.push({key, mapper})
	}
}