import minimist from 'minimist';
import log$4 from '@xrplmeta/log';
import { load } from '@xrplmeta/toml';
import { unixNow, mapMultiKey, keySort, leftProximityZip, wait, assignDeep } from '@xrplmeta/utils';
import initRepo from '@xrplmeta/repo';
import DB from '@xrplmeta/db';
import Decimal from 'decimal.js';
import Koa from 'koa';
import websocket from 'koa-easy-ws';
import Router from '@koa/router';

function init$3(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Heads" (
			"key"		TEXT NOT NULL UNIQUE,
			"sequence"	INTEGER NOT NULL UNIQUE
		);`
	);
}

function set(heads){
	for(let [key, sequence] of Object.entries(heads)){
		this.insert({
			table: 'Heads',
			data: {
				key,
				sequence: sequence || 0
			},
			duplicate: 'update'
		});
	}
}

function all$4(){
	let heads = {};
	let rows = this.all(`SELECT * FROM Heads`);

	for(let {key, sequence} of rows){
		heads[key] = sequence;
	}

	return heads
}

var heads = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$3,
	set: set,
	all: all$4
});

function init$2(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Tokens" (
			"id"				INTEGER NOT NULL UNIQUE,
			"currency"			TEXT NOT NULL,
			"currency_name"		TEXT,
			"issuer"			TEXT NOT NULL,
			"issuer_name"		TEXT,
			"stats"				TEXT NOT NULL,
			"meta"				TEXT NOT NULL,
			"trusted"			INTEGER NOT NULL,
			"popular"			REAL NOT NULL,
			"marketcap"			REAL NOT NULL,
			"trustlines"		INTEGER NOT NULL,
			"trustlines_day"	INTEGER,
			"trustlines_week"	INTEGER,
			"volume_day"		REAL NOT NULL,
			"volume_week"		REAL NOT NULL,
			"price_day"			REAL,
			"price_week"		REAL,
			"updated"			INTEGER
		);
		
		CREATE INDEX IF NOT EXISTS 
		"TokensCurrency" ON "Tokens" 
		("currency");

		CREATE INDEX IF NOT EXISTS 
		"TokensCurrencyName" ON "Tokens" 
		("currency_name");

		CREATE INDEX IF NOT EXISTS 
		"TokensIssuer" ON "Tokens" 
		("issuer");

		CREATE INDEX IF NOT EXISTS 
		"TokensIssuerName" ON "Tokens" 
		("issuer_name");

		CREATE INDEX IF NOT EXISTS 
		"TokensTrusted" ON "Tokens" 
		("trusted");

		CREATE INDEX IF NOT EXISTS 
		"TokensPopular" ON "Tokens" 
		("popular");

		CREATE INDEX IF NOT EXISTS 
		"TokensMarketcap" ON "Tokens" 
		("marketcap");

		CREATE INDEX IF NOT EXISTS 
		"TokensTrustlines" ON "Tokens" 
		("trustlines");

		CREATE INDEX IF NOT EXISTS 
		"TrustlinesDay" ON "Tokens" 
		("trustlines_day");

		CREATE INDEX IF NOT EXISTS 
		"TrustlinesWeek" ON "Tokens" 
		("trustlines_week");

		CREATE INDEX IF NOT EXISTS 
		"TokensVolumeDay" ON "Tokens" 
		("volume_day");

		CREATE INDEX IF NOT EXISTS 
		"TokensVolumeWeek" ON "Tokens" 
		("volume_week");

		CREATE INDEX IF NOT EXISTS 
		"TokensPriceDay" ON "Tokens" 
		("price_day");

		CREATE INDEX IF NOT EXISTS 
		"TokensPriceWeek" ON "Tokens" 
		("price_week");

		CREATE INDEX IF NOT EXISTS 
		"TokensUpdated" ON "Tokens" 
		("updated");`
	);
}

function all$3({limit, offset, sort, trusted, search, minTrustlines, updatedBefore}){
	let rows;

	if(updatedBefore){
		rows = this.all(
			`SELECT id, currency, issuer, meta, stats FROM Tokens
			WHERE updated < ?`,
			updatedBefore
		);
	}else {
		rows = this.all(
			`SELECT id, currency, issuer, meta, stats FROM Tokens
			WHERE trustlines >= @minTrustlines
			${trusted ? `AND trusted=1` : ``}
			${search ? `AND (
				currency LIKE @searchAny 
				OR currency_name LIKE @searchAny 
				OR issuer LIKE @searchStarting
				OR issuer_name LIKE @searchStarting
			)` : ``}
			ORDER BY ${sort} DESC
			LIMIT @offset, @limit`,
			{
				minTrustlines: minTrustlines || 0,
				offset: offset || 0,
				limit: limit || 9999999,
				searchAny: search ? `%${search}%` : undefined,
				searchStarting: search ? `${search}%` : undefined,
			}
		);
	}

	return rows.map(row => decode(row))
}


