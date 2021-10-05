import I18n from '../lib/i18n.js'


export default function(){
	let i18n = new I18n()
	let instance = function(scope, options){
		return i18n.translate(scope, options)
	}

	instance.spec = {}
	instance.define = (lang, def) => {
		if(typeof lang !== 'string'){
			def = lang
			lang = 'default'
		}

		i18n.locale = lang
		i18n.translations[lang] = def
		instance.spec[lang] = def

		return instance
	}


	return instance
}