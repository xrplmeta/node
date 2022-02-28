import minimist from 'minimist';
import fs from 'fs';
import toml from 'toml';
import Decimal from 'decimal.js';
import path from 'path';
import Adapter from 'better-sqlite3';
import codec from 'ripple-address-codec';
import Koa from 'koa';
import websocket from 'koa-easy-ws';
import Router from '@koa/router';

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


var log$4 = new Logger({
	name: 'main', 
	color: 'yellow'
});

function load(path){
	let config = toml.parse(fs.readFileSync(path).toString());
	let adjusted = {};

	for(let [key, directive] of Object.entries(config)){
		adjusted[key.toLowerCase()] = camelify(directive);
	}

	return adjusted
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

function mapMultiKey(items, key, deleteKey){
	let map = {};

	for(let item of items){
		let k = item[key];

		if(!map[k])
			map[k] = [];

		if(deleteKey){
			item = {...item};
			delete item[key];
		}

		map[k].push(item);
	}

	return map
}

function keySort(array, key, compare){
	let list = array.map(item => ({item, key: key(item)}));

	compare = compare || ((a, b) => a - b);

	return list
		.sort((a, b) => compare(a.key, b.key))
		.map(({item}) => item)
}


function leftProximityZip(...blocks){
	let keyedBlocks = blocks.map(({array, key}) => array.map(item => ({item, key: key(item)})));
	let zipped = [];
	let indices = Array(keyedBlocks.length).fill(0);


	for(let lead of keyedBlocks[0]){
		let pack = [lead.item];

		for(let k=1; k<keyedBlocks.length; k++){
			while(indices[k] < keyedBlocks[k].length - 1){
				let current = keyedBlocks[k][indices[k]].key;
				let next = keyedBlocks[k][indices[k]+1].key;


				if(Math.abs(lead.key - current) <= Math.abs(lead.key - next))
					break

				indices[k]++;
			}

			pack.push(keyedBlocks[k][indices[k]]?.item);
		}

		zipped.push(pack);
	}

	return zipped
}


function isObject(item) {
	return (item && typeof item === 'object' && !Array.isArray(item));
}


function assignDeep(target, ...sources) {
	if (!sources.length) return target
	const source = sources.shift();

	if (isObject(target) && isObject(source)) {
		for (const key in source) {
			if (isObject(source[key])) {
				if (!target[key]) Object.assign(target, { [key]: {} });
				assignDeep(target[key], source[key]);
			} else {
				Object.assign(target, { [key]: source[key] });
			}
		}
	}

	return assignDeep(target, ...sources)
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

		log$4.debug(`sql tx begin`);

		this.con.exec('BEGIN IMMEDIATE');
		this.inTx = true;
		
		try{
			var ret = func();

			if(ret instanceof Promise){
				ret
					.then(ret => {
						log$4.debug(`sql tx commit`);
						this.con.exec('COMMIT');
					})
					.catch(error => {
						throw error
					});
			}else {
				log$4.debug(`sql tx commit`);
				this.con.exec('COMMIT');
			}
		}catch(error){
			log$4.debug(`sql tx begin`);
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

				log$4.info(`sql busy`);
				await wait(3000);
			}
		}
	}

	async monitorWAL(interval, maxSize){
		log$4.info(`monitoring WAL file`);

		while(true){
			await wait(interval);

			try{
				let stat = fs.statSync(`${this.file}-wal`);

				log$4.debug(`WAL file is ${stat.size} bytes`);

				if(stat.size > maxSize){
					log$4.info(`WAL file exceeds max size of ${maxSize}`);
					await this.flushWAL();
				}
			}catch(e){
				log$4.error(`could not check WAL file:\n`, e);
			}
		}
	}

	flushWAL(){
		log$4.info(`force flushing WAL file...`);

		this.pragma(`wal_checkpoint(TRUNCATE)`);

		log$4.info(`WAL flushed`);
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

				log$4.debug(`${this.fileName} query (${timeInMs}ms): ${formatted}`);

				return res
			};
		}
	}
}

function init$e(){
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



function insert$9(data){
	return this.insert({
		table: 'Ledgers',
		data,
		duplicate: 'update'
	})
}

var ledgers = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$e,
	insert: insert$9
});

function init$d(){
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


function insert$8(data){
	return this.insert({
		table: 'States',
		data,
		duplicate: 'update'
	})
}

var states = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$d,
	insert: insert$8
});