function get({currency, issuer}){
	return decode(this.get(
		`SELECT id, currency, issuer, meta, stats FROM Tokens
		WHERE currency = ? AND issuer = ?`,
		currency,
		issuer
	))
}

function count(){
	return this.getv(`SELECT COUNT(1) FROM Tokens`)
}

function insert({id, currency, issuer, meta, stats, trusted, popular}){
	this.insert({
		table: 'Tokens',
		data: {
			id,
			currency,
			currency_name: meta.currency.name
				? meta.currency.name[0].value
				: null,
			issuer,
			issuer_name: meta.issuer.name
				? meta.issuer.name[0].value
				: null,
			trusted: trusted ? 1 : 0,
			popular,
			meta: JSON.stringify(meta),
			stats: JSON.stringify(stats),
			marketcap: parseFloat(stats.marketcap),
			trustlines: stats.trustlines,
			trustlines_day: stats.trustlines_change?.day,
			trustlines_week: stats.trustlines_change?.week,
			volume_day: parseFloat(stats.volume?.day),
			volume_week: parseFloat(stats.volume?.week),
			price_week: stats.price_change?.week,
			price_day: stats.price_change?.day,
			updated: unixNow()
		},
		duplicate: 'update'
	});
}

function decode(row){
	if(!row)
		return null

	let { meta, stats, ...token } = row;

	return {
		...token,
		meta: JSON.parse(meta),
		stats: JSON.parse(stats)
	}
}

var tokens$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$2,
	all: all$3,
	get: get,
	count: count,
	insert: insert
});

