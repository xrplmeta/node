import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import minimist from 'minimist';
import fs from 'fs';
import toml from 'toml';
import path from 'path';
import Adapter from 'better-sqlite3';
import Decimal from 'decimal.js';
import codec from 'ripple-address-codec';
import EventEmitter from 'events';
import xrpl from 'xrpl';
import fetch from 'node-fetch';
import { RateLimiter } from 'limiter';

const logColors = {
	red: '31m',
	green: '32m',
	yellow: '33m',
	blue: '34m',
	cyan: '36m',
};

const levelCascades = {
	D: ['debug'],
	I: ['debug', 'info'],
	E: ['debug', 'info', 'error'],
};

const timeScalars = [
	1000, 
	60, 
	60, 
	24, 
	7, 
	52
];

const timeUnits = [
	'ms', 
	'seconds', 
	'minutes', 
	'hours', 
	'days', 
	'weeks', 
	'years'
];

const formatContent = arg => {
	if(typeof arg === 'number')
		return arg.toLocaleString('en-US')

	if(arg && arg.stack)
		return arg.stack

	return arg
};

const humanDuration = (ms, dp = 0) => {
	let timeScalarIndex = 0;
	let scaledTime = ms;

	while (scaledTime > timeScalars[timeScalarIndex]){
		scaledTime /= timeScalars[timeScalarIndex++];
	}

	return `${scaledTime.toFixed(dp)} ${timeUnits[timeScalarIndex]}`
};

class Logger{
	constructor(config){
		this.config(config);
		this.timings = {};
	}

	branch(config){
		return new Logger({
			isSubprocess: this.isSubprocess,
			...config
		})
	}

	config({name, color, severity, isSubprocess}){
		this.name = name;
		this.color = color || 'yellow';
		this.severity = severity || 'debug';
		this.isSubprocess = isSubprocess || false;
	}

	subprocess(subprocess){
		subprocess.on('message', message => {
			if(message && message.type === 'log'){
				this.log.call(
					{...message.config, severity: this.severity}, 
					message.level, 
					...message.args
				);
			}
		});
	}

	log(level, ...args){
		if(this.isSubprocess){
			process.send({
				type: 'log', 
				config: {
					name: this.name,
					color: this.color
				},
				level, 
				args: args.map(formatContent)
			});
			return
		}

		if(!levelCascades[level].includes(this.severity))
			return

		let output = level === 'E'
			? console.error
			: console.log;
		let color = level === 'E'
			? 'red'
			: this.color;
		let contents = args.map(formatContent);

		output(`${new Date().toISOString().slice(0,19).replace('T', ' ')} ${level} [\x1b[${logColors[color]}${this.name}\x1b[0m]`, ...contents);
	}

	debug(...contents){
		this.log('D', ...contents);
	}

	info(...contents){
		this.log('I', ...contents);
	}

	error(...contents){
		this.log('E', ...contents);
	}

	// todo: make this utilize high resolution time
	time(key, ...contents){
		if(this.timings[key]){
			let passed = Date.now() - this.timings[key];
			let duration = humanDuration(passed, 1);

			this.info(...contents.map(arg => typeof arg === 'string'
				? arg.replace('%', duration)
				: arg));

			delete this.timings[key];
		}else {
			this.timings[key] = Date.now();

			if(contents.length > 0)
				this.info(...contents);
		}
	}
}


var log = new Logger({
	name: 'main', 
	color: 'yellow'
});

function load(path){
	return parse$1(fs.readFileSync(path, 'utf-8'))
}

function parse$1(str, raw){
	let config = toml.parse(str);

	if(!raw){
		let adjusted = {};

		for(let [key, directive] of Object.entries(config)){
			adjusted[key.toLowerCase()] = camelify(directive);
		}

		return adjusted
	}else {
		return config
	}
}

function camelify(obj){
	if(Array.isArray(obj))
		return obj.map(o => camelify(o))

	if(typeof obj === 'object'){
		let camelified = {};

		for(let [key, value] of Object.entries(obj)){
			if(key === key.toUpperCase()){
				key = key.toLowerCase();
				value = camelify(value);
			}else {
				key = key.replace(/_([a-z])/g, match => match[1].toUpperCase());
			}

			camelified[key] = value;
		}

		return camelified
	}

	return obj
}

function keySort(array, key, compare){
	let list = array.map(item => ({item, key: key(item)}));

	compare = compare || ((a, b) => a - b);

	return list
		.sort((a, b) => compare(a.key, b.key))
		.map(({item}) => item)
}

function decimalCompare(a, b){
	if(a.gt(b))
		return 1
	else if(b.gt(a))
		return -1
	else
		return 0
}

decimalCompare.ASC = decimalCompare;
decimalCompare.DESC = (a, b) => decimalCompare(b, a);


function batched(items, batchSize){
	let batches = [];

	for(let i=0; i<items.length; i+=batchSize){
		batches.push(items.slice(i, i + batchSize));
	}

	return batches
}

/*
 * A Decimal to ArrayBuffer serialization extension for decimal.js.
 *
 * MIT Licensed <https://opensource.org/licenses/MIT>
 * Copyright (c) 2020, Michael Mclaughlin.
 */


