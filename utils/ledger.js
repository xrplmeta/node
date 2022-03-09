import Decimal from 'decimal.js'


export function deriveExchanges(tx){
	let hash = tx.hash || tx.transaction.hash
	let maker = tx.Account || tx.transaction.Account
	let exchanges = []

	for(let affected of (tx.meta || tx.metaData).AffectedNodes){
		let node = affected.ModifiedNode || affected.DeletedNode

		if(!node || node.LedgerEntryType !== 'Offer')
			continue

		if(!node.PreviousFields || !node.PreviousFields.TakerPays || !node.PreviousFields.TakerGets)
			continue

		let taker = node.FinalFields.Account
		let sequence = node.FinalFields.Sequence
		let previousTakerPays = fromLedgerAmount(node.PreviousFields.TakerPays)
		let previousTakerGets = fromLedgerAmount(node.PreviousFields.TakerGets)
		let finalTakerPays = fromLedgerAmount(node.FinalFields.TakerPays)
		let finalTakerGets = fromLedgerAmount(node.FinalFields.TakerGets)

		let takerPaid = {
			...finalTakerPays, 
			value: Decimal.sub(previousTakerPays.value, finalTakerPays.value)
		}

		let takerGot = {
			...finalTakerGets, 
			value: Decimal.sub(previousTakerGets.value, finalTakerGets.value)
		}

		exchanges.push({
			hash,
			maker,
			taker,
			sequence,
			base: {
				currency: currencyHexToUTF8(takerPaid.currency), 
				issuer: takerPaid.issuer
			},
			quote: {
				currency: currencyHexToUTF8(takerGot.currency), 
				issuer: takerGot.issuer
			},
			price: Decimal.div(takerGot.value, takerPaid.value),
			volume: takerPaid.value
		})
	}

	return exchanges
}

export function deriveBalanceChanges(tx){
	let parties = {}
	let bookChange = ({currency, issuer, account, previous, final}) => {
		if(previous === final)
			return

		let party = parties[account]

		if(!party)
			party = parties[account] = []

		if(party.some(e => e.currency === currency && e.issuer === issuer))
			throw 'no way'

		party.push({
			currency,
			issuer,
			previous,
			final,
			change: Decimal.sub(final, previous)
		})
	}

	for(let affected of (tx.meta || tx.metaData).AffectedNodes){
		let key = Object.keys(affected)[0]
		let node = affected[key]
		let finalFields = node.FinalFields || node.NewFields
		let previousFields = node.PreviousFields


		if(node.LedgerEntryType === 'RippleState'){
			if(key === 'ModifiedNode' && !previousFields.Balance)
				continue

			let currency = finalFields.Balance.currency
			let final = new Decimal(finalFields?.Balance?.value || '0')
			let previous = new Decimal(previousFields?.Balance?.value || '0')
			let issuer
			let account

			if(previous.gt(0) || final.gt(0)){
				issuer = finalFields.HighLimit.issuer
				account = finalFields.LowLimit.issuer
			}else if(previous.lt(0) || final.lt(0)){
				issuer = finalFields.LowLimit.issuer
				account = finalFields.HighLimit.issuer
				final = final.times(-1)
				previous = previous.times(-1)
			}

			bookChange({
				currency, 
				issuer, 
				account, 
				previous,
				final
			})
		}else if(node.LedgerEntryType === 'AccountRoot'){
			if(!finalFields)
				continue

			let account = finalFields.Account
			let final = new Decimal(finalFields?.Balance || '0')
				.div('1000000')
			let previous = new Decimal(previousFields?.Balance || '0')
				.div('1000000')


			bookChange({
				currency: 'XRP',
				issuer: null, 
				account, 
				previous,
				final
			})
		}
	}

	return parties
}

export function deriveCurrencies(tx){
	let currencies = []
	let add = entry => {
		if(typeof entry === 'string')
			entry = {currency: 'XRP'}

		if(currencies.every(currency => !sameCurrency(currency, entry))){
			currencies.push(entry)
		}
	}

	for(let node of (tx.meta || tx.metaData).AffectedNodes){
		let nodeKey = Object.keys(node)[0]
		let nodeData = node[nodeKey]
		let fields = nodeData.FinalFields || nodeData.NewFields

		if(fields && fields.TakerGets){
			add(fields.TakerGets)
			add(fields.TakerPays)
		}
	}

	return currencies
}

export function sameCurrency(a, b){
	if(typeof a === 'string')
		a = {currency: 'XRP'}
	else
		a = {
			currency: currencyUTF8ToHex(a.currency), 
			issuer: a.issuer
		}

	if(typeof b === 'string')
		b = {currency: 'XRP'}
	else
		b = {
			currency: currencyUTF8ToHex(b.currency), 
			issuer: b.issuer
		}

	return true
		&& a.currency === b.currency
		&& a.issuer == b.issuer
}

export function currencyHexToUTF8(code){
	if(code.length === 3)
		return code

	let decoded = new TextDecoder()
		.decode(hexToBytes(code))
	let padNull = decoded.length

	while(decoded.charAt(padNull-1) === '\0')
		padNull--

	return decoded.slice(0, padNull)
}

function hexToBytes(hex){
	let bytes = new Uint8Array(hex.length / 2)

	for (let i = 0; i !== bytes.length; i++){
		bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
	}

	return bytes
}

export function currencyUTF8ToHex(code){
	if(/^[a-zA-Z0-9\?\!\@\#\$\%\^\&\*\<\>\(\)\{\}\[\]\|\]\{\}]{3}$/.test(code))
		return code

	if(/^[A-Z0-9]{40}$/.test(code))
		return code

	let hex = ''

	for(let i=0; i<code.length; i++){
		hex += code.charCodeAt(i).toString(16)
	}

	return hex
		.toUpperCase()
		.padEnd(40, '0')
}


export function fromLedgerAmount(amount, convertCurrencyCode){
	if(typeof amount === 'string')
		return {
			currency: 'XRP',
			value: Decimal.div(amount, '1000000')
				.toString()
		}
	
	return {
		currency: convertCurrencyCode
			? currencyHexToUTF8(amount.currency)
			: amount.currency,
		issuer: amount.issuer,
		value: amount.value
	}
}


export function toLedgerAmount(amount){
	if(amount.currency === 'XRP')
		return Decimal.mul(amount.value, '1000000')
			.round()
			.toString()
	return {
		currency: currencyUTF8ToHex(amount.currency),
		issuer: amount.issuer,
		value: amount.value.toString()
	}
}