function init$1(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Candles" (
			"id"		INTEGER NOT NULL UNIQUE,
			"base"		INTEGER,
			"quote"		INTEGER,
			"timeframe"	INTEGER NOT NULL,
			"head"		INTEGER NOT NULL,
			"tail"		INTEGER NOT NULL,
			"t"			INTEGER NOT NULL,
			"o"			TEXT NOT NULL,
			"h"			TEXT NOT NULL,
			"l"			TEXT NOT NULL,
			"c"			TEXT NOT NULL,
			"v"			TEXT NOT NULL,
			"n"			INTEGER NOT NULL,
			PRIMARY KEY ("id" AUTOINCREMENT),
			UNIQUE ("base", "quote", "timeframe", "t")
		);`
	);
}


function all$2(series, start, end){
	return this.all(
		`SELECT t, o, h, l, c, v, n FROM Candles
		WHERE base IS @base
		AND quote IS @quote
		AND timeframe = @timeframe
		AND t >= @start
		AND t <= @end
		ORDER BY t ASC`,
		{
			...series,
			start: Math.floor((start || 0) / series.timeframe) * series.timeframe,
			end: end || unixNow()
		}
	)
}

function allocate$6(series, exchanges){
	let candles = [];
	let candle = null;

	for(let exchange of exchanges){
		let t = Math.floor(exchange.date / series.timeframe) * series.timeframe;
		let price = exchange.price;
		let volume = exchange.volume;
		
		if(candle && candle.t !== t){
			candles.push(candle);
			candle = null;
		}

		if(!candle){
			candle = {
				t,
				head: exchange.ledger,
				tail: exchange.ledger,
				o: price,
				h: price,
				l: price,
				c: price,
				v: volume,
				n: 1
			};
		}else {
			candle.head = Math.max(candle.head, exchange.ledger);
			candle.tail = Math.min(candle.tail, exchange.ledger);
			candle.h = Decimal.max(candle.h, price);
			candle.l = Decimal.min(candle.l, price);
			candle.c = price;
			candle.v = candle.v.plus(volume);
			candle.n += 1;
		}
	}

	if(candle)
		candles.push(candle);


	this.insert({
		table: 'Candles',
		data: candles.map(candle => ({
			...candle,
			...series,
			o: candle.o.toString(),
			h: candle.h.toString(),
			l: candle.l.toString(),
			c: candle.c.toString(),
			v: candle.v.toString()
		}))
	});
}



function integrate$2(series, exchange){
	let timeframe = series.timeframe;
	let t = Math.floor(exchange.date / timeframe) * timeframe;
	let candle = this.get(
		`SELECT * FROM Candles 
		WHERE base IS @base
		AND quote IS @quote
		AND timeframe = @timeframe
		AND t = @t`,
		{
			...series,
			t
		}
	);

	let price = exchange.price;
	let volume = exchange.volume;

	if(candle){
		candle.h = Decimal.max(candle.h, price);
		candle.l = Decimal.min(candle.l, price);
		candle.v = Decimal.sum(candle.v, volume);
		candle.n += 1;

		if(exchange.ledger < candle.tail){
			candle.tail = exchange.ledger;
			candle.o = price;
		}else if(exchange.ledger > candle.head){
			candle.head = exchange.ledger;
			candle.c = price;
		}
	}else {
		candle = {
			head: exchange.ledger,
			tail: exchange.ledger,
			t,
			o: price,
			h: price,
			l: price,
			c: price,
			v: volume,
			n: 1
		};
	}

	this.insert({
		table: 'Candles',
		data: {
			...candle,
			...series,
			o: candle.o.toString(),
			h: candle.h.toString(),
			l: candle.l.toString(),
			c: candle.c.toString(),
			v: candle.v.toString(),
		},
		duplicate: 'update'
	});
}

var candles = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$1,
	all: all$2,
	allocate: allocate$6,
	integrate: integrate$2
});

function all$1(pair, start, end){
	let table = deriveTable(pair);
	
	if(!doesTableExist.call(this, table))
		return []

	return this.all(
		`SELECT * FROM ${table}
		WHERE date >= ? AND date <= ?
		ORDER BY date ASC`,
		start || 0,
		end || unixNow()
	)
}

function allocate$5(pair, exchanges){
	let table = deriveTable(pair);

	ensureTable.call(this, table);

	this.insert({
		table,
		data: exchanges
			.slice(-this.config.tokens.exchanges.limit)
			.map(exchange => format(exchange))
	});
}


function integrate$1(pair, exchange){
	let table = deriveTable(pair);

	ensureTable.call(this, table);

	let recent = this.getv(`SELECT MAX(ledger) FROM ${table}`);
	let count = this.getv(`SELECT COUNT(1) FROM ${table}`);

	if(exchange.ledger < recent)
		return
	
	this.insert({
		table,
		data: format(exchange),
		duplicate: 'update'
	});

	if(count+1 > this.config.tokens.exchanges.limit)
		this.exec(`DELETE FROM ${table} ORDER BY ledger ASC LIMIT 1`);
}


function format(exchange){
	return {
		id: exchange.id,
		ledger: exchange.ledger,
		date: exchange.date,
		price: exchange.price.toString(),
		volume: exchange.volume.toString()
	}
}


function doesTableExist(table){
	return !!this.getv(
		`SELECT COUNT(1) 
		FROM sqlite_master 
		WHERE type='table' 
		AND name = ?`,
		table
	)
}

function ensureTable(table){
	if(doesTableExist.call(this, table))
		return

	this.exec(
		`CREATE TABLE "${table}" (
			"id"		INTEGER NOT NULL UNIQUE,
			"ledger"	INTEGER NOT NULL,
			"date"		INTEGER NOT NULL,
			"price"		TEXT NOT NULL,
			"volume"	TEXT NOT NULL
		);

		CREATE INDEX IF NOT EXISTS
		"${table}T" ON "${table}"
		("date");`
	);
}

function deriveTable({base, quote}){
	return `TradesB${base || 'X'}Q${quote || 'X'}`
}

var trades = /*#__PURE__*/Object.freeze({
	__proto__: null,
	all: all$1,
	allocate: allocate$5,
	integrate: integrate$1
});

function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Stats" (
			"id"			INTEGER NOT NULL UNIQUE,
			"token"			INTEGER NOT NULL,
			"timeframe"		INTEGER NOT NULL,
			"head"			INTEGER NOT NULL,
			"tail"			INTEGER NOT NULL,
			"ledger"		INTEGER NOT NULL,
			"date"			INTEGER NOT NULL,
			"trustlines"	INTEGER NOT NULL,
			"holders"		INTEGER NOT NULL,
			"supply"		TEXT NOT NULL,
			"marketcap"		TEXT NOT NULL,
			"bid"			TEXT NOT NULL,
			"ask"			TEXT NOT NULL,
			${
				this.config.tokens.stats.topPercenters
					.map(p => `"percent${p.toString().replace('.', '')}"	REAL`)
					.join(', ')
			},
			PRIMARY KEY ("id" AUTOINCREMENT),
			UNIQUE("token", "timeframe", "ledger")
		);

		CREATE INDEX IF NOT EXISTS
		"StatsDate" ON "Stats"
		("date");`
	);
}


function all(series, start, end){
	return this.all(
		`SELECT * FROM "Stats"
		WHERE token = @token
		AND timeframe = @timeframe
		AND date >= @start 
		AND date <= @end`,
		{
			...series,
			start,
			end
		}
	)
		.map(({id, bid, ask, ...row}) => {
			let distribution = {};

			for(let key in row){
				if(key.startsWith('percent')){
					let cleanKey = key
						.slice(7)
						.replace(/^0/, '0.');

					distribution[cleanKey] = row[key];
					delete row[key];
				}
			}

			return {
				...row,
				liquidity: {bid, ask},
				distribution
			}
		})
}

function allocate$4(series, stats){
	let timeframe = series.timeframe;
	let points = [];

	for(let stat of stats){
		let t = Math.floor(stat.date / timeframe) * timeframe;
		let point = {
			...stat,
			...series,
			date: t,
			head: stat.ledger,
			tail: stat.ledger
		};
		let lastPoint = points[points.length - 1];

		if(lastPoint?.date === t){
			Object.assign(lastPoint, point);
			
			point.head = Math.max(point.head, stat.ledger);
			point.tail = Math.min(point.tail, stat.ledger);
		}else {
			points.push(point);
		}
	}

	if(points.length === 0)
		return

	this.insert({
		table: 'Stats',
		data: points
	});
}