const BASE = 1e7;
const BYTES_MASK = 0b11111111;
const SIX_LSB_MASK = 0b00111111;
const NEG_SIGN_BIT = 0b10000000;
const NEG_EXPONENT_SIGN_BIT = 0b01000000;
const SMALL_INTEGER_BIT = NEG_EXPONENT_SIGN_BIT;
const ALL_NINES = BASE - 1;
const ALL_ZEROS = 0;
const NINES_SIGNIFIER = BASE + 1;
const ZEROS_SIGNIFIER = BASE;
const INFINITY_BYTE = 0b01111111;
const NEG_INFINITY_BYTE = 0b11111111;
const NAN_BYTE = 0b01000000;
const RADIX = BASE + 2;
const EXPONENT_OFFSET = 7;
const MAX_SMALL_EXPONENT = 30;
const MAX_SMALL_INTEGER = 50;
const MAX_SMALLER_INTEGER = 25;
const SMALL_INTEGER_OFFSET = -25 + 37;    // [26, 50] -> [38, 62] -> [26, 50]
const SMALLER_INTEGER_OFFSET = 38;        // [ 0, 25] -> [38, 63] -> [ 0, 25]


function serialize(decimal) {
  let bytes;
  let firstByte;
  let exponent = decimal.e;
  const digits = decimal.d;
  const sign = decimal.s;
  const isSpecialValue = digits === null;

  if (isSpecialValue) {
    firstByte = isNaN(sign) ? NAN_BYTE : (sign < 0 ? NEG_INFINITY_BYTE : INFINITY_BYTE);
    bytes = [firstByte];
  } else {
    const firstDigits = digits[0];

    const isSmallInteger =
      digits.length === 1 &&
      firstDigits <= MAX_SMALL_INTEGER &&
      exponent === (firstDigits < 10 ? 0 : 1);

    if (isSmallInteger) {
      if (firstDigits > MAX_SMALLER_INTEGER) {
        firstByte = firstDigits + SMALL_INTEGER_OFFSET;
        firstByte |= SMALL_INTEGER_BIT;
      } else {
        firstByte = (firstDigits + SMALLER_INTEGER_OFFSET) | 0;
      }

      if (sign < 0) firstByte |= NEG_SIGN_BIT;
      bytes = [firstByte];
    } else {
      firstByte = sign < 0 ? NEG_SIGN_BIT : 0;
      if (exponent < 0) {
        firstByte |= NEG_EXPONENT_SIGN_BIT;
        exponent = -exponent;
      }

      let exponentByteCount;
      if (exponent > MAX_SMALL_EXPONENT) {
        // `Math.floor(Math.log(0x1000000000000 - 1) / Math.log(256) + 1)` = 7
        exponentByteCount =
            exponent < 0x100 ? 1
          : exponent < 0x10000 ? 2
          : exponent < 0x1000000 ? 3
          : exponent < 0x100000000 ? 4
          : exponent < 0x10000000000 ? 5
          : exponent < 0x1000000000000 ? 6
          : 7;

        bytes = [firstByte | exponentByteCount];
        while (exponent) {
          bytes.push(exponent & BYTES_MASK);
          exponent = Math.floor(exponent / 0x100);
        }
      } else {
        if (exponent !== 0) {
          exponent += EXPONENT_OFFSET;
          firstByte |= exponent;
        }

        bytes = [firstByte];
        exponentByteCount = 0;
      }

      const startIndex = exponentByteCount + 1;
      bytes.push(0);

      for (let i = 0, mantissaLength = digits.length; i < mantissaLength; ) {
        let nextDigits = digits[i];

        const zerosOrNinesRepeatMoreThanTwice =
            (nextDigits === ALL_ZEROS || nextDigits === ALL_NINES) &&
            digits[i + 1] === nextDigits &&
            digits[i + 2] === nextDigits;

        if (zerosOrNinesRepeatMoreThanTwice) {
          let repeatCount = 3;
          while (digits[i + repeatCount] === nextDigits) repeatCount += 1;
          nextDigits = nextDigits === ALL_ZEROS ? ZEROS_SIGNIFIER : NINES_SIGNIFIER;
          convert(nextDigits, RADIX, bytes, 0x100, startIndex);
          nextDigits = repeatCount;
          i += repeatCount;
        } else {
          i += 1;
        }

        convert(nextDigits, RADIX, bytes, 0x100, startIndex);
      }
    }
  }

  return Buffer.from(bytes)
}


