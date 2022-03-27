import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import minimist from 'minimist';
import log from '@xrplmeta/log';
import { parse as parse$1, load } from '@xrplmeta/toml';
import initRepo from '@xrplmeta/repo';
import EventEmitter from 'events';
import xrpl from 'xrpl';
import { wait, unixNow, rippleToUnix, deriveExchanges, currencyHexToUTF8, keySort, decimalCompare, batched } from '@xrplmeta/utils';
import fetch from 'node-fetch';
import { RateLimiter } from 'limiter';
import Decimal from 'decimal.js';
import fs from 'fs';

class Pool extends EventEmitter{
	constructor(config){
		super();

		this.log = log.branch({name: 'xrpl', color: 'yellow'});
		this.queue = [];
		this.clients = [];
		this.seen = [];

		for(let spec of config.nodes){
			if(spec.disabled)
				continue

			let connections = spec.connections || 1;

			for(let i=0; i<connections; i++){
				let client = new xrpl.Client(spec.url, {timeout: 60000});

				//yes
				client.spec = spec;

				client.on('transaction', tx => {
					if(!this.hasSeen(`tx${tx.transaction.hash}`))
						this.emit('transaction', tx);
				});
				client.on('ledgerClosed', ledger => {
					if(ledger.validated_ledgers){
						client.spec.ledgers = ledger.validated_ledgers
							.split(',')
							.map(range => range
								.split('-')
								.map(i => parseInt(i))
							);
					}

					if(!this.hasSeen(`ledger${ledger.ledger_index}`))
						this.emit('ledger', ledger);
				});
				client.on('connected', () => {
					this.printConnections(`${client.spec.url} established`);
					this.subscribeClient(client);
				});
				client.on('disconnected', async code => {
					this.printConnections(`${client.spec.url} disconnected: code ${code}`);
					this.relentlesslyConnect(client);
				});
				client.on('error', error => {
					this.log.error(`${client.spec.url} error: ${error}`);
				});
				

				this.clients.push(client);
				this.relentlesslyConnect(client);
			}
		}

		this.loop();
	}

	hasSeen(key){
		if(this.seen.includes(key))
			return true

		this.seen.push(key);

		if(this.seen.length > 1000)
			this.seen.shift();
	}

	async loop(){
		while(true){
			for(let job of this.queue){
				let { request } = job;

				let potentialNodes = this.clients
					.filter(({spec}) => !spec.allowedCommands 
						|| spec.allowedCommands.includes(request.command)
					);

				if(request.ledger_index){
					potentialNodes = potentialNodes.filter(({spec}) => spec.ledgers 
						&& spec.ledgers.some(([start, end]) => 
							request.ledger_index >= start && request.ledger_index <= end));
				}

				let bidders = potentialNodes
					.map(client => ({client, bid: this.bidForJob(client, job)}))
					.filter(({bid}) => bid)
					.sort((a, b) => b.bid - a.bid)
					.map(({client}) => client);

				if(bidders.length === 0)
					continue

				job.started();

				this.doJob(bidders[0], job);
				this.queue = this.queue.filter(j => j !== job);
			}

			await wait(100);
		}
	}

	bidForJob(client, job){
		if(!client.isConnected())
			return

		if(client.spec.busy)
			return null

		let bid = 1 - this.clients.indexOf(client) * 0.001;

		// todo: take latency and node health into account

		return bid
	}

	async doJob(client, job){
		client.spec.busy = true;

		try{
			let { result } = await client.request(job.request);

			job.resolve(result);
		}catch(error){
			job.reject(error);
		}

		client.spec.busy = false;
	}


	request({priority, ...request}){
		priority = priority || 0;

		return new Promise((resolve, reject) => {
			let insertAt = this.queue.length - 1;
			let timeout = setTimeout(() => reject('NO_NODE_AVAILABLE'), 30000);
			let started = () => clearTimeout(timeout);

			while(insertAt > 0 && priority > this.queue[insertAt].priority){
				insertAt--;
			}

			this.queue.splice(insertAt, 0, {priority, request, resolve, reject, started});
		})
	}

	async subscribeClient(client){
		if(client.spec.allowedCommands && !client.spec.allowedCommands.includes('subscribe'))
			return

		await client.request({
			command: 'subscribe',
			streams: ['ledger', 'transactions']
		});
	}

	async relentlesslyConnect(client){
		while(!client.isConnected()){
			try{
				await client.connect();
			}catch(error){
				await wait(3000);
			}
		}
	}

	printConnections(recent){
		let online = this.clients.filter(client => client.isConnected()).length;

		this.log.info(`connected to ${online} / ${this.clients.length} nodes ${recent ? `(${recent})` : ''}`);
	}
}

class Host{
	constructor(config){
		this.pool = new Pool(config);
		this.pool.on('ledger', ledger => this.dispatchEmit('ledger', ledger));
		this.pool.on('transaction', tx => this.dispatchEmit('transaction', tx));
		this.workers = [];
	}