function integrate(series, stats){
	let timeframe = series.timeframe;
	let t = Math.floor(stats.date / timeframe) * timeframe;
	let point = this.get(
		`SELECT * FROM "Stats"
		WHERE token = @token
		AND timeframe = @timeframe
		AND date = @t`,
		{
			...series,
			t
		}
	);

	if(point){
		if(stats.ledger > point.head){
			point.head = stats.ledger;
			Object.assign(point, stats, {date: t});
		}
	}else {
		point = {
			...stats,
			...series,
			date: t,
			head: stats.ledger,
			tail: stats.ledger
		};
	}

	let { id, ...override } = point;

	this.insert({
		table: 'Stats',
		data: override,
		duplicate: 'update'
	});
}

var stats = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init,
	all: all,
	allocate: allocate$4,
	integrate: integrate
});

var initCache = config => new DB({
	...config,
	file: config.cache.inMemory
		? ':memory:'
		: `${config.data.dir}/${config.cache.dbName || 'cache'}.db`,
	journalMode: config.cache.journalMode || 'WAL',
	modules: {
		heads,
		tokens: tokens$1,
		candles,
		trades,
		stats
	}
});

const log$3 = log$4.branch({
	name: 'sync:exchanges',
	color: 'cyan'
});


function allocate$3(heads){
	log$3.time(`sync.candles`, `building exchanges cache`);

	let pairs = this.repo.exchanges.pairs(true);
	let count = this.repo.exchanges.count();
	let processed = 0;
	let progress = 0;


	for(let {base, quote} of pairs){
		let exchanges = [
			...this.repo.exchanges.iter({base: base, quote: quote}),
			...this.repo.exchanges.iter({base: quote, quote: base})
		];
		
		if(!base || !quote){
			//filter outliers, align exchange so volume is XRP
			exchanges = exchanges
				.filter(exchange => 
					this.repo.exchanges.align(
						exchange,
						base ? base : quote,
						base ? quote : base
					).volume.gte('0.01')
				);
		}

		exchanges.sort((a, b) => a.date - b.date);

		if(exchanges.length > 0){
			let exchangesBQ = exchanges.map(exchange => this.repo.exchanges.align(
				exchange, 
				base, 
				quote
			));

			let exchangesQB = exchanges.map(exchange => this.repo.exchanges.align(
				exchange, 
				quote, 
				base
			));

			this.cache.tx(() => {
				for(let timeframe of Object.values(this.config.tokens.market.timeframes)){
					this.cache.candles.allocate(
						{base: base, quote: quote, timeframe},
						exchangesBQ
					);

					this.cache.candles.allocate(
						{base: quote, quote: base, timeframe},
						exchangesQB
					);
				}

				/*this.cache.trades.allocate(
					{base: base, quote: quote},
					exchangesBQ
				)

				this.cache.trades.allocate(
					{base: quote, quote: base},
					exchangesQB
				)*/
			});

			processed += exchanges.length;
		}

		let newProgress = Math.floor((processed / count) * 100);

		if(newProgress !== progress){
			progress = newProgress;
			log$3.info(`processed`, processed, `of`, count, `exchanges (${progress}%)`);
		}
	}
	
	log$3.time(`sync.candles`, `built exchanges cache in %`);
}


function register$2({ ranges }){
	if(!ranges.exchanges)
		return

	let newExchanges = this.repo.exchanges.iter({
		from: ranges.exchanges[0],
		to: ranges.exchanges[1]
	});

	for(let exchange of newExchanges){
		let exchangeBQ = this.repo.exchanges.align(exchange, exchange.base, exchange.quote);
		let exchangeQB = this.repo.exchanges.align(exchange, exchange.quote, exchange.base);

		if(!exchange.base || !exchange.quote){
			let volume = exchange.base ? exchangeBQ.volume : exchangeQB.volume;

			if(volume.lt('0.01'))
				continue
		}

		for(let timeframe of Object.values(this.config.tokens.market.timeframes)){
			this.cache.candles.integrate(
				{base: exchange.base, quote: exchange.quote, timeframe},
				exchangeBQ
			);

			this.cache.candles.integrate(
				{base: exchange.quote, quote: exchange.base, timeframe},
				exchangeQB
			);
		}

		/*this.cache.trades.integrate(
			{base: exchange.base, quote: exchange.quote},
			exchangeBQ
		)

		this.cache.trades.integrate(
			{base: exchange.quote, quote: exchange.base},
			exchangeQB
		)*/
	}
}

const log$2 = log$4.branch({
	name: 'sync:tokens',
	color: 'cyan'
});



