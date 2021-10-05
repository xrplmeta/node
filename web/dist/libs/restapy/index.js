import { URLSearchParams } from './url.js'

export default class Api{
	constructor(config){
		this.config = config || {}
		this.fetchMethod = config.fetch || (typeof fetch !== 'undefined' ? fetch.bind(window) : null)
	}

	extend(props){
		let config = {}

		config.base = props.base.indexOf('http')===0 ? props.base : ((this.config.base ? this.config.base+'/' : '')+props.base)
		config.data = Object.assign({}, this.config.data || {}, props.data || {})
		config.headers = Object.assign({}, this.config.headers || {}, props.headers || {})

		return new this.constructor(config)
	}

	get(...args){
		return this.makeRequest('get', ...args)
	}

	post(...args){
		return this.makeRequest('post', ...args)
	}

	delete(...args){
		return this.makeRequest('delete', ...args)
	}

	
	makeRequest(method, route, data, options){
		data = this.mergeData(data || {})
		options = options || {}
		let headers = options.headers || {}

		let url = this.getURL(route)
		let req = {
			method: method,
			headers: Object.assign(
				{
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				Object.assign({}, this.config.headers || {}, headers)
			)
		}

		if(method === 'get'){
			let query = new URLSearchParams(data).toString()

			if(query.length > 0)
				url += '?' + query
		}else{
			req.body = JSON.stringify(data)
		}

		return this.fetchMethod(url, req)
			.then(res => {
				if(options.raw){
					return res
				}

				if (!res.ok) {
					let error = new Error(`HTTP ${res.status}`)

					error.httpCode = res.status

					return res.json()
							.then(data => {
								Object.assign(error, data)
								throw error
							})
				}else{
					return res.json()
						.catch(err => null)
				}
			})
	}

	getURL(route){
		if(this.config.base)
			route = this.stripDoubleSlashes(this.config.base + '/' + route)

		return route
	}

	stripDoubleSlashes(str){
		return str.slice(0, 8) + str.slice(8).replace(/\/\//g,'/')
	}

	mergeData(data){
		if(!this.config.data)
			return data

		return Object.assign({}, data, this.config.data)
	}
}