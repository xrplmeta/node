export default {
	join: function(...parts){
		return parts.join('/').replace(/\/+/g, '/').trimRight('/')
	}
}