function allocate$2(heads){
	log$2.time(`sync.tokens`, `building tokens cache`);

	let tokens = this.repo.tokens.all();
	let progress = 0;
	
	for(let i=0; i<tokens.length; i++){
		compose.call(this, tokens[i]);

		let newProgress = Math.floor((i / tokens.length) * 100);

		if(newProgress !== progress){
			progress = newProgress;
			log$2.info(`processed`, i, `of`, tokens.length, `tokens (${progress}%)`);
		}
	}

	log$2.time(`sync.tokens`, `built tokens cache in %`);
}

function register$1({ affected }){
	let relevant = affected.filter(({contexts}) => 
		contexts.some(context => ['exchange', 'meta', 'stats', 'self'].includes(context)));

	for(let { type, id } of relevant){
		if(type === 'token'){
			compose.call(this, this.repo.tokens.get({id}));
			//log.debug(`updated token (TL${id})`)
		}
	}
}

function update(id){
	let token = this.repo.tokens.get({id});

	if(token)
		compose.call(this, token);
}

function compose(token){
	let { id, currency, issuer: issuerId } = token;
	let issuer = this.repo.accounts.get({id: issuerId});	

	let currencyMetas = this.repo.metas.all({token});
	let issuerMetas = this.repo.metas.all({account: issuerId});
	let meta = {
		currency: sortMetas(
			mapMultiKey(currencyMetas, 'key', true),
			this.config.meta.sourcePriorities
		),
		issuer: sortMetas(
			mapMultiKey(issuerMetas, 'key', true),
			this.config.meta.sourcePriorities
		)
	};

	let trusted = [meta.currency, meta.issuer].some(({ trusted, xumm_trusted }) => {
		if(trusted && trusted[0].value)
			return true

		if(xumm_trusted && xumm_trusted[0].value)
			return true
	});

	let currentStats = this.repo.stats.get(token);
	let stats = {
		marketcap: new Decimal(0),
		volume: {
			day: new Decimal(0),
			week: new Decimal(0),
		},
		trustlines: 0
	};

	let now = unixNow();
	let candles = this.cache.candles.all(
		{base: id, quote: null, timeframe: 3600},
		now - 60*60*24*7
	);


	if(currentStats){
		stats.supply = currentStats.supply;
		stats.liquidity = {ask: currentStats.ask, bid: currentStats.bid};
		stats.trustlines = currentStats.trustlines;

		let yesterday = this.repo.stats.get(token, currentStats.date - 60*60*24);
		let lastWeek = this.repo.stats.get(token, currentStats.date - 60*60*24*7);

		if(yesterday){
			stats.trustlines_change = {
				day: currentStats.trustlines - yesterday.trustlines,
				week: currentStats.trustlines - lastWeek.trustlines
			};
		}
	}

	if(candles.length > 0){
		let newestCandle = candles[candles.length - 1];
		let yesterdaysCandle = candles.find(candle => candle.t >= newestCandle.t - 60*60*24);
		let lastWeeksCandle = candles[0];

		stats.price = newestCandle.c;
		stats.price_change = {
			day: (newestCandle.c / yesterdaysCandle.o - 1) * 100,
			week: (newestCandle.c / lastWeeksCandle.o - 1) * 100
		};

		stats.marketcap = Decimal.mul(stats.supply || 0, newestCandle.c);
		stats.volume = {
			day: Decimal.sum(
				...candles
					.slice(candles.indexOf(yesterdaysCandle))
					.map(candle => candle.v)
			),
			week: Decimal.sum(
				...candles
					.map(candle => candle.v)
			)
		};
	}

	let composed = {
		id,
		currency, 
		issuer: issuer.address,
		meta,
		stats,
		trusted
	};

	this.cache.tokens.insert({
		...composed,
		popular: calculatePopularityScore(composed)
	});
}

function calculatePopularityScore(token){
	let score = 0;

	if(token.stats.volume)
		score += parseFloat(token.stats.volume.day);

	if(token.stats.trustlines)
		score += token.stats.trustlines * 5;

	if(token.stats.trustlines_change)
		score += token.stats.trustlines_change.day * 5;

	if(token.trusted)
		score *= 1.5;

	return score
}


function sortMetas(metas, priorities){
	let sorted = {};

	for(let [key, values] of Object.entries(metas)){
		if(Array.isArray(values)){
			sorted[key] = keySort(values, meta => {
				let index = priorities.indexOf(meta.source);

				return index >= 0 ? index : 9999
			});
		}else if(typeof values === 'object'){
			sorted[key] = sortMetas(values, priorities);
		}
	}

	return sorted
}

const log$1 = log$4.branch({
	name: 'sync:stats',
	color: 'cyan'
});