	register(worker){
		this.workers.push(worker);

		worker.on('message', ({type, payload}) => {
			switch(type){
				case 'xrpl.invoke':
					this.pool[payload.method](...payload.args)
						.then(data => worker.send({
							type: 'xrpl.invoke', 
							payload: {id: payload.id, data}
						}))
						.catch(error => worker.send({
							type: 'xrpl.invoke', 
							payload: {id: payload.id, error}
						}));
					break

			}
		});
	}

	discard(worker){
		this.workers.splice(this.workers.indexOf(worker), 1);
	}

	dispatchEmit(event, data){
		for(let worker of this.workers){
			worker.send({type: 'xrpl.event', payload: {event, data}});
		}
	}
}

class Client extends EventEmitter{
	constructor(){
		super();
		this.requests = [];
		this.counter = 0;
		process.on('message', ({type, payload}) => {
			switch(type){
				case 'xrpl.event':
					this.emit(payload.event, payload.data);
					break

				case 'xrpl.invoke':
					let req = this.requests.find(r => r.id === payload.id);

					if(req){
						if(payload.data)
							req.resolve(payload.data);
						else
							req.reject(payload.error);

						this.requests.splice(this.requests.indexOf(req), 1);
					}

					break
			}
		});
	}

	async request(...args){
		return await new Promise((resolve, reject) => {
			let id = this.counter++;

			this.requests.push({id, resolve, reject});
			process.send({type: 'xrpl.invoke', payload: {id, method: 'request', args}});

		})
	}
}

class Rest{
	constructor(config){
		this.config = config || {};
		this.limiter = config.ratelimit 
			? new RateLimiter({
				tokensPerInterval: config.ratelimit, 
				interval: 'minute'
			}) 
			: null;
	}

	extend(props){
		let config = {};

		config.base = props.base.indexOf('http')===0 ? props.base : ((this.config.base ? this.config.base+'/' : '')+props.base);
		config.data = Object.assign({}, this.config.data || {}, props.data || {});
		config.headers = Object.assign({}, this.config.headers || {}, props.headers || {});

		return new this.constructor(config)
	}

	get(...args){
		return this.makeRequest('get', ...args)
	}

	post(...args){
		return this.makeRequest('post', ...args)
	}