function init$c(){
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

function get$6({id, address}){
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

function all$a(){
	return this.all(
		`SELECT * FROM Accounts`
	)
}

function insert$7({address, domain, emailHash}){
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

function count$5(){
	return this.getv(`SELECT COUNT(1) FROM Accounts`)
}

var accounts = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$c,
	id: id$1,
	get: get$6,
	all: all$a,
	insert: insert$7,
	count: count$5
});

function init$b(){
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


function get$5(by){
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


function all$9(){
	return this.all(
		`SELECT *
		FROM Tokens`, 
	)
}


function insert$6({...token}){
	if(typeof token.issuer !== 'number')
		token.issuer = this.accounts.id(token.issuer);


	return this.insert({
		table: 'Tokens',
		data: token,
		duplicate: 'ignore',
		returnRow: true
	})
}


function count$4(){
	return this.getv(`SELECT COUNT(1) FROM Tokens`)
}

var tokens$2 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$b,
	id: id,
	get: get$5,
	all: all$9,
	insert: insert$6,
	count: count$4
});

function init$a(){
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

function get$4({account, token}){
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

function all$8(by){
	if(by.token){
		return this.all(
			`SELECT * FROM Balances
			WHERE token = ?`,
			this.tokens.id(by.token)
		)
	}
}

function insert$5({account, token, balance}){
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

function count$3(){
	return this.getv(`SELECT COUNT(1) FROM Balances`)
}

var balances = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$a,
	get: get$4,
	all: all$8,
	insert: insert$5,
	count: count$3
});

function init$9(){
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

function all$7(entity){
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

function get$3({key, source, ...entity}){
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

function insert$4(meta){
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
	init: init$9,
	all: all$7,
	get: get$3,
	insert: insert$4
});

function init$8(){
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


function insert$3({ledger, token, replaceAfter, ...stats}){
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


function all$6({ token, from, to }){
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


function get$2(token, date){
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

var stats$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$8,
	insert: insert$3,
	all: all$6,
	get: get$2
});

function init$7(){
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

function insert$2(exchanges){
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

function count$2(){
	return this.getv(`SELECT COUNT(1) FROM Exchanges`)
}

var exchanges = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$7,
	insert: insert$2,
	iter: iter,
	decode: decode$1,
	align: align,
	invert: invert,
	pairs: pairs,
	count: count$2
});

function init$6(){
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


function insert$1({account, base, quote, gets, pays}){
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

function count$1(){
	return this.getv(`SELECT COUNT(1) FROM Offers`)
}

var offers = /*#__PURE__*/Object.freeze({
	__proto__: null,
	init: init$6,
	insert: insert$1,
	count: count$1
});

function init$5(){
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
			log$4.error(`operation "${task}/${subject}" failed:\n`, error);
		else
			log$4.error(`operation "${task}" failed:\n`, error);

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
	init: init$5,
	getNext: getNext,
	hasCompleted: hasCompleted,
	getMostRecent: getMostRecent,
	record: record,
	mark: mark
});

function init$4(){
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

function get$1(task, index){
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
	init: init$4,
	get: get$1,
	extend: extend
});

const tablemap = {
	tokens: 'Tokens',
	stats: 'Stats',
	metas: 'Metas',
	exchanges: 'Exchanges'
};


function all$5(){
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

var heads$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	all: all$5,
	diff: diff
});

var modules = /*#__PURE__*/Object.freeze({
	__proto__: null,
	ledgers: ledgers,
	states: states,
	accounts: accounts,
	tokens: tokens$2,
	balances: balances,
	metas: metas,
	stats: stats$1,
	exchanges: exchanges,
	offers: offers,
	operations: operations,
	coverages: coverages,
	heads: heads$1
});

var initRepo = config => new DB({
	journalMode: 'WAL',
	file: `${config.data?.dir}/meta.db`,
	...config,
	modules
});

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
				limit: (limit || 9999999) + (offset || 0),
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

	this.insert({
		table: 'Stats',
		data: point,
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
	compose.call(this, this.repo.tokens.get({id}));
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
	let limit = ctx.parameters.limit || 100;
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

	return collapseToken(token, ctx.config.meta.sourcePriorities)
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
			start || 0,
			end || unixNow()
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
					...this.parseTokenURI(parameters.token),
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