function allocate$1(heads){
	log$1.time(`sync.stats`, `building stats cache`);

	let tokens = this.repo.tokens.all();
	let progress = 0;
	
	for(let i=0; i<tokens.length; i++){
		let token = tokens[i].id;
		let stats = this.repo.stats.all({token});
		let refTimeframe = Object.values(this.repo.config.tokens.stats.timeframes)[0];

		if(stats.length === 0)
			continue

		let candles = this.cache.candles.all(
			{
				base: token, 
				quote: null, 
				timeframe: refTimeframe
			}
		);

		let aligned = leftProximityZip(
			{
				array: stats,
				key: stat => Math.floor(stat.date / refTimeframe),
			},
			{
				array: candles,
				key: candle => Math.floor(candle.t / refTimeframe),
			}
		);

		

		let combined = aligned
			.map(([{ id, ...stat }, candle]) => ({
				...stat,
				marketcap: candle
					? Decimal.mul(stat.supply, candle.c).toString() 
					: '0'
			}))
			.map(({ token, ...stats }) => stats);

		for(let timeframe of Object.values(this.config.tokens.market.timeframes)){
			this.cache.stats.allocate({token, timeframe}, combined);
		}

		let newProgress = Math.floor((i / tokens.length) * 100);

		if(newProgress !== progress){
			progress = newProgress;
			log$1.info(`processed`, i, `of`, tokens.length, `stats (${progress}%)`);
		}
	}

	log$1.time(`sync.stats`, `built stats cache in %`);
}

function register({ affected, ranges }){
	let timeframeCandles = Object.values(this.repo.config.tokens.stats.timeframes)[0];

	if(!ranges.stats)
		return

	let newStats = this.repo.stats.all({
		from: ranges.stats[0],
		to: ranges.stats[1]
	});

	for(let { token, ...stats } of newStats){
		let candle = this.cache.candles.all(
			{
				base: token,
				quote: null,
				timeframe: timeframeCandles
			},
			Math.floor(stats.date / timeframeCandles) * timeframeCandles,
			Math.ceil(stats.date / timeframeCandles) * timeframeCandles
		)[0];

		for(let timeframe of Object.values(this.config.tokens.market.timeframes)){
			this.cache.stats.integrate(
				{
					token,
					timeframe
				},
				{
					...stats,
					marketcap: candle
						? Decimal.mul(stats.supply, candle.c).toString()
						: '0',
				}
			);
		}
	}
}

const log = log$4.branch({
	name: 'sync',
	color: 'cyan'
});


var initSync = async ctx => {
	try{
		if(ctx.cache.isEmpty()){
			allocate(ctx);
		}else {
			if(Object.keys(ctx.cache.heads.all()).length === 0)
				throw 'incomplete'
		}
	}catch(e){
		log.error(`caching database corrupted (${e}) -> recreating from scratch`);

		ctx.cache.wipe();
		allocate(ctx);
	}

	loop(ctx);
};

function allocate(ctx){
	let repoHeads = ctx.repo.heads.all();

	log.time(`sync.prepare`, `building caching database`);

	allocate$3.call(ctx, repoHeads);
	allocate$1.call(ctx, repoHeads);
	allocate$2.call(ctx, repoHeads);

	log.time(`sync.prepare`, `built complete caching database in %`);

	ctx.cache.heads.set(repoHeads);
}

async function loop(ctx){
	let cacheHeads;
	let repoHeads;

	while(true){
		try{
			cacheHeads = ctx.cache.heads.all();
			repoHeads = ctx.repo.heads.all();
		}catch{
			await wait(1000);
			continue
		}

		let ranges = {};
		let affected = [];

		for(let [k, i] of Object.entries(repoHeads)){
			if(i > cacheHeads[k]){
				let newRows = ctx.repo.heads.diff(k, cacheHeads[k], i);

				ranges[k] = [cacheHeads[k], i];

				switch(k){
					case 'tokens':
						for(let row of newRows){
							affected.push({
								type: {A: 'account', T: 'token'}[row.type],
								id: row.subject,
								context: 'self'
							});
						}
						break

					case 'exchanges':
						for(let row of newRows){
							if(row.base){
								affected.push({
									type: 'token',
									id: row.base,
									context: 'exchange'
								});
							}

							if(row.quote){
								affected.push({
									type: 'token',
									id: row.quote,
									context: 'exchange'
								});
							}
						}
						break

					case 'metas':
						for(let row of newRows){
							affected.push({
								type: {A: 'account', T: 'token'}[row.type],
								id: row.subject,
								context: 'meta'
							});
						}
						break

					case 'stats':
						for(let row of newRows){
							affected.push({
								type: 'token',
								id: row.token,
								context: 'stats'
							});
						}
						break
				}
			}
		}

		if(affected.length === 0){
			let outdatedTokens = ctx.cache.tokens.all({updatedBefore: unixNow() - 60 * 60});

			if(outdatedTokens.length > 0){
				log.time(`sync.tokensupdate`, `updating ${outdatedTokens.length} outdated tokens`);

				try{
					ctx.cache.tx(() => {
						for(let { id } of outdatedTokens){
							update.call(ctx, id);
						}
					});
				}catch(e){
					log.error(`failed to commit token updates:\n`, e);
				}

				log.time(`sync.tokensupdate`, `updated outdated tokens in %`);
			}

			await wait(100);
			continue
		}

		let uniqueAffected = [];

		for(let affect of affected){
			let existing = uniqueAffected.find(u => u.type === affect.type && u.id === affect.id);

			if(!existing){
				uniqueAffected.push(existing = {
					type: affect.type,
					id: affect.id,
					contexts: []
				});
			}

			if(!existing.contexts.includes(affect.context))
				existing.contexts.push(affect.context);
		}

		affected = uniqueAffected;


		log.time(
			`sync.update`,
			`tracked updates:`,
			Object.entries(ranges)
				.map(([key, [o, n]]) => `${key} -> ${o}-${n}`)
				.join(`, `)
		);
		
		try{
			ctx.cache.tx(() => {
				log.time(`sync.update.exchanges`);
				register$2.call(ctx, {ranges, affected});
				log.time(`sync.update.exchanges`, `applied exchanges in %`);

				log.time(`sync.update.stats`);
				register.call(ctx, {ranges, affected});
				log.time(`sync.update.stats`, `applied stats in %`);

				log.time(`sync.update.tokens`);
				register$1.call(ctx, {ranges, affected});
				log.time(`sync.update.tokens`, `applied tokens in %`);

				ctx.cache.heads.set(repoHeads);
			});
		}catch(e){
			log.error(`failed to commit updates:\n`, e);
			await wait(1000);
			continue
		}

		log.time(`sync.update`, `committed updates in %`);
	}
}