function deserialize(bytes) {
  let digits;
  let exponent;
  let sign;
  
  if (!bytes.length) 
    return null;

  const firstByte = bytes[0];
  sign = firstByte & NEG_SIGN_BIT ? -1 : 1;
  const isSmallIntegerOrSpecialValue = bytes.length === 1;

  if (isSmallIntegerOrSpecialValue) {
    if (firstByte === NAN_BYTE || firstByte === INFINITY_BYTE || firstByte === NEG_INFINITY_BYTE) {
      digits = null;
      exponent = NaN;
      if (firstByte === NAN_BYTE) sign = NaN;
    } else {
      let integer = firstByte & SIX_LSB_MASK;
      if ((firstByte & SMALL_INTEGER_BIT) !== 0) {
        integer -= SMALL_INTEGER_OFFSET;
        digits = [integer];
      } else {
        integer -= SMALLER_INTEGER_OFFSET;
        digits = [integer];
      }
      exponent = integer < 10 ? 0 : 1;
    }
  } else {
    let indexOfLastMantissaByte = 1;
    exponent = firstByte & SIX_LSB_MASK;
    if (exponent > EXPONENT_OFFSET) {
      // [8, 37] => [1, 30]
      exponent -= EXPONENT_OFFSET;
    } else if (exponent !== 0) {
      const exponentByteCount = exponent;
      exponent = 0;
      for (let i = 0; i < exponentByteCount; ) {
        const leftShift = 0x100 ** i;
        exponent += bytes[++i] * leftShift;
      }

      indexOfLastMantissaByte += exponentByteCount;
    }

    if ((firstByte & NEG_EXPONENT_SIGN_BIT) !== 0) exponent = -exponent;

    const digitsInReverse = [0];
    for (let i = bytes.length, startIndex = 0; i > indexOfLastMantissaByte; ) {
      convert(bytes[--i], 0x100, digitsInReverse, RADIX, startIndex);
    }

    digits = [];
    for (let i = digitsInReverse.length; i; ) {
      const nextDigits = digitsInReverse[--i];
      if (nextDigits === ZEROS_SIGNIFIER) {
        for (let repeats = digitsInReverse[--i]; repeats--; digits.push(ALL_ZEROS));
      } else if (nextDigits === NINES_SIGNIFIER) {
        for (let repeats = digitsInReverse[--i]; repeats--; digits.push(ALL_NINES));
      } else {
        digits.push(nextDigits);
      }
    }
  }

  if (exponent > Decimal.maxE || exponent < Decimal.minE) {
    exponent = NaN;
    digits = null;
  }

  return Object.create(Decimal.prototype, {
    constructor: { value: Decimal },
    d: { value: digits },
    e: { value: exponent },
    s: { value: sign },
  });
}


function convert(val, valBase, res, resBase, ri) {
  for (let i = res.length; i > ri; ) res[--i] *= valBase;
  res[ri] += val;
  for (let i = ri; i < res.length; i++) {
    if (res[i] > resBase - 1) {
      if (res[i + 1] === undefined) res[i + 1] = 0;
      res[i + 1] += (res[i] / resBase) | 0;
      res[i] %= resBase;
    }
  }
}

function deriveExchanges(tx){
	let hash = tx.hash || tx.transaction.hash;
	let maker = tx.Account || tx.transaction.Account;
	let exchanges = [];

	for(let affected of (tx.meta || tx.metaData).AffectedNodes){
		let node = affected.ModifiedNode || affected.DeletedNode;

		if(!node || node.LedgerEntryType !== 'Offer')
			continue

		if(!node.PreviousFields || !node.PreviousFields.TakerPays || !node.PreviousFields.TakerGets)
			continue

		let taker = node.FinalFields.Account;
		let sequence = node.FinalFields.Sequence;
		let previousTakerPays = fromLedgerAmount(node.PreviousFields.TakerPays);
		let previousTakerGets = fromLedgerAmount(node.PreviousFields.TakerGets);
		let finalTakerPays = fromLedgerAmount(node.FinalFields.TakerPays);
		let finalTakerGets = fromLedgerAmount(node.FinalFields.TakerGets);

		let takerPaid = {
			...finalTakerPays, 
			value: Decimal.sub(previousTakerPays.value, finalTakerPays.value)
		};

		let takerGot = {
			...finalTakerGets, 
			value: Decimal.sub(previousTakerGets.value, finalTakerGets.value)
		};

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
		});
	}

	return exchanges
}

function currencyHexToUTF8(code){
	if(code.length === 3)
		return code

	let decoded = new TextDecoder()
		.decode(hexToBytes(code));
	let padNull = decoded.length;

	while(decoded.charAt(padNull-1) === '\0')
		padNull--;

	return decoded.slice(0, padNull)
}

function hexToBytes(hex){
	let bytes = new Uint8Array(hex.length / 2);

	for (let i = 0; i !== bytes.length; i++){
		bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
	}

	return bytes
}


function fromLedgerAmount(amount){
	if(typeof amount === 'string')
		return {
			currency: 'XRP',
			value: Decimal.div(amount, '1000000')
				.toString()
		}
	
	return {
		currency: amount.currency,
		issuer: amount.issuer,
		value: amount.value
	}
}

const rippleEpochOffset = 946684800;

function rippleToUnix(timestamp){
	return timestamp + rippleEpochOffset
}

function wait(ms){
	return new Promise(resolve => setTimeout(resolve, ms))
}

function unixNow(){
	return Math.floor(Date.now() / 1000)
}

class DB{
	constructor(config){
		this.config = config;
		this.file = config.file;
		this.fileName = path.basename(config.file);
		this.open();
	}

	open(){
		let config = this.config;

		this.con = new Adapter(config.file, {readonly: config.readonly || false});
		this.statementCache = {};

		try{
			if(config.journalMode)
				this.pragma(`journal_mode=${config.journalMode}`);

			if(config.cacheSize)
				this.pragma(`cache_size=${config.cacheSize}`);

			if(config.modules){
				for(let [key, mod] of Object.entries(config.modules)){
					this[key] = Object.entries(mod)
						.reduce(
							(methods, [key, method]) => ({
								...methods, 
								[key]: method.bind(this)
							}),
							{}
						);

					if(this[key].init)
						this[key].init();
				}
			}
		}catch(e){
			if(e.code === 'SQLITE_CORRUPT'){
				this.corrupt = true;
			}else {
				throw e
			}
		}
	}

