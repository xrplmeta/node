import Vnode from '../vnode.js'

export default function(html) {
	if (html == null) 
		html = ''
	
	return Vnode('<', undefined, undefined, html, undefined, undefined)
}
