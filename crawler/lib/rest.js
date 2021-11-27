import { RateLimiter } from 'limiter'


export default class Rest{
	constructor(config){
		this.config = config || {}
		this.limiter = config.ratelimit ? new RateLimiter(config.ratelimit) : null
		this.fetch = config.fetch || (typeof fetch !== 'undefined' ? fetch.bind(window) : null)
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

	
	async makeRequest(method, route, data, options){
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

		for(let key of ['redirect']){
			if(!options[key])
				continue

			req[key] = options[key]
		}


		if(method === 'get'){
			let query = new URLSearchParams(data).toString()

			if(query.length > 0)
				url += '?' + query
		}else{
			req.body = JSON.stringify(data)
		}

		if(this.limiter)
			await this.limiter.removeTokens(1)

		return await this.fetch(url, req)
			.then(res => {
				if(options.raw){
					return res
				}

				if (!res.ok) {
					let error = new Error(`HTTP ${res.status}`)

					error.httpCode = res.status

					return res.text()
						.then(text => {
							try{
								Object.assign(error, JSON.parse(text))
							}catch{
								error.text = text
							}

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


export function URLSearchParams(query) {
	var
		index, key, value,
		pairs, i, length,
		dict = Object.create(null)
	;
	this[secret] = dict;
	if (!query) return;
	if (typeof query === 'string') {
		if (query.charAt(0) === '?') {
			query = query.slice(1);
		}
		for (
			pairs = query.split('&'),
			i = 0,
			length = pairs.length; i < length; i++
		) {
			value = pairs[i];
			index = value.indexOf('=');
			if (-1 < index) {
				appendTo(
					dict,
					decode(value.slice(0, index)),
					decode(value.slice(index + 1))
				);
			} else if (value.length){
				appendTo(
					dict,
					decode(value),
					''
				);
			}
		}
	} else {
		if (isArray(query)) {
			for (
				i = 0,
				length = query.length; i < length; i++
			) {
				value = query[i];
				appendTo(dict, value[0], value[1]);
			}
		} else if (query.forEach) {
			query.forEach(addEach, dict);
		} else {
			for (key in query) {
				 appendTo(dict, key, query[key]);
			}
		}
	}
}

var
	isArray = Array.isArray,
	URLSearchParamsProto = URLSearchParams.prototype,
	find = /[!'\(\)~]|%20|%00/g,
	plus = /\+/g,
	replace = {
		'!': '%21',
		"'": '%27',
		'(': '%28',
		')': '%29',
		'~': '%7E',
		'%20': '+',
		'%00': '\x00'
	},
	replacer = function (match) {
		return replace[match];
	},
	secret = '__URLSearchParams__:' + Math.random()
;

function addEach(value, key) {
	/* jshint validthis:true */
	appendTo(this, key, value);
}

function appendTo(dict, name, value) {
	var res = isArray(value) ? value.join(',') : value;
	if (name in dict)
		dict[name].push(res);
	else
		dict[name] = [res];
}

function decode(str) {
	return decodeURIComponent(str.replace(plus, ' '));
}

function encode(str) {
	return encodeURIComponent(str).replace(find, replacer);
}

URLSearchParamsProto.append = function append(name, value) {
	appendTo(this[secret], name, value);
};

URLSearchParamsProto.delete = function del(name) {
	delete this[secret][name];
};

URLSearchParamsProto.get = function get(name) {
	var dict = this[secret];
	return name in dict ? dict[name][0] : null;
};

URLSearchParamsProto.getAll = function getAll(name) {
	var dict = this[secret];
	return name in dict ? dict[name].slice(0) : [];
};

URLSearchParamsProto.has = function has(name) {
	return name in this[secret];
};

URLSearchParamsProto.set = function set(name, value) {
	this[secret][name] = ['' + value];
};

URLSearchParamsProto.forEach = function forEach(callback, thisArg) {
	var dict = this[secret];
	Object.getOwnPropertyNames(dict).forEach(function(name) {
		dict[name].forEach(function(value) {
			callback.call(thisArg, value, name, this);
		}, this);
	}, this);
};

URLSearchParamsProto.toJSON = function toJSON() {
	return {};
};

URLSearchParamsProto.toString = function toString() {
	var dict = this[secret], query = [], i, key, name, value;
	for (key in dict) {
		name = encode(key);
		for (
			i = 0,
			value = dict[key];
			i < value.length; i++
		) {
			query.push(name + '=' + encode(value[i]));
		}
	}
	return query.join('&');
};