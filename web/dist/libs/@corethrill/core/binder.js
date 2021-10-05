import ct from './ct.js'

export default {
	oncreate: node => {
		node.attrs.set(node.dom.firstChild)
	},
	view: node => ct('[', node.children)
}