import fs from 'fs';
import path from 'path';
import Adapter from 'better-sqlite3';
import Decimal from 'decimal.js';
import codec from 'ripple-address-codec';

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
		.map(decode$1)
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

	return decode$1(metas[0])
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

function decode$1(row){
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


function all$1({token, from, to}){
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
		yield decode(exchange);
	}
}

function decode(exchange){
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
  decode: decode,
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

var repo = config => new DB({
	journalMode: 'WAL',
	file: `${config.data?.dir}/meta.db`,
	...config,
	modules
});

export { repo as default };