	wipe(){
		this.close();

		fs.unlinkSync(this.file);

		if(fs.existsSync(`${this.file}-wal`))
			fs.unlinkSync(`${this.file}-wal`);

		if(fs.existsSync(`${this.file}-shm`))
			fs.unlinkSync(`${this.file}-shm`);

		this.open();
	}

	close(){
		this.con.close();
	}

	isEmpty(){
		return this.getv(`SELECT COUNT(1) FROM sqlite_master WHERE type='table'`) === 0
	}

	pragma(sql){
		return this.con.pragma(sql)
	}

	exec(sql){
		return this.con.exec(sql)
	}

	prepare(sql){
		if(this.statementCache[sql])
			return this.statementCache[sql]

		return this.statementCache[sql] = this.con.prepare(sql)
	}

	iterate(sql, ...params){
		return this.prepare(sql).iterate(...params)
	}

	get(sql, ...params){
		return this.prepare(sql).get(...params)
	}

	getv(sql, ...params){
		let res = this.get(sql, ...params);
		return res[Object.keys(res)[0]]
	}

	all(sql, ...params){
		return this.prepare(sql).all(...params)
	}

	allv(sql, ...params){
		let rows = this.all(sql, ...params);
			
		if(rows.length === 0)
			return []

		let key = Object.keys(rows[0])[0];

		return rows.map(row => row[key])
	}

	run(sql, ...params){
		return this.prepare(sql).run(...params)
	}

	insert({table, data, duplicate, returnRow}){
		if(Array.isArray(data)){
			return this.tx(() => {
				let rows = [];

				for(let item of data){
					rows.push(this.insert({table, data: item, duplicate, returnRow}));
				}

				return rows
			})
		}else {
			let modifier = (duplicate || 'fail').toUpperCase();
			let getExisting = () => {
				let compares = Object.keys(data)
					.map(key => `\`${key}\` IS @${key}`);

				return this.get(
					`SELECT * FROM ${table}
					WHERE ${compares.join(` AND `)}`,
					data
				)
			};

			if(modifier === 'REPLACE'){
				let existing = getExisting();

				if(existing)
					return existing
			}


			if(modifier === 'UPDATE'){
				var info = this.run(
					`INSERT INTO ${table}
					(${Object.keys(data).map(key => `"${key}"`).join(',')})
					VALUES
					(${Object.keys(data).map(key => `@${key}`).join(',')})
					ON CONFLICT DO UPDATE SET
					${Object.keys(data).map(key => `"${key}"=@${key}`).join(',')}`,
					data
				);
			}else {
				var info = this.run(
					`INSERT OR ${modifier} INTO ${table}
					(${Object.keys(data).map(key => `"${key}"`).join(',')})
					VALUES
					(${Object.keys(data).map(key => `@${key}`).join(',')})`,
					data
				);
			}

			if(returnRow){
				if(info && info.changes > 0){
					return this.get(
						`SELECT * FROM ${table} 
						WHERE rowid = ?`, 
						info.lastInsertRowid
					)
				}else {
					return getExisting()
				}
			}
		}
	}

	tx(func){
		if(this.inTx)
			return func()

		log.debug(`sql tx begin`);

		this.con.exec('BEGIN IMMEDIATE');
		this.inTx = true;
		
		try{
			var ret = func();

			if(ret instanceof Promise){
				ret
					.then(ret => {
						log.debug(`sql tx commit`);
						this.con.exec('COMMIT');
					})
					.catch(error => {
						throw error
					});
			}else {
				log.debug(`sql tx commit`);
				this.con.exec('COMMIT');
			}
		}catch(error){
			log.debug(`sql tx begin`);
			this.con.exec('ROLLBACK');

			throw error
		}finally{
			this.inTx = false;
		}

		return ret
	}

	async criticalTx(func){
		while(true){
			try{
				return this.tx(func)
			}catch(e){
				if(e.code !== 'SQLITE_BUSY' && e.code !== 'SQLITE_BUSY_SNAPSHOT'){
					throw e
				}

				log.info(`sql busy`);
				await wait(3000);
			}
		}
	}

	async monitorWAL(interval, maxSize){
		log.info(`monitoring WAL file`);

		while(true){
			await wait(interval);

			try{
				let stat = fs.statSync(`${this.file}-wal`);

				log.debug(`WAL file is ${stat.size} bytes`);

				if(stat.size > maxSize){
					log.info(`WAL file exceeds max size of ${maxSize}`);
					await this.flushWAL();
				}
			}catch(e){
				log.error(`could not check WAL file:\n`, e);
			}
		}
	}

	flushWAL(){
		log.info(`force flushing WAL file...`);

		this.pragma(`wal_checkpoint(TRUNCATE)`);

		log.info(`WAL flushed`);
	}

	enableQueryProfiling(){
		for(let fnName of ['get', 'all', 'run']){
			let fn = this[fnName];

			this[fnName] = (sql, ...params) => {
				let start = process.hrtime();
				let res = fn.call(this, sql, ...params);
				let time = process.hrtime(start);
				let timeInMs = (time[0] * 1000000000 + time[1]) / 1000000;
				let formatted = sql.replace(/(\s{2,})|(\n)/g, ' ').slice(0, 100);

				log.debug(`${this.fileName} query (${timeInMs}ms): ${formatted}`);

				return res
			};
		}
	}
}

