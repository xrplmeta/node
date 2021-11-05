export function createURI(pair){
	let baseComponent = pair.base.issuer ? `${pair.base.currency}:${pair.base.issuer}` : pair.base.currency
	let quoteComponent = pair.quote.issuer ? `${pair.quote.currency}:${pair.quote.issuer}` : pair.quote.currency

	return `${baseComponent}/${quoteComponent}`
}

export function parseURI(uri){
	let [baseComponent, quoteComponent] = uri.split('/')

	let [baseCurrency, baseIssuer] = baseComponent.split(':')
	let [quoteCurrency, quoteIssuer] = quoteComponent.split(':')

	return {
		base: {
			currency: baseCurrency,
			issuer: baseIssuer
		},
		quote: {
			currency: quoteCurrency,
			issuer: quoteIssuer
		}
	}
}

export function parseURIComponent(component){
	let [currency, issuer] = component.split(':')

	return {
		currency,
		issuer
	}
}

export function invert(pair){
	return {
		base: pair.quote,
		quote: pair.base
	}
}