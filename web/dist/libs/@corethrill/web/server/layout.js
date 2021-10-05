import c from '@corethrill/core'

export default {
	view: node => {
		let ctx = node.attrs.ctx
		let page = ctx.page

		return c('[', [
			c('!doctype[html]'),
			c('html', {class: page.class}, [
				c('head', [
					c('title', page.title),
					page.meta.map(tag => c('meta', tag)),
					page.icons.map(icon => c('link', icon)),
					page.styles.map(style => {
						if(style.inline){
							return c('style', c.trust(style.content))
						}else{
							return c('link', {rel: 'stylesheet', href: style.src})
						}
					}),
					c('script', 'document.documentElement.style.display = "none"')
				]),
				c('body', [
					node.children,
					//c('script', c.trust(`window.CONFIG = ${JSON.stringify(node.attrs.config)}`)),
					c('script', c.trust(`window.STATE = ${ctx.state.toString()}`)),
					ctx.i18n ? c('script', c.trust(`window.I18N = ${JSON.stringify(node.attrs.i18n.spec.default)}`)) : null,
					page.scripts.map(script => {
						if(script.inline){
							return c('script', {}, c.trust(script.content))
						}else{
							return c('script', {src: script.src})
						}
					})
				])
			])
		])
	}
} 