function init$a(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Ledgers" (
			"index"		INTEGER NOT NULL UNIQUE,
			"date"		INTEGER NOT NULL,
			"txs"		INTEGER NOT NULL,
			"trusts"	INTEGER NOT NULL,
			"untrusts"	INTEGER NOT NULL,
			"pays"		INTEGER NOT NULL,
			"offers"	INTEGER NOT NULL,
			"cancels"	INTEGER NOT NULL,
			"fees"		INTEGER NOT NULL,
			"accounts"	INTEGER NOT NULL,
			PRIMARY KEY ("index")
		);

		CREATE INDEX IF NOT EXISTS 
		"LedgersDate" ON "Ledgers" 
		("date");`
	);
}



function insert$8(data){
	return this.insert({
		table: 'Ledgers',
		data,
		duplicate: 'update'
	})
}

var ledgers = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$a,
	insert: insert$8
});

function init$9(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "States" (
			"index"			INTEGER NOT NULL UNIQUE,
			"accounts"		INTEGER NOT NULL,
			"trustlines"	INTEGER NOT NULL,
			"tokens"		INTEGER NOT NULL,
			"offers"		INTEGER NOT NULL,
			"liquidity"		INTEGER NOT NULL,
			PRIMARY KEY ("index")
		);`
	);
}


function insert$7(data){
	return this.insert({
		table: 'States',
		data,
		duplicate: 'update'
	})
}

var states = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$9,
	insert: insert$7
});

function init$8(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Accounts" (
			"id"		INTEGER NOT NULL UNIQUE,
			"address"	BLOB NOT NULL UNIQUE,
			"domain"	TEXT,
			"emailHash"	TEXT,
			PRIMARY KEY ("id" AUTOINCREMENT)
		);

		CREATE UNIQUE INDEX IF NOT EXISTS 
		"AccountsAddress" ON "Accounts" 
		("address");`
	);
}

function id$1(address, create=true){
	if(typeof address === 'number')
		return address

	return this.accounts.get({address})?.id 
		|| (create ? this.accounts.insert({address}).id : null)
}

function get$5({id, address}){
	let row;

	if(id){
		row = this.get(
			`SELECT * FROM Accounts
			WHERE id = ?`,
			id
		);
	}else if(address){
		row = this.get(
			`SELECT * FROM Accounts
			WHERE address = ?`,
			typeof address === 'string'
				? codec.decodeAccountID(address)
				: address
		);
	}

	if(!row)
		return null

	return {
		...row,
		address: codec.encodeAccountID(row.address)
	}
}

function all$5(){
	return this.all(
		`SELECT * FROM Accounts`
	)
}

function insert$6({address, domain, emailHash}){
	return this.insert({
		table: 'Accounts',
		data: {
			address: typeof address === 'string'
				? codec.decodeAccountID(address)
				: address,
			domain,
			emailHash
		},
		duplicate: 'update',
		returnRow: true
	})
}

function count$4(){
	return this.getv(`SELECT COUNT(1) FROM Accounts`)
}

var accounts = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$8,
	id: id$1,
	get: get$5,
	all: all$5,
	insert: insert$6,
	count: count$4
});

function init$7(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Tokens" (
			"id"			INTEGER NOT NULL UNIQUE,
			"currency"		TEXT NOT NULL,
			"issuer"		INTEGER NOT NULL,
			"inception"		INTEGER,
			PRIMARY KEY("id" AUTOINCREMENT),
			UNIQUE ("issuer", "currency")
		);
		
		CREATE INDEX IF NOT EXISTS 
		"TokenIssuer" ON "Tokens" 
		("issuer");`
	);
}

function id(token, create=true){
	if(!token)
		return

	if(typeof token === 'number')
		return token

	if(token.id)
		return token.id

	if(!token.issuer)
		return null

	return this.tokens.get(token)?.id 
		|| (create ? this.tokens.insert(token).id : null)
}


function get$4(by){
	if(by.id){
		return this.get(
			`SELECT * FROM Tokens
			WHERE id = ?`,
			by.id,
		) 
	}else if(by.currency){
		let issuerId = this.accounts.id(by.issuer, false);

		if(!issuerId)
			return null

		return this.get(
			`SELECT * FROM Tokens
			WHERE issuer = ? AND currency = ?`,
			issuerId,
			by.currency, 
		)
	}
}


function all$4(){
	return this.all(
		`SELECT *
		FROM Tokens`, 
	)
}


function insert$5({...token}){
	if(typeof token.issuer !== 'number')
		token.issuer = this.accounts.id(token.issuer);


	return this.insert({
		table: 'Tokens',
		data: token,
		duplicate: 'ignore',
		returnRow: true
	})
}


function count$3(){
	return this.getv(`SELECT COUNT(1) FROM Tokens`)
}

var tokens = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$7,
	id: id,
	get: get$4,
	all: all$4,
	insert: insert$5,
	count: count$3
});