function collapseMetas(metas, sourcePriority){
	let collapsed = {};

	for(let [key, values] of Object.entries(metas)){
		if(!values)
			continue

		if(Array.isArray(values)){
			let meta = values[0];

			if(meta.value)
				collapsed[key] = meta.value;
		}else {
			collapsed[key] = collapseMetas(values);
		}
	}

	return collapsed
}

const allowedSorts = [
	'popular',
	'marketcap',
	'price_day',
	'price_week',
	'volume_week', 
	'volume_day', 
	'trustlines',
	'trustlines_day',
	'trustlines_week',
];

const metricDivisions = {
	market: ['candle', 'price', 'volume'],
	stats: ['trustlines', 'marketcap', 'supply', 'liquidity', 'distribution']
};

const collapseToken = (token, prios) => ({
	...token,
	meta: {
		currency: collapseMetas(
			token.meta.currency),
		issuer: collapseMetas(
			token.meta.issuer)
	}
});


async function currencies(ctx){
	let limit = ctx.parameters.limit || 100;
	let offset = ctx.parameters.offset || 0;
	let minTokens = ctx.parameters.min_tokens || 100;
	let filter = ctx.parameters.filter;
	let total = ctx.cache.currencies.count();
	let currencies = ctx.cache.currencies.all({limit, offset, filter});
	let stacks = [];


	for(let { currency, marketcap, volume } of currencies){
		let tokens = ctx.cache.tokens.all({
			currency,
			minAccounts: minTokens,
			limit: 3
		});

		if(tokens.length === 0)
			continue

		stacks.push({
			currency,
			tokens,
			stats: {
				marketcap: marketcap.toString(),
				volume: volume.toString()
			}
		});
	}

	return {
		currencies: stacks, 
		count: total
	}
}

async function tokens(ctx){
	let limit = Math.min(1000, ctx.parameters.limit || 100);
	let offset = ctx.parameters.offset || 0;
	let sort = ctx.parameters.sort || allowedSorts[0];
	let trusted = ctx.parameters.trusted;
	let search = ctx.parameters.search;
	ctx.cache.tokens.count();
	ctx.config.meta.sourcePriorities;

	if(!allowedSorts.includes(sort))
		throw {message: `sort "${sort}" is not allowed. possible values are: ${allowedSorts.join(', ')}`, expose: true}

	return ctx.cache.tokens.all({limit, offset, sort, trusted, search})
		.map(token => collapseToken(token))
}


async function token(ctx){
	let { token: { currency, issuer }, full } = ctx.parameters;
	let token = ctx.cache.tokens.get({currency, issuer}, full);
	
	if(!token){
		throw {message: `token not listed`, expose: true}
	}

	return full
		? token
		: collapseToken(token, ctx.config.meta.sourcePriorities)
}


async function token_metric(ctx){
	let { token: { currency, issuer }, metric, timeframe, start, end } = ctx.parameters;
	let token = ctx.cache.tokens.get({currency, issuer});
	let division = Object.keys(metricDivisions)
		.find(key => metricDivisions[key].includes(metric));

	if(!token){
		throw {
			message: `token not listed`, 
			expose: true
		}
	}

	if(!division){
		throw {
			message: `metric "${metric}" is not available. available metrics are: ${
				[...metricDivisions.market, ...metricDivisions.stats].join(', ')
			}`, 
			expose: true
		}
	}

	if(!ctx.config.tokens[division].timeframes[timeframe]){
		throw {
			message: `timeframe "${timeframe}" not available - available timeframes are: ${
				Object.keys(ctx.config.tokens[division].timeframes).join(', ')
			}`, 
			expose: true
		}
	}

	if(division === 'market'){
		let candles = ctx.cache.candles.all(
			{
				base: token.id, 
				quote: null, 
				timeframe: ctx.config.tokens.market.timeframes[timeframe]
			},
			start,
			end
		);

		if(metric === 'price'){
			return candles.map(candle => ({
				t: candle.t,
				v: candle.c
			}))
		}else if(metric === 'volume'){
			return candles.map(candle => ({
				t: candle.t,
				v: candle.v
			}))
		}else {
			return candles
		}
	}else if(division === 'stats'){
		let stats = ctx.cache.stats.all(
			{
				token: token.id, 
				timeframe: ctx.config.tokens.stats.timeframes[timeframe]
			}, 
			start,
			end
		);

		return stats.map(stat => ({
			t: stat.date,
			v: stat[metric]
		}))
	}
}