	delete(...args){
		return this.makeRequest('delete', ...args)
	}

	
	async makeRequest(method, route, data, options){
		data = this.mergeData(data || {});
		options = options || {};

		let headers = options.headers || {};


		let url = this.getURL(route);
		let req = {
			method: method,
			headers: Object.assign(
				{
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				Object.assign({}, this.config.headers || {}, headers)
			)
		};

		for(let key of ['redirect']){
			if(!options[key])
				continue

			req[key] = options[key];
		}


		if(method === 'get'){
			let query = new URLSearchParams(data).toString();

			if(query.length > 0)
				url += '?' + query;
		}else {
			req.body = JSON.stringify(data);
		}

		if(this.limiter)
			await this.limiter.removeTokens(1);

		return await fetch(url, req)
			.then(res => {
				if(options.raw){
					return res
				}

				if (!res.ok) {
					let error = new Error(`HTTP ${res.status}`);

					error.httpCode = res.status;

					return res.text()
						.then(text => {
							try{
								Object.assign(error, JSON.parse(text));
							}catch{
								error.text = text;
							}

							throw error
						})
				}else {
					return res.json()
						.catch(err => null)
				}
			})
	}

	getURL(route){
		if(this.config.base)
			route = this.sanitizeUrl(this.config.base + '/' + route);

		return route
	}

	sanitizeUrl(str){
		return str.slice(0, 8) + str.slice(8)
			.replace(/\/\//g,'/')
			.replace(/\/\.$/, '')
			.replace(/\/$/, '')
	}

	mergeData(data){
		if(!this.config.data)
			return data

		return Object.assign({}, data, this.config.data)
	}
}


function URLSearchParams(query) {
	var
		index, key, value,
		pairs, i, length,
		dict = Object.create(null)
	;
	this[secret] = dict;
	if (!query) return;
	if (typeof query === 'string') {
		if (query.charAt(0) === '?') {
			query = query.slice(1);
		}
		for (
			pairs = query.split('&'),
			i = 0,
			length = pairs.length; i < length; i++
		) {
			value = pairs[i];
			index = value.indexOf('=');
			if (-1 < index) {
				appendTo(
					dict,
					decode(value.slice(0, index)),
					decode(value.slice(index + 1))
				);
			} else if (value.length){
				appendTo(
					dict,
					decode(value),
					''
				);
			}
		}
	} else {
		if (isArray(query)) {
			for (
				i = 0,
				length = query.length; i < length; i++
			) {
				value = query[i];
				appendTo(dict, value[0], value[1]);
			}
		} else if (query.forEach) {
			query.forEach(addEach, dict);
		} else {
			for (key in query) {
				 appendTo(dict, key, query[key]);
			}
		}
	}
}

var
	isArray = Array.isArray,
	URLSearchParamsProto = URLSearchParams.prototype,
	find = /[!'\(\)~]|%20|%00/g,
	plus = /\+/g,
	replace = {
		'!': '%21',
		"'": '%27',
		'(': '%28',
		')': '%29',
		'~': '%7E',
		'%20': '+',
		'%00': '\x00'
	},
	replacer = function (match) {
		return replace[match];
	},
	secret = '__URLSearchParams__:' + Math.random()
;

function addEach(value, key) {
	/* jshint validthis:true */
	appendTo(this, key, value);
}

function appendTo(dict, name, value) {
	var res = isArray(value) ? value.join(',') : value;
	if (name in dict)
		dict[name].push(res);
	else
		dict[name] = [res];
}

function decode(str) {
	return decodeURIComponent(str.replace(plus, ' '));
}

function encode(str) {
	return encodeURIComponent(str).replace(find, replacer);
}

URLSearchParamsProto.append = function append(name, value) {
	appendTo(this[secret], name, value);
};

URLSearchParamsProto.delete = function del(name) {
	delete this[secret][name];
};

URLSearchParamsProto.get = function get(name) {
	var dict = this[secret];
	return name in dict ? dict[name][0] : null;
};

URLSearchParamsProto.getAll = function getAll(name) {
	var dict = this[secret];
	return name in dict ? dict[name].slice(0) : [];
};

URLSearchParamsProto.has = function has(name) {
	return name in this[secret];
};

URLSearchParamsProto.set = function set(name, value) {
	this[secret][name] = ['' + value];
};

URLSearchParamsProto.forEach = function forEach(callback, thisArg) {
	var dict = this[secret];
	Object.getOwnPropertyNames(dict).forEach(function(name) {
		dict[name].forEach(function(value) {
			callback.call(thisArg, value, name, this);
		}, this);
	}, this);
};

URLSearchParamsProto.toJSON = function toJSON() {
	return {};
};

URLSearchParamsProto.toString = function toString() {
	var dict = this[secret], query = [], i, key, name, value;
	for (key in dict) {
		name = encode(key);
		for (
			i = 0,
			value = dict[key];
			i < value.length; i++
		) {
			query.push(name + '=' + encode(value[i]));
		}
	}
	return query.join('&');
};

const leeway = 1;


var context = ({config, repo, xrpl}) => {
	let countings = {};

	return {
		config,
		repo,
		xrpl,
		loopLedgerTask: async (specs, task) => {
			while(true){
				try{
					let { ledger, closed } = await xrpl.request({command: 'ledger'});
					let now = ledger?.ledger_index || closed?.ledger.ledger_index - leeway;
					let head = Math.floor(now / specs.interval) * specs.interval;
					let covered = await repo.coverages.get(specs.task, head);
					let chosen = head;

					while(covered){
						let oneBefore = covered.tail - 1;
						
						chosen = Math.floor(oneBefore / specs.backfillInterval) * specs.backfillInterval;
						covered = await repo.coverages.get(specs.task, chosen);
					}

					await task(chosen, chosen < head);
					await repo.coverages.extend(specs.task, chosen);
				}catch(e){
					log.info(`ledger task "${specs.task}" failed:\n`, e);
					await wait(3000);
				}
			}
		},
		loopTimeTask: async (specs, task) => {
			while(true){
				if(specs.subject){
					let operation = await repo.operations.getNext(specs.task, specs.subject);

					if(!operation || (operation.result === 'success' && operation.start + specs.interval > unixNow())){
						await wait(1000);
						continue
					}

					await repo.operations.record(
						specs.task, 
						`${specs.subject}${operation.entity}`, 
						task(unixNow(), operation.entity)
					);
				}else {
					let recent = await repo.operations.getMostRecent(specs.task);

					if(recent && recent.result === 'success' && recent.start + specs.interval > unixNow()){
						await wait(1000);
						continue
					}

					await repo.operations.record(specs.task, null, task(unixNow()));
				}
			}
		},
		count: (text, count, addition) => {
			if(!countings[text]){
				countings[text] = 0;
				setTimeout(() => {
					if(addition)
						log.info(text.replace('%', countings[text]), addition);
					else
						log.info(text.replace('%', countings[text]));
					delete countings[text];
				}, 10000);
			}

			countings[text] += count || 1;
		}
	}
};

function fromTxs(txs){
	let pays = 0;
	let trusts = 0;
	let untrusts = 0;
	let offers = 0;
	let cancels = 0;
	let fees = 0;
	let accounts = new Set();

	for(let tx of txs){
		let result = tx.engine_result 
			|| tx.meta?.TransactionResult 
			|| tx.metaData?.TransactionResult;

		if(result !== 'tesSUCCESS')
			continue

		if(tx.transaction)
			tx = tx.transaction;

		accounts.add(tx.Account);
		fees += parseInt(tx.Fee);

		switch(tx.TransactionType){
			case 'Payment':
				pays++;
				break

			case 'OfferCreate':
				offers++;
				break

			case 'OfferCancel':
				cancels++;
				break

			case 'TrustSet':
				if(tx.LimitAmount.value !== '0')
					trusts++;
				else
					untrusts++;
				break
		}
	}

	return {
		txs: txs.length,
		pays,
		trusts,
		untrusts,
		offers,
		cancels,
		fees,
		accounts: accounts.size
	}
}

var stream = ({repo, config, xrpl, loopLedgerTask}) => {
	let open = null;
	let commit = () => {
		let exchanges = [];

		for(let tx of open.txs){
			if(tx.engine_result !== 'tesSUCCESS')
				continue

			if(['OfferCreate', 'Payment'].includes(tx.transaction.TransactionType)){
				try{
					exchanges.push(...deriveExchanges(tx));
				}catch(e){
					log.info(`failed to parse exchanges:\n`, e);
					continue
				}
			}
		}

		try{
			repo.exchanges.insert(exchanges.map(exchange => ({...exchange, ledger: open.index})));
			repo.ledgers.insert({index: open.index, date: open.time, ...fromTxs(open.txs)});
			repo.coverages.extend('ledgertx', open.index);

			log.info(`recorded ${exchanges.length} exchange(s)`);
		}catch(e){
			log.info(`failed to record ${exchanges.length} exchange(s):\n`, e);
		}
		
		open = null;
	};

	xrpl.on('ledger', ledger => {
		if(open){
			log.info(`ledger #${open.index} was incomplete (${open.txs.length} txs gone to waste)`);
		}

		open = {
			index: ledger.ledger_index,
			expecting: ledger.txn_count,
			time: rippleToUnix(ledger.ledger_time),
			txs: []
		};
	});

	xrpl.on('transaction', tx => {
		if(!open)
			return

		open.txs.push(tx);

		if(open.txs.length >= open.expecting)
			commit();
	});
};

var initSnapshot = (file, inMemory) => {
	if(file !== ':memory:')
		if(fs.existsSync(file))
			fs.unlinkSync(file);

	return initRepo({
		file,
		journalMode: 'MEMORY',
		cacheSize: 10000
	})
};

var snapshot = ({repo, config, xrpl, loopLedgerTask}) => {
	loopLedgerTask(
		{
			task: 'snapshot',
			interval: config.ledger.snapshotInterval,
			backfillLedgers: config.ledger.snapshotHistoryLedgers,
			backfillInterval: config.ledger.snapshotHistoryInterval,
		},
		async (index, isBackfill) => {
			let replaceAfter = isBackfill
				? null
				: Math.floor(index / config.ledger.snapshotHistoryInterval) 
					* config.ledger.snapshotHistoryInterval;

			log.time(`snapshot`, `starting ${isBackfill ? 'backfill' : 'full'} snapshot of ledger #${index}`);

			let snapshotFile = config.ledger.snapshotInMemory
				? `:memory:`
				: `${config.data.dir}/snapshot.db`;


			let snapshot = initSnapshot(snapshotFile);
			let queue = fillQueue(xrpl, index);
			let chunk;
			let scanned = 0;

			if(log.level === 'debug')
				snapshot.enableQueryProfiling();

			log.time(`snapshot.record`);

			while(chunk = await queue()){
				log.time(`snapshot.chunk`);

				await snapshot.tx(async () => {
					for(let state of chunk){

						if(state.LedgerEntryType === 'RippleState'){
							let currency = currencyHexToUTF8(state.HighLimit.currency);
							let issuer = state.HighLimit.value === '0' ? state.HighLimit.issuer : state.LowLimit.issuer;
							let holder = state.HighLimit.value !== '0' ? state.HighLimit.issuer : state.LowLimit.issuer;

							snapshot.balances.insert({
								account: holder,
								token: {currency, issuer},
								balance: state.Balance.value.replace(/^-/, '')
							});
						}else if(state.LedgerEntryType === 'AccountRoot'){
							snapshot.accounts.insert({
								address: state.Account,
								emailHash: state.EmailHash || null,
								domain: state.Domain 
									? Buffer.from(state.Domain, 'hex')
										.toString()
										.replace(/^https?:\/\//, '')
										.replace(/\/$/, '')
									: null
							});

							snapshot.balances.insert({
								account: state.Account,
								token: null,
								balance: new Decimal(state.Balance)
									.div('1000000')
									.toString()
							});
						}else if(state.LedgerEntryType === 'Offer'){
							let base;
							let quote;
							let gets;
							let pays;

							if(typeof state.TakerGets === 'string'){
								base = null;
								gets = new Decimal(state.TakerGets)
									.div('1000000')
									.toString();
							}else {
								base = {
									currency: currencyHexToUTF8(state.TakerGets.currency),
									issuer: state.TakerGets.issuer
								};
								gets = state.TakerGets.value;
							}

							if(typeof state.TakerPays === 'string'){
								quote = null;
								pays = new Decimal(state.TakerPays)
									.div('1000000')
									.toString();
							}else {
								quote = {
									currency: currencyHexToUTF8(state.TakerPays.currency),
									issuer: state.TakerPays.issuer
								};
								pays = state.TakerPays.value;
							}

							snapshot.offers.insert({
								account: state.Account,
								base,
								quote,
								gets,
								pays
							});
						}
					}
				});
				
				scanned += chunk.length;
				log.time(`snapshot.chunk`, `scanned`, scanned, `entries (chunk took %)`);
			}

			log.time(`snapshot.record`, `took snapshot in %`);
			log.time(`snapshot.compute`, `computing metadata`);

			let accounts = [];
			let balances = [];
			let stats = [];
			let liquidity = new Decimal(0);

			let relevantTokens = snapshot.iterate(
				`SELECT 
					Tokens.id, 
					currency,  
					address as issuer,
					domain as issuerDomain,
					emailHash as issuerEmailHash
				FROM 
					Tokens 
					INNER JOIN Accounts ON (Accounts.id = Tokens.issuer)`
			);

			for(let token of relevantTokens){
				let lines = snapshot.balances.all({token});

				if(lines.length < config.ledger.minTrustlines)
					continue


				let nonZeroBalances = keySort(
					lines.filter(({balance}) => balance !== '0'),
					({balance}) => new Decimal(balance),
					decimalCompare.DESC
				);

				let count = lines.length;
				let holders = nonZeroBalances.length;
				let bid = new Decimal(0);
				let ask = new Decimal(0);
				let supply = nonZeroBalances
					.reduce((sum, {balance}) => sum.plus(balance), new Decimal(0));

				
				for(let { account, balance } of lines){
					let offers = snapshot.all(
						`SELECT * FROM Offers
						WHERE account = ?
						AND (base = ? OR quote = ?)`,
						account,
						token.id,
						token.id,
					);

					if(offers.length > 0){
						for(let offer of offers){
							let xrpBalance = snapshot.balances.get({
								account, 
								token: null
							});

							if(xrpBalance){
								if(offer.quote === null){
									let amount = Decimal.min(offer.pays, xrpBalance.balance);

									bid = bid.plus(amount);
									liquidity = liquidity.plus(amount);
								}else if(offer.base === null){
									let amount = Decimal.min(offer.gets, xrpBalance.balance);

									liquidity = liquidity.plus(amount);
								}
							}

							if(offer.quote === token.id){
								ask = ask.plus(Decimal.min(offer.pays, balance));
							}
						}
					}
				}



				if(!isBackfill){
					let whales = nonZeroBalances.slice(0, config.ledger.captureWhales);

					for(let { account, balance } of whales){
						let { address } = snapshot.accounts.get({id: account});

						balances.push({
							account: address,
							token: {
								currency: token.currency,
								issuer: token.issuer
							},
							balance
						});
					}

					if(accounts.every(account => account.address !== token.issuer)){
						accounts.push({
							address: token.issuer,
							domain: token.issuerDomain,
							emailHash: token.issuerEmailHash
						});
					}
				}



				let stat = {
					ledger: index,
					token: {
						currency: token.currency,
						issuer: token.issuer
					},
					trustlines: count,
					holders: holders,
					supply: supply.toString(),
					bid: bid.toString(),
					ask: ask.toString(),
					replaceAfter
				};

				if(supply.gt('0')){
					for(let percent of config.ledger.topPercenters){
						let group = nonZeroBalances.slice(0, Math.ceil(holders * percent / 100));
						let wealth = group.reduce((sum, {balance}) => sum.plus(balance), new Decimal(0));
						let share = wealth.div(supply).times(100);
						let key = `percent${percent.toString().replace('.', '')}`;

						stat[key] = share.toNumber();
					}
				}

				stats.push(stat);
			}
			
			log.time(`snapshot.compute`, `computed metadata in %`);
			log.time(`snapshot.insert`,
				`inserting:`,
				accounts.length, `accounts,`,
				balances.length, `balances,`,
				stats.length, `stats,`
			);

			repo.states.insert({
				index,
				accounts: snapshot.accounts.count(),
				trustlines: snapshot.balances.count(),
				tokens: snapshot.tokens.count(),
				offers: snapshot.offers.count(),
				liquidity: liquidity.toString()
			});

			await repo.criticalTx(() => {
				accounts.forEach(x => repo.accounts.insert(x));
				balances.forEach(x => repo.balances.insert(x));
				stats.forEach(x => repo.stats.insert(x));
			});

			log.time(`snapshot.insert`, `inserted rows in %`);

			snapshot.close();

			log.time(`snapshot`, `completed ${isBackfill ? 'backfill' : 'full'} scan of ledger #${index} in %`);
		}
	);
};


function fillQueue(xrpl, index){
	let chunkSize = 100000;
	let ledgerData;
	let lastMarker;
	let queue = [];
	let done = false;
	let failed = false;
	let attempts = 0;
	let next = async () => {
		while(queue.length === 0)
			if(done)
				return null
			else if(failed)
				throw 'NO_NODE_AVAILABLE'
			else
				await wait(100);

		log.debug(`ledger data queue: ${queue.length}/3`);

		return queue.shift()
	}

	;(async () => {
		while(true){
			while(queue.length >= chunkSize * 3)
				await wait(100);

			attempts++;

			try{
				ledgerData = await xrpl.request({
					command: 'ledger_data',
					ledger_index: index,
					marker: lastMarker,
					limit: 100000,
					priority: 100
				});

			}catch(e){
				if(e === 'NO_NODE_AVAILABLE'){
					if(attempts >= 3){
						failed = true;
						return
					}
				}else {
					if(attempts >= 10){
						failed = true;
						return
					}
				}

				log.info(`could not obtain ledger data chunk:\n`, e);
				await wait(3000);
				continue
			}

			queue.push(ledgerData.state);
			lastMarker = ledgerData.marker;
			attempts = 0;

			if(!lastMarker){
				done = true;
				break
			}
		}
	})();

	return next
}

var backfill = ({repo, config, xrpl, loopLedgerTask, count}) => {
	loopLedgerTask(
		{
			task: 'backfill',
			interval: 1,
			backfillLedgers: config.ledger.stateTxLedgers,
			backfillInterval: 1
		},
		async index => {
			log.debug(`scanning transactions of ledger #${index}`);

			let exchanges = [];
			let { ledger } = await xrpl.request({
				command: 'ledger',
				ledger_index: index,
				transactions: true,
				expand: true
			});
			let date = rippleToUnix(ledger.close_time);

			for(let tx of ledger.transactions){
				if(tx.metaData.TransactionResult !== 'tesSUCCESS')
					continue

				if(['OfferCreate', 'Payment'].includes(tx.TransactionType)){
					try{
						exchanges.push(...deriveExchanges(tx));
					}catch(e){
						log.info(`failed to parse exchanges:\n`, e);
						continue
					}
				}
			}


			repo.exchanges.insert(exchanges.map(exchange => ({...exchange, ledger: index})));
			repo.ledgers.insert({index, date, ...fromTxs(ledger.transactions)});

			count(`saved % exchange(s)`, exchanges.length, `(${ledger.close_time_human.slice(0, 20)})`);
		}
	);
};

const issuerFields = [
	'address',
	'name',
	'trusted',
	'description',
	'icon',
	'domain',
	'twitter',
	'telegram',
	'discord',
	'youtube',
	'facebook',
	'reddit',
	'medium',
];

const currencyFields = [
	'code',
	'issuer',
	'name',
	'trusted',
	'description',
	'icon',
	'domain',
	'twitter',
	'telegram',
	'discord',
	'youtube',
	'facebook',
	'reddit',
	'medium',
];


function parse(str){
	let toml = parse$1(str);
	let issuers = [];
	let currencies = [];

	if(toml.issuers){
		for(let issuer of toml.issuers){
			issuers.push(
				Object.entries(issuer)
					.reduce((clean, [key, value]) => 
						issuerFields.includes(key)
							? {...clean, [key]: value}
							: clean
					,{})
			);
		}

		for(let currency of toml.currencies){
			currencies.push(
				Object.entries(currency)
					.reduce((clean, [key, value]) => 
						currencyFields.includes(key)
							? {...clean, [key]: value}
							: clean
					,{})
			);
		}
	}

	return {
		issuers,
		currencies
	}
}

var aux = ({repo, config, loopTimeTask}) => {
	if(!config.aux)
		return

	for(let aux of config.aux){
		let api = new Rest({
			base: aux.url
		});

		log.info(`will read ${aux.url} every ${aux.refreshInterval} seconds`);

		loopTimeTask(
			{
				task: `aux.${aux.name}`,
				interval: aux.refreshInterval
			},
			async t => {
				log.info(`reading ${aux.url}`);


				let response = await api.get('.', null, {raw: true});
			
				if(!response.ok){
					throw `HTTP ${response.status}`
				}

				let toml = await response.text();
				let { issuers, currencies } = parse(toml);
				let metas = [];

				for(let { address, ...meta } of issuers){
					metas.push({
						meta,
						account: address,
						source: aux.name
					});
				}

				for(let { code, issuer, ...meta } of currencies){
					metas.push({
						meta,
						token: {
							currency: currencyHexToUTF8(code),
							issuer
						},
						source: aux.name
					});
				}

				if(!aux.trusted){
					for(let { meta } of metas){
						delete meta.trusted;
					}
				}


				log.info(`writing`, metas.length, `metas to db...`);

				for(let meta of metas){
					repo.metas.insert(meta);
				}

				log.info(`${aux.name} aux scan complete`);
			}
		);
	}
};

var xumm = ({repo, config, loopTimeTask, count}) => {
	let api = new Rest({
		base: 'https://xumm.app',
		headers: {
			'x-api-key': config.xumm.apiKey, 
			'x-api-secret': config.xumm.apiSecret
		},
		ratelimit: config.xumm.maxRequestsPerMinute 
	});

	loopTimeTask(
		{
			task: 'xumm.assets',
			interval: config.xumm.refreshIntervalAssets
		},
		async t => {
			log.info(`fetching curated asset list...`);

			let { details } = await api.get('api/v1/platform/curated-assets');
			let metas = [];

			log.info(`got ${Object.values(details).length} issuers`);

			for(let issuer of Object.values(details)){
				for(let currency of Object.values(issuer.currencies)){
					metas.push({
						meta: {
							name: issuer.name,
							domain: issuer.domain,
							icon: issuer.avatar,
							trusted: true
						},
						account: currency.issuer,
						source: 'xumm'
					});

					metas.push({
						meta: {
							name: currency.name,
							icon: currency.avatar,
							trusted: true
						},
						token: {
							currency: currencyHexToUTF8(currency.currency),
							issuer: currency.issuer
						},
						source: 'xumm'
					});
				}
			}

			log.info(`writing`, metas.length, `metas to db...`);

			metas.forEach(meta => repo.metas.insert(meta));

			log.info(`asset scan complete`);
		}
	);

	loopTimeTask(
		{
			task: 'xumm.kyc',
			interval: config.xumm.refreshIntervalKYC,
			subject: 'A'
		},
		async (t, accountId) => {
			let account = await repo.accounts.get({id: accountId});

			let { kycApproved } = await api.get(`api/v1/platform/kyc-status/${account.address}`);

			if(kycApproved){
				repo.metas.insert({
					meta: {
						xumm_kyc: true
					},
					account: account.id,
					source: 'xumm'
				});
			}

			count(`checked % KYCs`);
		}
	);

	loopTimeTask(
		{
			task: 'xumm.avatar',
			interval: config.xumm.refreshIntervalAvatar,
			subject: 'A'
		},
		async (t, accountId) => {
			let account = await repo.accounts.get({id: accountId});
			let meta = {icon: undefined};
			let res = await api.get(
				`/avatar/${account.address}.png`, 
				null, 
				{raw: true, redirect: 'manual'}
			);


			if(res.headers.get('location')){
				meta.icon = res.headers.get('location').split('?')[0];
			}

			repo.metas.insert({
				meta,
				account: account.id,
				source: 'xumm'
			});

			count(`checked % icons`);
		}
	);
};

var bithomp = ({repo, config, loopTimeTask}) => {
	let api = new Rest({
		base: 'https://bithomp.com/api/v2', 
		headers: {'x-bithomp-token': config.bithomp.apiKey}
	});

	loopTimeTask(
		{
			task: 'bithomp.assets',
			interval: config.bithomp.refreshInterval
		},
		async t => {
			log.info(`fetching services list...`);

			let result = await api.get('services');
			let services = result.services;
			let metas = [];

			log.info(`got`, services.length, `services`);

			for(let service of services){
				for(let { address } of service.addresses){
					metas.push({
						meta: {
							...Object.entries(service.socialAccounts || {})
								.reduce(
									(accounts, [key, user]) => ({
										...accounts,
										[key]: user
									}),
									{}
								),
							name: service.name,
							domain: service.domain,
							...service.socialAccounts
						},
						account: address,
						source: 'bithomp'
					});
				}
			}

			log.info(`writing`, metas.length, `metas to db...`);

			metas.forEach(meta => repo.metas.insert(meta));

			log.info(`asset scan complete`);
		}
	);
};

var xrpscan = ({repo, config, loopTimeTask}) => {
	let api = new Rest({
		base: 'https://api.xrpscan.com/api/v1'
	});

	loopTimeTask(
		{
			task: 'xrpscan.well-known',
			interval: config.xrpscan.refreshInterval
		},
		async t => {
			log.info(`fetching well-known list...`);

			let names = await api.get('names/well-known');
			let metas = [];

			log.info(`got`, names.length, `names`);

			for(let {account, name, domain, twitter, verified} of names){
				metas.push({
					meta: {
						name,
						domain,
						twitter,
						verified: verified,
					},
					account,
					source: 'xrpscan'
				});
			}

			log.info(`writing`, metas.length, `metas to db...`);

			metas.forEach(meta => {
				try{
					repo.metas.insert(meta);
				}catch{
					//typo in address
				}
			});

			log.info(`well-known scan complete`);
		}
	);
};

var twitter = ({repo, config, loopTimeTask}) => {
	let api = new Rest({
		base: 'https://api.twitter.com/2',
		headers: {
			authorization: `Bearer ${config.twitter.bearerToken}`
		},
		ratelimit: config.twitter.maxRequestsPerMinute 
	});

	loopTimeTask(
		{
			task: 'twitter.meta',
			interval: config.twitter.refreshInterval
		},
		async t => {
			log.info(`collecting targets`);

			let targets = {};

			for(let { id } of repo.accounts.all()){
				let meta = repo.metas.get({account: id, key: 'twitter'});
				let twitter = meta?.value;

				if(!twitter)
					continue

				if(!/^[A-Za-z0-9_]{1,15}$/.test(twitter))
					continue

				if(!targets[twitter])
					targets[twitter] = [];

				targets[twitter].push(id);
			}

			let targetTodo = Object.entries(targets)
				.map(([twitter, accounts]) => ({twitter, accounts}));

			let targetBatches = batched(targetTodo, 100);
			let i = 0;

			log.info(`got`, targetTodo.length, `twitter pages to scrape (${targetBatches.length} batches)`);

			for(let batch of targetBatches){
				log.info(`collecting batch ${i} of ${targetBatches.length}`);

				let { data, error } = await api.get(`users/by`, {
					usernames: batch
						.map(({twitter}) => twitter)
						.join(','),
					'user.fields': 'name,profile_image_url,description,entities,public_metrics'
				});

				log.info(`got`, data.length, `profiles`);
				log.info(`writing metas to db`);


				for(let {twitter, accounts} of batch){
					let profile = data.find(entry => entry.username.toLowerCase() === twitter.toLowerCase());
					let meta = {
						twitter_followers: null,
						name: undefined,
						icon: undefined,
						description: undefined,
						domain: undefined
					};

					if(profile){
						meta.twitter_followers = profile.public_metrics.followers_count;
						meta.name = profile.name;
						meta.description = profile.description;
						meta.icon = profile.profile_image_url
							? profile.profile_image_url.replace('_normal', '')
							: undefined;

						if(profile.entities?.url?.urls){
							meta.domain = profile.entities.url.urls[0].expanded_url
								.replace(/^https?:\/\//, '')
								.replace(/\/$/, '');
						}

						if(profile.entities?.description?.urls){
							let offset = 0;

							for(let {start, end, expanded_url} of profile.entities.description.urls){
								meta.description = meta.description.slice(0, start + offset) + expanded_url + meta.description.slice(end + offset);
								offset += expanded_url.length - (end - start);
							}
						}
					}

					accounts.forEach(account => repo.metas.insert({
						meta,
						account,
						source: 'twitter'
					}));
				}

				i++;
			}

			log.info(`meta cycle complete`);
		}
	);

	/*loopTimeTask(
		{
			task: 'twitter.posts',
			interval: config.twitter.refreshIntervalPosts,
			subject: 'A'
		},
		async (t, account) => {
			let metaId = repo.metas.get({account, key: 'twitter_id'})
			let metaUser = repo.metas.get({account, key: 'twitter_user'})
			
			if(metaId && metaId.value){
				let id = metaId.value
				let { data } = await api.get(`users/${id}/tweets`,{
					'exclude': 'retweets,replies',
					'tweet.fields': 'created_at,entities,public_metrics',
					'user.fields': 'name,profile_image_url,username,verified'
				})


				if(data && data.length > 0){
					repo.updates.insert({
						platform: 'twitter',
						account,
						updates: data
							.map(tweet => ({
								uid: tweet.id,
								data: tweet,
								date: Math.floor(Date.parse(tweet.created_at) / 1000)
							}))
					})

					log.info(`stored ${data.length} tweets for ${metaUser.value}`)
				}
			}
		}
	)*/
};

var gravatar = ({repo, config, loopTimeTask, count}) => {
	let api = new Rest({
		base: 'https://www.gravatar.com',
		ratelimit: config.gravatar.maxRequestsPerMinute
	});

	loopTimeTask(
		{
			task: 'gravatar',
			interval: config.gravatar.refreshInterval,
			subject: 'A'
		},
		async (t, accountId) => {
			let { emailHash } = await repo.accounts.get({id: accountId});
			let meta = {icon: undefined};

			if(emailHash){
				let res = await api.get(`avatar/${emailHash.toLowerCase()}`, {d: 404}, {raw: true});

				if(res.status === 200){
					meta.icon = `https://www.gravatar.com/avatar/${emailHash.toLowerCase()}`;
				}else if(res.status !== 404){
					throw `HTTP ${res.status}`
				}

				count(`checked % avatars`);
			}
				

			await repo.metas.insert({
				meta,
				account: accountId,
				source: 'gravatar'
			});
		}
	);
};

var providers = {
	stream: stream,
	snapshot: snapshot,
	backfill: backfill,
	aux: aux,
	xumm: xumm,
	bithomp: bithomp,
	xrpscan: xrpscan,
	twitter: twitter,
	gravatar: gravatar
};

const args = minimist(process.argv.slice(2));
const configPath = args.config || 'crawler.toml';



switch(args._[0]){
	case 'flush-wal': {
		const config = load(configPath);
		const repo = initRepo(config);
		
		log.info(`one-time flushing database WAL file...`);
		repo.flushWAL();
		process.exit(0);
		break
	}

	case 'work': {
		log.config({
			name: args.task, 
			color: 'cyan',
			isSubprocess: true
		});

		const config = load(configPath);
		const repo = initRepo(config);
		const xrpl = new Client();

		providers[args.task](
			context({config, repo, xrpl})
		);
		break
	}

	default: {
		log.config({
			name: 'main', 
			color: 'yellow', 
			severity: args.log || 'info'
		});

		log.info(`*** XRPLMETA CRAWLER ***`);
		log.info(`starting with config "${configPath}"`);

		const config = load(configPath);
		const repo = initRepo(config);
		const only = args.only ? args.only.split(',') : null;
		const xrpl = new Host(config);
		const tasks = Object.keys(providers)
			.filter(key => !only || only.includes(key));


		if(tasks.length === 0){
			log.error(`no tasks selected - terminating under these circumstances`);
			process.exit();
		}

		log.info('spawning processes...');

		for(let task of tasks){
			if(config[task]?.disabled){
				log.info(`task [${task}] is disabled by config`);
				continue
			}

			let subprocess = fork(
				fileURLToPath(import.meta.url), 
				[
					`work`,
					`--config`, configPath,
					`--task`, task
				]
			);

			xrpl.register(subprocess);
			log.subprocess(subprocess);

			subprocess.on('error', error => {
				log.error(`subprocess [${task}] encountered error:`);
				log.error(error);
				xrpl.discard(subprocess);
			});

			subprocess.on('exit', code => {
				log.error(`subprocess [${task}] exited with code ${code}`);
				xrpl.discard(subprocess);
			});

			log.info(`spawned [${task}]`);
		}

		log.info(`all processes up`);

		repo.monitorWAL(60000, 100000000);
		break
	}
}