function init$6(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Balances" (
			"account"	INTEGER NOT NULL,
			"token"		INTEGER,
			"balance"	TEXT NOT NULL,
			UNIQUE ("account", "token")
		);

		CREATE INDEX IF NOT EXISTS 
		"BalancesTrustline" ON "Balances" 
		("token");`
	);
}

function get$3({account, token}){
	return this.get(
		`SELECT * FROM Balances
		WHERE account = ?
		AND token IS ?`,
		this.accounts.id(account),
		token
			? this.tokens.id(token)
			: null,
	)
}

function all$3(by){
	if(by.token){
		return this.all(
			`SELECT * FROM Balances
			WHERE token = ?`,
			this.tokens.id(by.token)
		)
	}
}

function insert$4({account, token, balance}){
	let accountId = this.accounts.id(account);
	let tokenId = token
		? this.tokens.id(token)
		: null;

	return this.insert({
		table: 'Balances',
		data: {
			account: accountId,
			token: tokenId,
			balance
		},
		duplicate: 'update'
	})
}

function count$2(){
	return this.getv(`SELECT COUNT(1) FROM Balances`)
}

var balances = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$6,
	get: get$3,
	all: all$3,
	insert: insert$4,
	count: count$2
});

function init$5(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Metas" (
			"id"		INTEGER NOT NULL UNIQUE,
			"type"		TEXT NOT NULL,
			"subject"	INTEGER NOT NULL,
			"key"		TEXT NOT NULL,
			"value"		TEXT,
			"source"	TEXT NOT NULL,
			PRIMARY KEY("id" AUTOINCREMENT),
			UNIQUE ("type", "subject", "key", "source")
		);`
	);
}

function all$2(entity){
	let { type, subject } = deriveTypeSubject.call(this, entity);

	if(!subject)
		return []

	return this.all(
		`SELECT key, value, source
		FROM Metas
		WHERE type = ? AND subject = ? AND value NOT NULL`,
		type, subject
	)
		.map(decode$2)
}

function get$2({key, source, ...entity}){
	let { type, subject } = deriveTypeSubject.call(this, entity);

	if(!subject)
		return undefined

	let metas = this.all(
		`SELECT value, source
		FROM Metas
		WHERE type = ? AND subject = ? AND key = ?`,
		type, subject, key
	);

	if(metas.length === 0)
		return undefined

	if(source)
		return metas.find(meta => meta.source === source)

	return decode$2(metas[0])
}

function insert$3(meta){
	let rows = [];
	let type;
	let subject;

	if(meta.account){
		type = 'A';
		subject = this.accounts.id(meta.account);
	}else if(meta.token){
		type = 'T';
		subject = this.tokens.id(meta.token);
	}else {
		throw 'unspecified subject'
	}

	for(let [key, value] of Object.entries(meta.meta)){
		rows.push({
			type: type,
			subject: subject,
			key,
			value: value !== undefined ? JSON.stringify(value) : null,
			source: meta.source,
		});
	}

	this.insert({
		table: 'Metas',
		data: rows,
		duplicate: 'replace'
	});
}

function deriveTypeSubject(entity){
	let type;
	let subject;

	if(entity.account){
		type = 'A';
		subject = this.accounts.id(entity.account, false);
	}else if(entity.token){
		type = 'T';
		subject = this.tokens.id(entity.token, false);
	}

	return {type, subject}
}

function decode$2(row){
	return {
		...row,
		value: JSON.parse(row.value)
	}
}

var metas = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$5,
	all: all$2,
	get: get$2,
	insert: insert$3
});

function init$4(){
	if(!this.config.ledger?.topPercenters)
		return

	let percents = this.config.ledger.topPercenters
		.map(percent => `"percent${percent.toString().replace('.', '')}"	REAL`);

	this.exec(
		`CREATE TABLE IF NOT EXISTS "Stats" (
			"id"			INTEGER NOT NULL UNIQUE,
			"token"			INTEGER NOT NULL,
			"ledger"		INTEGER NOT NULL,
			"trustlines"	INTEGER NOT NULL,
			"supply"		TEXT NOT NULL,
			"bid"			TEXT NOT NULL,
			"ask"			TEXT NOT NULL,
			${percents.join(', ')},
			PRIMARY KEY ("id" AUTOINCREMENT),
			UNIQUE ("ledger", "token")
		);

		CREATE INDEX IF NOT EXISTS 
		"StatsToken" ON "Stats" 
		("token");`
	);
}


function insert$2({ledger, token, replaceAfter, ...stats}){
	let tokenId = this.tokens.id(token);

	if(replaceAfter){
		this.run(
			`DELETE FROM Stats
			WHERE token = ?
			AND ledger > ?`,
			tokenId,
			replaceAfter
		);
	}

	return this.insert({
		table: 'Stats',
		data: {
			ledger,
			token: tokenId,
			...stats
		},
		duplicate: 'update'
	})
}


function all$1({ token, from, to }){
	let tokenId = this.tokens.id(token);

	let sql = `
		SELECT Stats.*, Ledgers.date
		FROM Stats
		INNER JOIN Ledgers ON ("index" = Stats.ledger)
	`;

	if(token){
		sql += `WHERE token = @token`;
	}else if(from || to){
		sql += `WHERE id >= @from AND id <= @to`;
	}

	sql += ` ORDER BY LEDGER`;

	return this.all(
		sql,
		{
			token: tokenId,
			from,
			to
		}
	)
}


