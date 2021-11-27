import Decimal from './decimal.js'


export function deriveExchanges(tx){
	let hash = tx.hash || tx.transaction.hash
	let account = tx.Account || tx.transaction.Account
	let exchanges = []

	for(let affected of (tx.meta || tx.metaData).AffectedNodes){
		let node = affected.ModifiedNode || affected.DeletedNode

		if(!node || node.LedgerEntryType !== 'Offer')
			continue

		if(!node.PreviousFields || !node.PreviousFields.TakerPays || !node.PreviousFields.TakerGets)
			continue

		let base
		let quote
		let counterparty = node.FinalFields.Account
		let previousTakerPays = fromLedgerAmount(node.PreviousFields.TakerPays)
		let previousTakerGets = fromLedgerAmount(node.PreviousFields.TakerGets)
		let finalTakerPays = fromLedgerAmount(node.FinalFields.TakerPays)
		let finalTakerGets = fromLedgerAmount(node.FinalFields.TakerGets)

		let takerPaid = {
			...finalTakerPays, 
			value: previousTakerPays.value.minus(finalTakerPays.value)
		}

		let takerGot = {
			...finalTakerGets, 
			value: previousTakerGets.value.minus(finalTakerGets.value)
		}

		if(1){
			base = takerPaid
			quote = takerGot
		}else{
			base = takerGot
			quote = takerPaid
		}

		exchanges.push({
			tx: hash,
			maker: account,
			base: {currency: base.currency, issuer: base.issuer},
			quote: {currency: quote.currency, issuer: quote.issuer},
			price: quote.value.div(base.value),
			volume: quote.value
		})
	}

	return exchanges
}

/*

var BigNumber  = require('bignumber.js');
var parseQuality = require('./quality.js');
var XRP_ADJUST = 1000000.0;



var OffersExercised = function (tx) {
  var list = [];
  var node;
  var affNode;

  if (tx.metaData.TransactionResult !== 'tesSUCCESS') {
    return list;
  }

  if (tx.TransactionType !== 'Payment' && tx.TransactionType !== 'OfferCreate') {
    return list;
  }

  for (var i=0; i<tx.metaData.AffectedNodes.length; i++) {
    affNode = tx.metaData.AffectedNodes[i];
    node    = affNode.ModifiedNode || affNode.DeletedNode;

    if (!node || node.LedgerEntryType !== 'Offer') {
      continue;
    }

    if (!node.PreviousFields || !node.PreviousFields.TakerPays || !node.PreviousFields.TakerGets) {
      continue;
    }

    node.nodeIndex = i;
    list.push(parseOfferExercised(node, tx));
  }

  return list;

 

  function parseOfferExercised (node, tx) {
    var counterparty = node.FinalFields.Account;
    var base;
    var counter;
    var exchangeRate;
    var change;

    // TakerPays IOU
    if (typeof node.PreviousFields.TakerPays === "object") {
      change = new BigNumber(node.PreviousFields.TakerPays.value)
        .minus(node.FinalFields.TakerPays.value)

      base = {
        currency: node.PreviousFields.TakerPays.currency,
        issuer: node.PreviousFields.TakerPays.issuer,
        amount: change.toString()
      }

    // TakerPays XRP
    } else {
      change = new BigNumber(node.PreviousFields.TakerPays)
        .minus(node.FinalFields.TakerPays);

      base = {
        currency: 'XRP',
        amount: change.dividedBy(XRP_ADJUST).toString()
      }
    }

    // TakerGets IOU
    if (typeof node.PreviousFields.TakerGets === "object") {
      change = new BigNumber(node.PreviousFields.TakerGets.value)
        .minus(node.FinalFields.TakerGets.value)

      counter = {
        currency: node.PreviousFields.TakerGets.currency,
        issuer: node.PreviousFields.TakerGets.issuer,
        amount: change.toString()
      }

    // TakerGets XRP
    } else {
      change = new BigNumber(node.PreviousFields.TakerGets)
        .minus(node.FinalFields.TakerGets);

      counter = {
        currency: 'XRP',
        amount: change.dividedBy(XRP_ADJUST).toString()
      }
    }

    try {
      exchangeRate = parseQuality(
        node.FinalFields.BookDirectory,
        base.currency,
        counter.currency
      );


    } catch (e) {
      //unable to calculate from quality
      console.log(e);
    }

    if (!exchangeRate) {
      exchangeRate = new BigNumber(base.amount).dividedBy(counter.amount);
    }

    var offer = {
      base         : base,
      counter      : counter,
      rate         : exchangeRate,
      buyer        : counterparty,
      seller       : tx.Account,
      taker        : tx.Account,
      provider     : node.FinalFields.Account,
      sequence     : node.FinalFields.Sequence,
      time         : tx.executed_time,
      tx_type      : tx.TransactionType,
      tx_index     : tx.tx_index,
      ledger_index : tx.ledger_index,
      node_index   : node.nodeIndex,
      tx_hash      : tx.hash,
      client       : tx.client
    };

    // look for autobridge data
    if (tx.TransactionType === 'OfferCreate' &&
        tx.TakerPays.currency &&
        tx.TakerGets.currency) {

      if (counter.currency === 'XRP' &&
        base.currency === tx.TakerPays.currency) {
        offer.autobridged = {
          currency: tx.TakerGets.currency,
          issuer: tx.TakerGets.issuer
        };

      } else if (counter.currency === 'XRP' &&
        base.currency === tx.TakerGets.currency) {
        offer.autobridged = {
          currency: tx.TakerPays.currency,
          issuer: tx.TakerPays.issuer
        };

      } else if (base.currency === 'XRP' &&
        counter.currency === tx.TakerPays.currency) {
        offer.autobridged = {
          currency: tx.TakerGets.currency,
          issuer: tx.TakerGets.issuer
        };

      } else if (base.currency === 'XRP' &&
        counter.currency === tx.TakerGets.currency) {
        offer.autobridged = {
          currency: tx.TakerPays.currency,
          issuer: tx.TakerPays.issuer
        };
      }
    }

    return orderPair(offer);
  }


  function orderPair (offer) {
    var c1 = (offer.base.currency + offer.base.issuer).toLowerCase();
    var c2 = (offer.counter.currency + offer.counter.issuer).toLowerCase();
    var swap;

    if (c2 < c1) {
      swap          = offer.base;
      offer.base    = offer.counter;
      offer.counter = swap;
      offer.rate    = offer.rate.toString();
      swap          = offer.buyer;
      offer.buyer   = offer.seller;
      offer.seller  = swap;

    } else {
      offer.rate = offer.rate.pow(-1).toString();
    }

    return offer;
  }
};
*/



export function currencyHexToUTF8(code){
	if(code.length === 3)
		return code

	let decoded = new TextDecoder()
		.decode(hexToBytes(code))
	let firstNull = decoded.indexOf('\0')

	if(firstNull > 0)
		decoded = decoded.slice(0, firstNull)

	return decoded
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


export function fromLedgerAmount(amount){
	if(typeof amount === 'string')
		return {
			currency: 'XRP',
			value: Decimal.div(amount, '1000000')
		}
	
	return {
		currency: amount.currency,
		issuer: amount.issuer,
		value: new Decimal(amount.value)
	}
}


export function toLedgerAmount(amount){
	if(amount.currency === 'XRP')
		return amount.value.times(1000000).toString()

	return {
		currency: amount.currency,
		issuer: amount.issuer,
		value: amount.value.toString()
	}
}