var procedures = /*#__PURE__*/Object.freeze({
	__proto__: null,
	currencies: currencies,
	tokens: tokens,
	token: token,
	token_metric: token_metric
});

class HTTPRouter extends Router{
	constructor(ctx){
		super();

		this.ctx = ctx;

		this.get(
			'/tokens', 
			this.wrappedProcedure('tokens')
		);

		this.get(
			'/token/:token', 
			this.wrappedProcedure(
				'token', 
				parameters => ({
					...parameters,
					token: this.parseTokenURI(parameters.token),
					full: parameters.hasOwnProperty('full')
				})
			)
		);

		this.get(
			'/token/:token/:metric/:timeframe', 
			this.wrappedProcedure(
				'token_metric', 
				parameters => ({
					...parameters,
					token: this.parseTokenURI(parameters.token)
				})
			)
		);
	}

	parseTokenURI(uri){
		let [currency, issuer] = uri.split(':');

		return {
			currency,
			issuer
		}
	}

	wrappedProcedure(name, transformParameters){
		return async ctx => {
			if(!procedures[name]){
				ctx.throw(404);
				return
			}

			try{
				let parameters = {
					...ctx.query, 
					...ctx.params
				};

				if(transformParameters)
					parameters = transformParameters(parameters);

				ctx.body = await procedures[name]({
					...this.ctx, 
					parameters
				});
			}catch(e){
				let { expose, ...error } = e;

				console.log(e);

				if(expose){
					ctx.status = 400;
					ctx.body = error;
				}else {
					ctx.status = 500;
					console.error(error);
				}
			}
		}
	}
}

class WSManager{
	constructor(ctx){
		this.ctx = ctx;
		this.clients = [];
		this.counter = 0;
	}

	register(socket){
		 let client = {
			id: ++this.counter,
			socket, 
			subscriptions: []
		};

		socket.on('message', async message => {
			try{
				var request = JSON.parse(message);
			}catch{
				log$4.info(`client #${client.id} sent malformed request - dropping them`);
				socket.close();
			}

			try{
				if(request.command === 'subscribe'){
					socket.send(JSON.stringify({
						result: await this.subscribe(client, request),
						id: request.id, 
					}));
				}else {
					socket.send(JSON.stringify({
						result: await this.serveRequest(client, request),
						id: request.id, 
					}));
				}
			}catch(error){
				let response = null;

				if(typeof error === 'object'){
					if(error.expose)
						response = error;
				}

				if(!response){
					log$4.info(`internal server error while serving client #${client.id}:`, error);
					response = {message: 'internal server error'};
				}

				socket.send(JSON.stringify({id: request.id, error: response}));
			}
		});

		socket.on('close', () => {
			this.clients.splice(this.clients.indexOf(client));
			log$4.info(`client #${client.id} disconnected`);
		});

		this.clients.push(client);
		log$4.info(`new connection (#${client.id})`);
	}

	async serveRequest(client, request){
		if(!procedures[request.command]){
			throw {message: 'unknown command', expose: true}
		}

		return await procedures[request.command]({
			...this.ctx,
			parameters: request
		})
	}

	async subscribe(client, request){
		
	}
}

log$4.config({
	name: 'api',
	color: 'green'
});


var initApi = ({config, cache}) => {
	let koa = new Koa();
	let router = new HTTPRouter({cache, config});
	let ws = new WSManager({cache, config});

	koa.use(websocket());
	koa.use(async (ctx, next) => {
		if(ctx.ws){
			ws.register(await ctx.ws());
		}else {
			return await next(ctx)
		}
	});

	koa.use(router.routes(), router.allowedMethods());
	koa.listen(config.server.port);

	log$4.info(`listening on port ${config.server.port}`);
};

const args = minimist(process.argv.slice(2));
const configPath = args.config || 'server.toml';
	
log$4.config({
	name: 'main',
	color: 'yellow',
	severity: args.log || 'info'
});

log$4.info(`*** XRPLMETA API SERVER ***`);
log$4.info(`starting with config "${configPath}"`);

const rawconf = load(configPath);
const config = assignDeep(rawconf, args);
const repo = initRepo({...config, readonly: false});
const cache = initCache(config);


await initSync({config, repo, cache});
await initApi({config, cache});