function get$1(token, date){
	if(date === undefined){
		return this.get(
			`SELECT Stats.*, Ledgers.date
			FROM Stats
			INNER JOIN Ledgers ON ("index" = Stats.ledger)
			WHERE token = ?
			ORDER BY ledger DESC`,
			token.id
		)
	}else {
		return this.get(
			`SELECT Stats.*, Ledgers.date
			FROM Stats
			INNER JOIN Ledgers ON ("index" = Stats.ledger)
			WHERE token = ?
			AND Ledgers.date >= ?
			ORDER BY ledger ASC`,
			token.id,
			date
		)
	}
	
}

var stats = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$4,
	insert: insert$2,
	all: all$1,
	get: get$1
});

function init$3(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Exchanges" (
			"id"		INTEGER NOT NULL UNIQUE,
			"hash"		BLOB NOT NULL,
			"maker"		BLOB NOT NULL,
			"taker"		BLOB NOT NULL,
			"sequence"	INTEGER NOT NULL,
			"ledger"	INTEGER NOT NULL,
			"base"		INTEGER,
			"quote"		INTEGER,
			"price"		BLOB NOT NULL,
			"volume"	BLOB NOT NULL,
			PRIMARY KEY ("id")
			UNIQUE ("hash", "taker", "sequence")
		);

		CREATE INDEX IF NOT EXISTS 
		"ExchangesBase" ON "Exchanges" 
		("base");

		CREATE INDEX IF NOT EXISTS 
		"ExchangesQuote" ON "Exchanges" 
		("quote");`
	);
}

function insert$1(exchanges){
	this.insert({
		table: 'Exchanges',
		data: exchanges.map(exchange => {
			let hash = Buffer.from(exchange.hash, 'hex');
			let maker = codec.decodeAccountID(exchange.maker);
			let taker = codec.decodeAccountID(exchange.taker);
			let base = this.tokens.id(exchange.base);
			let quote = this.tokens.id(exchange.quote);
			let price = serialize(new Decimal(exchange.price));
			let volume = serialize(new Decimal(exchange.volume));

			return {
				hash: hash.slice(0, 4),
				maker: maker.slice(0, 4),
				taker: taker.slice(0, 4),
				sequence: exchange.sequence,
				ledger: exchange.ledger,
				base,
				quote,
				price,
				volume
			}
		}),
		duplicate: 'ignore'
	});
}

function* iter({base, quote, from, to, recent} = {}){
	let sql = `
		SELECT Exchanges.id, ledger, base, quote, price, volume, date 
		FROM Exchanges
		INNER JOIN Ledgers ON (Ledgers."index" = Exchanges.ledger)
	`;

	if(base || quote){
		sql += `WHERE "base" IS @base AND "quote" IS @quote`;
	}else if(from || to){
		sql += `WHERE id >= @from AND id <= @to`;
	}else if(recent){
		sql += `ORDER BY date DESC LIMIT @recent`;
	}

	let iter = this.iterate(
		sql, 
		{base, quote, from, to, recent}
	);

	for(let exchange of iter){
		yield decode$1(exchange);
	}
}

function decode$1(exchange){
	return {
		...exchange,
		price: deserialize(exchange.price),
		volume: deserialize(exchange.volume)
	}
}

function align(exchange, base, quote){
	if(exchange.base === base){
		return {
			id: exchange.id,
			ledger: exchange.ledger,
			date: exchange.date,
			price: exchange.price,
			volume: Decimal.mul(exchange.volume, exchange.price)
		}
	}else if(exchange.base === quote){
		return {
			id: exchange.id,
			ledger: exchange.ledger,
			date: exchange.date,
			price: Decimal.div('1', exchange.price),
			volume: exchange.volume
		}
	}else {
		throw 'unexpected base/quote pair'
	}
}

function invert(exchanges){
	return {
		id: exchange.id,
		ledger: exchange.ledger,
		date: exchange.date,
		price: Decimal.div('1', exchange.price),
		volume: Decimal.mul(exchange.volume, exchange.price)
	}
}

function pairs(unique){
	let pairs = this.all(`SELECT DISTINCT base, quote FROM Exchanges`);

	return unique
		? pairs.filter(({base, quote}, i) => 
			i > pairs.findIndex(pair => pair.base === quote 
				&& pair.quote === base
			)
		)
		: pairs
}

function count$1(){
	return this.getv(`SELECT COUNT(1) FROM Exchanges`)
}

var exchanges = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$3,
	insert: insert$1,
	iter: iter,
	decode: decode$1,
	align: align,
	invert: invert,
	pairs: pairs,
	count: count$1
});

function init$2(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Offers" (
			"account"	INTEGER NOT NULL,
			"base"		INTEGER,
			"quote"		INTEGER,
			"gets"		TEXT NOT NULL,
			"pays"		TEXT NOT NULL,
			UNIQUE ("account", "base", "quote")
		);

		CREATE INDEX IF NOT EXISTS 
		"offerAccount" ON "Offers" 
		("account");`
	);
}


function insert({account, base, quote, gets, pays}){
	let accountId = this.accounts.id(account);
	let baseId = base
		? this.tokens.id(base)
		: null;
	let quoteId = quote
		? this.tokens.id(quote)
		: null;

	return this.insert({
		table: 'Offers',
		data: {
			account: accountId,
			base: baseId,
			quote: quoteId,
			gets,
			pays
		},
		duplicate: 'update'
	})
}

