export default {
	get: key => {
		var nameEQ = key + "="
		var ca = document.cookie.split(';')

		for(var i=0;i < ca.length;i++) {
			var c = ca[i]
			while (c.charAt(0)==' ') c = c.substring(1,c.length)
			if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length)
		}

		return null
	},
	set: (key, value, opts) => {
		let parts = [`${key}=${value}`, `path=/`]

		if(opts.maxAge){
			parts.push(`expires=${new Date(Date.now() + opts.maxAge).toGMTString()}`)
		}else if(opts.expires){
			parts.push(`expires=${opts.expires.toGMTString()}`)
		}

		document.cookie = parts.join('; ')
	}
}