function count(){
	return this.getv(`SELECT COUNT(1) FROM Offers`)
}

var offers = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$2,
	insert: insert,
	count: count
});

function init$1(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Operations" (
			"id"		INTEGER NOT NULL UNIQUE,
			"task"		TEXT NOT NULL,
			"subject"	TEXT,
			"start"		INTEGER NOT NULL,
			"end"		INTEGER NOT NULL,
			"result"	TEXT NOT NULL,
			PRIMARY KEY ("id" AUTOINCREMENT),
			UNIQUE ("task", "subject")
		);`
	);
}

function getNext(task, entity){
	let table = entity === 'A'
		? 'Accounts'
		: 'Tokens';

	//WHERE clause currently only supports Accounts

	return this.get(
		`SELECT
			Operations.*, ${table}.id as entity
		FROM
			${table}
			LEFT JOIN Operations
				ON 
					Operations.task = ?
					AND
					Operations.subject = (? || ${table}.id)
		WHERE
			(SELECT COUNT(1) FROM Tokens WHERE issuer = ${table}.id) > 0
		GROUP BY
			Operations.subject
		ORDER BY
			(CASE WHEN start IS NULL THEN 1 ELSE 0 END) DESC,
			MAX(start) ASC`,
		task, entity
	)
}

function hasCompleted(task, subject){
	let operation = this.operations.getMostRecent(task, subject);

	if(operation && operation.result === 'success')
		return true

	return false
}

function getMostRecent(task, subject){
	return this.get(
		`SELECT * 
		FROM Operations 
		WHERE task = ? AND subject IS ?
		ORDER BY start DESC`, 
		task, 
		subject || null
	)
}

async function record(task, subject, promise){
	let start = unixNow();
	let result;

	try{
		await promise;
		result = 'success';
	}catch(error){
		if(subject)
			log.error(`operation "${task}/${subject}" failed:\n`, error);
		else
			log.error(`operation "${task}" failed:\n`, error);

		result = `error: ${error.toString()}`;

		await wait(10000);
	}

	await this.operations.mark(task, subject, start, result);
}

function mark(task, subject, start, result){
	this.insert({
		table: 'Operations',
		data: {
			task,
			subject,
			start,
			end: unixNow(),
			result
		},
		duplicate: 'replace'
	});
}

var operations = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$1,
	getNext: getNext,
	hasCompleted: hasCompleted,
	getMostRecent: getMostRecent,
	record: record,
	mark: mark
});

function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Coverages" (
			"id"			INTEGER NOT NULL UNIQUE,
			"task"			TEXT,
			"head"			INTEGER,
			"tail"			INTEGER,
			PRIMARY KEY("id" AUTOINCREMENT)
		);

		CREATE INDEX IF NOT EXISTS "CoveragesTask" ON "Coverages" ("task");
		CREATE INDEX IF NOT EXISTS "CoveragesHead" ON "Coverages" ("head");`
	);
}

function get(task, index){
	return this.get(
		 `SELECT * FROM Coverages
		 WHERE task = ? 
		 AND head >= ? AND tail <= ?`,
		 task,
		 index,
		 index
	)
}

function extend(task, head, tail){
	let span = {
		head,
		tail: tail || head
	};

	let intersecting = this.all(
		`SELECT * FROM Coverages 
		WHERE task = ?
		AND NOT (head < ? OR tail > ?)`,
		task,
		span.tail - 1,
		span.head + 1
	);

	for(let seg of intersecting){
		span.head = Math.max(span.head, seg.head);
		span.tail = Math.min(span.tail, seg.tail);
	}

	for(let seg of intersecting){
		this.run(`DELETE FROM Coverages WHERE id = ?`, seg.id);
	}

	this.insert({
		table: 'Coverages',
		data: {
			task,
			...span
		}
	});
}

var coverages = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init,
	get: get,
	extend: extend
});

const tablemap = {
	tokens: 'Tokens',
	stats: 'Stats',
	metas: 'Metas',
	exchanges: 'Exchanges'
};


function all(){
	return Object.entries(tablemap)
		.reduce((map, [key, table]) => ({
			...map,
			[key]: this.getv(`SELECT MAX(id) FROM ${table}`)
		}), {})
}

function diff(key, from, to){
	let table = tablemap[key];

	return this.all(
		`SELECT * FROM ${table} 
		WHERE id >= ? AND id <= ?`, 
		from, 
		to
	)
}

var heads = /*#__PURE__*/Object.freeze({
	__proto__: null,
	all: all,
	diff: diff
});

var modules = /*#__PURE__*/Object.freeze({
	__proto__: null,
	ledgers: ledgers,
	states: states,
	accounts: accounts,
	tokens: tokens,
	balances: balances,
	metas: metas,
	stats: stats,
	exchanges: exchanges,
	offers: offers,
	operations: operations,
	coverages: coverages,
	heads: heads
});

var initRepo = config => new DB({
	journalMode: 'WAL',
	file: `${config.data?.dir}/meta.db`,
	...config,
	modules
});

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
							xumm_trusted: true
						},
						account: currency.issuer,
						source: 'xumm'
					});

					metas.push({
						meta: {
							name: currency.name,
							icon: currency.avatar,
							xumm_trusted: true
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
						xrpscan_verified: verified,
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
