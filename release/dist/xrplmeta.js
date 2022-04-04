#!/usr/bin/env node

import os from 'os';
import path from 'path';
import minimist from 'minimist';
import fs from 'fs';
import Adapter from 'better-sqlite3';
import { wait, unixNow, rippleToUnix } from '@xrplworks/time';
import codec from 'ripple-address-codec';
import Decimal from 'decimal.js';
import { fileURLToPath } from 'url';
import toml from 'toml';
import EventEmitter from 'events';
import Socket from '@xrplworks/socket';
import { fork } from 'child_process';
import { decode as decode$3 } from '@xrplworks/currency';
import { extractExchanges } from '@xrplworks/tx';
import fetch from 'node-fetch';
import { RateLimiter } from 'limiter';
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
	W: ['debug', 'info', 'warn'],
	E: ['debug', 'info', 'warn', 'error'],
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

	warn(...contents){
		this.log('W', ...contents);
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

		this.newlyCreated = !fs.existsSync(config.file);
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


function insert$6({ currency, issuer }){
	if(typeof issuer !== 'number')
		issuer = this.accounts.id(issuer);


	return this.insert({
		table: 'Tokens',
		data: {
			currency,
			issuer
		},
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
	let percents = (this.config.xrpl?.topPercenters || [])
		.map(percent => `"percent${percent.toString().replace('.', '')}" REAL, `);

	this.exec(
		`CREATE TABLE IF NOT EXISTS "Stats" (
			"id"			INTEGER NOT NULL UNIQUE,
			"token"			INTEGER NOT NULL,
			"ledger"		INTEGER NOT NULL,
			"trustlines"	INTEGER NOT NULL,
			"holders"		INTEGER NOT NULL,
			"supply"		TEXT NOT NULL,
			"bid"			TEXT NOT NULL,
			"ask"			TEXT NOT NULL,
			${percents.join('')}
			PRIMARY KEY ("id" AUTOINCREMENT)
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
			let base = this.tokens.id(exchange.takerGot);
			let quote = this.tokens.id(exchange.takerPaid);
			let price = serialize(Decimal.div(exchange.takerPaid.value, exchange.takerGot.value));
			let volume = serialize(new Decimal(exchange.takerGot.value));

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
	let returns;
	let result;

	try{
		returns = await promise;
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

	return returns
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
	file: `${config.data?.dir}/repo.db`,
	...config,
	modules
});

function load$1(path){
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


function load(file, createIfMissing){
	if(!fs.existsSync(file)){
		log.warn(`no config at "${file}" - creating new from template`);

		if(createIfMissing)
			create(file);
	}

	let config = load$1(file);

	// constraint checks here

	return config
}

function create(file){
	let dir = path.dirname(file);
	path.dirname(process.argv[1]);
	let templatePath = path.join(__dirname, './templates/config.toml');
	let template = fs.readFileSync(templatePath, 'utf-8');
	let customizedTemplate = template
		.replace(
			'# dir = "<path>"', 
			`dir = "${dir.replace(/\\/g, '\\\\')}"`
		);

	if(!fs.existsSync(dir))
		fs.mkdirSync(dir);

	fs.writeFileSync(file, customizedTemplate);
}

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
				let socket = new Socket(spec.url);
				let client = {socket, spec};


				socket.on('transaction', tx => {
					if(!this.hasSeen(`tx${tx.transaction.hash}`))
						this.emit('transaction', tx);
				});

				socket.on('ledgerClosed', ledger => {
					if(ledger.validated_ledgers){
						spec.ledgers = ledger.validated_ledgers
							.split(',')
							.map(range => range
								.split('-')
								.map(i => parseInt(i))
							);
					}

					if(!this.hasSeen(`ledger${ledger.ledger_index}`))
						this.emit('ledger', ledger);
				});

				socket.on('connected', () => {
					this.printConnections(`${client.spec.url} established`);
					this.subscribeClient(client);
				});

				socket.on('disconnected', async event => {
					this.printConnections(`${client.spec.url} disconnected: ${event.reason ? event.reason : `code ${event.code}`}`);
				});

				socket.on('error', error => {
					this.log.error(`${client.spec.url} error: ${error.message ? error.message : 'connection failure'}`);
				});
				

				this.clients.push(client);
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


				if(typeof request.ledger_index === 'number'){
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
		if(!client.socket.connected)
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
			let result = await client.socket.request(job.request);

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

		await client.socket.request({
			command: 'subscribe',
			streams: ['ledger', 'transactions']
		});
	}

	printConnections(recent){
		let online = this.clients.filter(client => client.socket.connected).length;

		this.log.info(`connected to ${online} / ${this.clients.length} nodes ${recent ? `(${recent})` : ''}`);
	}
}

class Hub{
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
				case 'xrpl.request':
					this.pool.request(payload.request)
						.then(data => worker.send({
							type: 'xrpl.request', 
							payload: {id: payload.id, data}
						}))
						.catch(error => worker.send({
							type: 'xrpl.request', 
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

				case 'xrpl.request':
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

	async request(request){
		return await new Promise((resolve, reject) => {
			let id = this.counter++;

			this.requests.push({id, resolve, reject});
			process.send({type: 'xrpl.request', payload: {id, request}});
		})
	}
}

const registry = [];


async function spawn({task, configPath, xrpl}){
	while(true){
		let subprocess = fork(
			process.argv[1], 
			[
				`work`,
				`--config`, configPath,
				`--task`, task
			],
			{
				silent: true
			}
		);

		log.subprocess(subprocess);
		xrpl.register(subprocess);
		
		subprocess.stderr.on('data', data => {
			log.error(`subprocess [${task}] error:\n${data.toString()}`);
		});

		subprocess.on('error', error => {
			log.error(`subprocess [${task}] fatal error:`);
			log.error(error);
		});

		subprocess.on('message', message => {
			if(message.type === 'kill'){
				for(let { task, process } of registry){
					if(task === message.task){
						process.kill();
					}
				}
			}
		});

		registry.push({
			task,
			process: subprocess
		});

		log.info(`spawned [${task}]`);

		await new Promise(resolve => {
			subprocess.on('exit', code => {
				log.error(`subprocess [${task}] exited with code ${code}`);
				xrpl.discard(subprocess);
				registry.splice(registry.findIndex(r => r.process === subprocess), 1);
				resolve();
			});
		});

		await wait(3000);
	}
}

var initSnapshot = file => {
	if(file !== ':memory:')
		if(fs.existsSync(file))
			fs.unlinkSync(file);

	return initRepo({
		file,
		journalMode: 'MEMORY',
		cacheSize: 10000
	})
};

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

let repo$1;
let xrpl;

function setContext(ctx){
	repo$1 = ctx.repo;
	xrpl = ctx.xrpl;
}


async function scheduleTimeRoutine({ id, interval, forEvery, routine }){
	while(true){
		let now = unixNow();

		if(forEvery){
			let subject = {account: 'A', token: 'T'}[forEvery];
			let operation = await repo$1.operations.getNext(id, subject);


			if(!operation || (operation.result === 'success' && operation.start + interval > now)){
				await wait(1000);
				continue
			}

			await repo$1.operations.record(
				id, 
				`${subject}${operation.entity}`, 
				routine(now, operation.entity)
			);
		}else {
			let recent = await repo$1.operations.getMostRecent(id);

			if(recent && recent.result === 'success' && recent.start + interval > now){
				await wait(1000);
				continue
			}

			await repo$1.operations.record(
				id, 
				null, 
				routine(now)
			);
		}
	}
}

async function scheduleLedgerRoutine({ id, interval, routine }){
	while(true){
		try{
			let { ledger } = await xrpl.request({command: 'ledger', ledger_index: 'validated'});
			let now = ledger.ledger_index;
			let head = Math.floor(now / interval.live) * interval.live;
			let covered = await repo$1.coverages.get(id, head);
			let chosen = head;

			while(covered){
				let oneBefore = covered.tail - 1;
				
				chosen = Math.floor(oneBefore / interval.backfill) * interval.backfill;
				covered = await repo$1.coverages.get(id, chosen);
			}

			await routine(chosen, chosen < head);
			await repo$1.coverages.extend(id, chosen);
		}catch(e){
			log.info(`ledger routine "${id}" failed:\n`, e);
			await wait(3000);
		}
	}
}

function willRun$a(){
	return true
}


function run$a({ repo, config, xrpl }){
	scheduleLedgerRoutine({
		id: 'snapshot',
		interval: {
			live: config.xrpl.snapshotIntervalLive,
			backfill: config.xrpl.snapshotIntervalBackfill
		},
		routine: async (index, isBackfill) => {
			let replaceAfter = isBackfill
				? null
				: Math.floor(index / config.xrpl.snapshotIntervalBackfill) 
					* config.xrpl.snapshotIntervalBackfill;

			log.time(`snapshot`, `starting ${isBackfill ? 'backfill' : 'full'} snapshot of ledger #${index}`);

			let snapshotFile = config.xrpl.snapshotInMemory
				? `:memory:`
				: `${config.data.dir}/snapshot.db`;


			let snapshot = initSnapshot(snapshotFile);
			let queue = fillQueue(xrpl, index);
			let chunk;
			let scanned = 0;


			log.time(`snapshot.record`);

			while(chunk = await queue()){
				log.time(`snapshot.chunk`);

				await snapshot.tx(async () => {
					for(let state of chunk){

						if(state.LedgerEntryType === 'RippleState'){
							let currency = decode$3(state.HighLimit.currency);
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
									currency: decode$3(state.TakerGets.currency),
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
									currency: decode$3(state.TakerPays.currency),
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

				if(lines.length < config.xrpl.minTrustlines)
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
					let whales = nonZeroBalances.slice(0, config.xrpl.captureWhales);

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
					for(let percent of config.xrpl.topPercenters){
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
	});
}


function fillQueue(xrpl, index){
	let chunkSize = 10000;
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
					limit: chunkSize,
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

				log.info(`could not obtain ledger data chunk:`, e);
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

var snapshot = /*#__PURE__*/Object.freeze({
	__proto__: null,
	willRun: willRun$a,
	run: run$a
});

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

function willRun$9(){
	return true
}

function run$9({ repo, config, xrpl }){
	scheduleLedgerRoutine({
		id: 'backfill',
		interval: {
			live: 1,
			backfill: 1
		},
		routine: async index => {
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
						exchanges.push(...extractExchanges(tx));
					}catch(e){
						log.info(`failed to parse exchanges:\n`, e);
						continue
					}
				}
			}

			repo.exchanges.insert(
				exchanges
					.map(exchange => ({...exchange, ledger: index}))
			);

			repo.ledgers.insert({
				index, 
				date, 
				...fromTxs(ledger.transactions)
			});

			return {
				[`discovered exchanges on ${ledger.close_time_human.slice(0, 11)}`]: exchanges.length
			}
		}
	});
}

var backfill = /*#__PURE__*/Object.freeze({
	__proto__: null,
	willRun: willRun$9,
	run: run$9
});

let status = {};
let timeout;

function accumulate(updates){
	if(!updates)
		return

	for(let [k, v] of Object.entries(updates)){
		status[k] = (status[k] || 0) + v;
	}

	if(!timeout)
		timeout = setTimeout(flush, 10000);
}

function flush(){
	log.info(
		Object.entries(status)
			.map(([k, v]) => k.replace('%', v.toLocaleString('en-US')))
			.join(', ')
	);

	status = {};
	timeout = null;
}

function willRun$8(){
	return true
}

function run$8({ repo, config, xrpl }){
	let open = null;
	let commit = () => {
		let exchanges = [];

		for(let tx of open.txs){
			if(tx.engine_result !== 'tesSUCCESS')
				continue

			if(['OfferCreate', 'Payment'].includes(tx.transaction.TransactionType)){
				try{
					exchanges.push(...extractExchanges(tx));
				}catch(e){
					log.info(`failed to parse exchanges:\n`, e);
					continue
				}
			}
		}

		try{
			repo.exchanges.insert(
				exchanges
					.map(exchange => ({...exchange, ledger: open.index}))
			);
			
			repo.ledgers.insert({
				index: open.index, 
				date: open.time, 
				...fromTxs(open.txs)
			});
			
			repo.coverages.extend('ledgertx', open.index);

			accumulate({'% exchange(s) recorded': exchanges.length});
		}catch(e){
			log.info(`failed to record ${exchanges.length} exchange(s):\n`, e);
		}
		
		open = null;
	};

	xrpl.on('ledger', ledger => {
		if(open){
			log.info(`ledger #${open.index} was incomplete (${open.txs.length} tx gone to waste)`);
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
}

var stream = /*#__PURE__*/Object.freeze({
	__proto__: null,
	willRun: willRun$8,
	run: run$8
});

function createFetch({ baseUrl, headers, ratelimit }){
	let limiter = ratelimit 
		? new RateLimiter({
			tokensPerInterval: ratelimit, 
			interval: 'minute'
		}) 
		: null;

	return async (url = '', options = {}) => {
		if(limiter)
			await limiter.removeTokens(1);

		let data;
		let res = await fetch(
			sanitizeUrl(`${baseUrl}/${url}`),
			{
				headers: {
					...headers,
					...options.headers
				}
			}
		);

		try{
			if(res.headers.get('content-type').includes('application/json')){
				data = await res.json();
			}else {
				data = await res.text();
			}
		}catch{
			data = null;
		}

		return { 
			status: res.status,
			headers: res.headers,
			data
		}
	}
}

function sanitizeUrl(str){
	return str.slice(0, 8) + str.slice(8)
		.replace(/\/\//g,'/')
		.replace(/\/\.$/, '')
		.replace(/\/$/, '')
		.replace(/\?$/, '')
}

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

function willRun$7(config){
	return !!config.aux
}

function run$7({ config, repo }){
	for(let aux of config.aux){
		let fetch = createFetch({
			baseUrl: aux.url
		});

		log.info(`will read ${aux.url} every ${aux.refreshInterval} seconds`);

		scheduleTimeRoutine({
			id: `aux.${aux.name}`,
			interval: aux.refreshInterval,
			routine: async t => {
				log.info(`reading ${aux.url}`);

				let { status, data } = await fetch();
			
				if(status !== 200){
					throw `${aux.url}: HTTP ${response.status}`
				}

				let { issuers, currencies } = parse(data);
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
							currency: decode$3(code),
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
		});
	}
}

var aux = /*#__PURE__*/Object.freeze({
	__proto__: null,
	willRun: willRun$7,
	run: run$7
});

function willRun$6(config){
	return !!config.xumm?.apiKey
}

function run$6({ config, repo }){
	let fetchApi = createFetch({
		baseUrl: 'https://xumm.app/api/v1/platform/',
		headers: {
			'x-api-key': config.xumm.apiKey, 
			'x-api-secret': config.xumm.apiSecret
		},
		ratelimit: config.xumm.maxRequestsPerMinute
	});

	let fetchAvatar = createFetch({
		baseUrl: 'https://xumm.app/avatar/',
		ratelimit: config.xumm.maxRequestsPerMinute 
	});

	scheduleTimeRoutine({
		id: 'xumm.assets',
		interval: config.xumm.refreshIntervalAssets,
		routine: async t => {
			log.info(`fetching curated asset list...`);

			let { data } = await fetchApi('curated-assets');
			let metas = [];

			log.info(`got ${Object.values(data.details).length} issuers`);

			for(let issuer of Object.values(data.details)){
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
							currency: decode$3(currency.currency),
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
	});

	scheduleTimeRoutine({
		id: 'xumm.kyc',
		interval: config.xumm.refreshIntervalKyc,
		forEvery: 'account',
		routine: async (t, accountId) => {
			let account = await repo.accounts.get({id: accountId});
			let { data } = await fetchApi(`kyc-status/${account.address}`);

			if(data.kycApproved){
				repo.metas.insert({
					meta: {
						kyc: true
					},
					account: account.id,
					source: 'xumm'
				});
			}

			accumulate({'% KYC(s) checked': 1});
		}
	});
	
	scheduleTimeRoutine({
		id: 'xumm.avatar',
		interval: config.xumm.refreshIntervalAvatar,
		forEvery: 'account',
		routine: async (t, accountId) => {
			let account = await repo.accounts.get({id: accountId});
			let { headers } = await fetchAvatar(
				`${account.address}.png`, 
				{redirect: 'manual'}
			);

			if(headers.get('location')){
				repo.metas.insert({
					meta: {
						icon: headers.get('location').split('?')[0]
					},
					account: account.id,
					source: 'xumm'
				});
			}

			accumulate({'% avatar(s) checked': 1});
		}
	});
}

var xumm = /*#__PURE__*/Object.freeze({
	__proto__: null,
	willRun: willRun$6,
	run: run$6
});

function willRun$5(config){
	return !!config.bithomp?.apiKey
}


function run$5({ repo, config }){
	let fetch = createFetch({
		baseUrl: 'https://bithomp.com/api/v2', 
		headers: {
			'x-bithomp-token': config.bithomp.apiKey
		}
	});

	scheduleTimeRoutine({
		id: 'bithomp.assets',
		interval: config.bithomp.refreshInterval,
		routine: async t => {
			log.info(`fetching services list...`);

			let { data } = await fetch('services');
			let services = data.services;
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
	});
}

var bithomp = /*#__PURE__*/Object.freeze({
	__proto__: null,
	willRun: willRun$5,
	run: run$5
});

function willRun$4(config){
	return !!config.xrpscan
}


function run$4({ repo, config }){
	let fetch = new createFetch({
		baseUrl: 'https://api.xrpscan.com/api/v1'
	});

	scheduleTimeRoutine({
		id: 'xrpscan.well-known',
		interval: config.xrpscan.refreshInterval,
		routine: async t => {
			log.info(`fetching well-known list...`);

			let { data } = await fetch('names/well-known');
			let metas = [];

			log.info(`got`, data.length, `names`);

			for(let { account, name, domain, twitter, verified } of data){
				metas.push({
					meta: {
						name,
						domain,
						twitter,
						verified,
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
	});
}

var xrpscan = /*#__PURE__*/Object.freeze({
	__proto__: null,
	willRun: willRun$4,
	run: run$4
});

function willRun$3(config){
	return !!config.gravatar
}


function run$3({ repo, config }){
	let fetch = new createFetch({
		baseUrl: 'https://www.gravatar.com',
		ratelimit: config.gravatar.maxRequestsPerMinute
	});

	scheduleTimeRoutine({
		id: 'gravatar',
		interval: config.gravatar.refreshInterval,
		forEvery: 'account',
		routine: async (t, accountId) => {
			let { emailHash } = await repo.accounts.get({id: accountId});
			let meta = {icon: undefined};

			if(emailHash){
				let { status } = await fetch(`avatar/${emailHash.toLowerCase()}?d=404`);

				if(status === 200){
					meta.icon = `https://www.gravatar.com/avatar/${emailHash.toLowerCase()}`;
				}else if(status !== 404){
					throw `HTTP ${status}`
				}
			}

			await repo.metas.insert({
				meta,
				account: accountId,
				source: 'gravatar'
			});

			accumulate({'% avatar(s) checked': 1});
		}
	});
}

var gravatar = /*#__PURE__*/Object.freeze({
	__proto__: null,
	willRun: willRun$3,
	run: run$3
});

function willRun$2(config){
	return !!config.twitter?.bearerToken
}


function run$2({ repo, config }){
	let fetch = createFetch({
		baseUrl: 'https://api.twitter.com/2',
		headers: {
			authorization: `Bearer ${config.twitter.bearerToken}`
		},
		ratelimit: config.twitter.maxRequestsPerMinute 
	});

	scheduleTimeRoutine({
		id: 'twitter.meta',
		interval: config.twitter.refreshInterval,
		routine: async t => {
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

				let usernamesQuery = batch
					.map(({twitter}) => twitter)
					.join(',');

				let { status, data: {data, errors} } = await fetch(
					'users/by?user.fields=name,profile_image_url,description,entities,public_metrics'
					+ `&usernames=${encodeURIComponent(usernamesQuery)}`
				);

				if(status !== 200)
					throw `HTTP ${status}`
			
				if(!data){
					throw errors[0]
				}

				log.info(`got`, data.length, `profiles`);
				log.info(`writing metas to db`);


				for(let {twitter, accounts} of batch){
					let profile = data.find(entry => entry.username.toLowerCase() === twitter.toLowerCase());
					let meta = {
						followers: null,
						name: undefined,
						icon: undefined,
						description: undefined,
						domain: undefined
					};


					if(profile){
						meta.followers = profile.public_metrics.followers_count;
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
	});
}

var twitter = /*#__PURE__*/Object.freeze({
	__proto__: null,
	willRun: willRun$2,
	run: run$2
});

const tasks$2 = {};

const map = {
	snapshot,
	backfill,
	stream,
	aux,
	xumm,
	bithomp,
	xrpscan,
	gravatar,
	twitter
};

for(let [id, task] of Object.entries(map)){
	tasks$2[`crawler:${id}`] = {
		...task,
		run: ctx => {
			setContext(ctx);
			task.run(ctx);
		}
	};
}

function allocate$6(heads){
	log.time(`sync.candles`, `building exchanges cache`);

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
			//filter outliers, format exchange so volume is XRP
			exchanges = exchanges
				.filter(exchange => 
					formatExchange(
						exchange,
						base ? base : quote,
						base ? quote : base
					).volume.gte('0.001')
				);
		}

		exchanges.sort((a, b) => a.date - b.date);

		if(exchanges.length > 0){
			let exchangesBQ = exchanges.map(exchange => formatExchange(
				exchange, 
				base, 
				quote
			));

			let exchangesQB = exchanges.map(exchange => formatExchange(
				exchange, 
				quote, 
				base
			));

			this.cache.tx(() => {
				for(let timeframe of Object.values(this.config.server.marketTimeframes)){
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
			log.info(`processed`, processed, `of`, count, `exchanges (${progress}%)`);
		}
	}
	
	log.time(`sync.candles`, `built exchanges cache in %`);
}


function register$2({ ranges }){
	if(!ranges.exchanges)
		return

	let newExchanges = this.repo.exchanges.iter({
		from: ranges.exchanges[0],
		to: ranges.exchanges[1]
	});

	for(let exchange of newExchanges){
		let exchangeBQ = formatExchange(exchange, exchange.base, exchange.quote);
		let exchangeQB = formatExchange(exchange, exchange.quote, exchange.base);

		if(!exchange.base || !exchange.quote){
			let volume = exchange.base ? exchangeBQ.volume : exchangeQB.volume;

			if(volume.lt('0.01'))
				continue
		}

		for(let timeframe of Object.values(this.config.server.marketTimeframes)){
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

function formatExchange(exchange, base, quote){
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

function allocate$5(heads){
	log.time(`sync.tokens`, `building tokens cache`);

	let tokens = this.repo.tokens.all();
	let progress = 0;
	
	for(let i=0; i<tokens.length; i++){
		compose.call(this, tokens[i]);

		let newProgress = Math.floor((i / tokens.length) * 100);

		if(newProgress !== progress){
			progress = newProgress;
			log.info(`processed`, i, `of`, tokens.length, `tokens (${progress}%)`);
		}
	}

	log.time(`sync.tokens`, `built tokens cache in %`);
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
			this.config.server.sourcePriorities
		),
		issuer: sortMetas(
			mapMultiKey(issuerMetas, 'key', true),
			this.config.server.sourcePriorities
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

function allocate$4(heads){
	log.time(`sync.stats`, `building stats cache`);

	let tokens = this.repo.tokens.all();
	let progress = 0;
	
	for(let i=0; i<tokens.length; i++){
		let token = tokens[i].id;
		let stats = this.repo.stats.all({token});
		let refTimeframe = Object.values(this.repo.config.server.snapshotTimeframes)[0];

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

		for(let timeframe of Object.values(this.config.server.snapshotTimeframes)){
			this.cache.stats.allocate({token, timeframe}, combined);
		}

		let newProgress = Math.floor((i / tokens.length) * 100);

		if(newProgress !== progress){
			progress = newProgress;
			log.info(`processed`, i, `of`, tokens.length, `stats (${progress}%)`);
		}
	}

	log.time(`sync.stats`, `built stats cache in %`);
}

function register({ affected, ranges }){
	let timeframeCandles = Object.values(this.repo.config.server.snapshotTimeframes)[0];

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

		for(let timeframe of Object.values(this.config.server.snapshotTimeframes)){
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

function init$3(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Heads" (
			"key"		TEXT NOT NULL UNIQUE,
			"sequence"	INTEGER NOT NULL
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

function allocate$3(series, exchanges){
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
	allocate: allocate$3,
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

function allocate$2(pair, exchanges){
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
	allocate: allocate$2,
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
				this.config.xrpl.topPercenters
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

function allocate$1(series, stats){
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
	allocate: allocate$1,
	integrate: integrate
});

var initCache = config => new DB({
	...config,
	file: `${config.data.dir}/cache.db`,
	journalMode: config.data.journalMode || 'WAL',
	modules: {
		heads,
		tokens: tokens$1,
		candles,
		trades,
		stats
	}
});

function willRun$1(config){
	return !!config.server
}

async function run$1({ config, repo }){
	let cache = initCache(config);
	let ctx = {config, repo, cache};

	try{
		if(cache.newlyCreated){
			log.info('first time creating caching database');
			allocate(ctx);
		}else {
			if(Object.keys(cache.heads.all()).length === 0)
				throw 'incomplete'
		}
	}catch(e){
		log.error(`caching database corrupted (${e}) -> recreating from scratch`);

		while(true){
			try{
				cache.wipe();
				break
			}catch{
				log.warn(`could not wipe corrupted data base - killing occupiers`);
				process.send({type: 'kill', task: 'server:api'});
				await wait(500);
			}
		}
		
		allocate(ctx);
	}

	syncRoutine(ctx);
	refreshRoutine(ctx);
}

function allocate(ctx){
	let repoHeads = ctx.repo.heads.all();

	log.time(`sync.prepare`, `building caching database`);

	allocate$6.call(ctx, repoHeads);
	allocate$4.call(ctx, repoHeads);
	allocate$5.call(ctx, repoHeads);

	log.time(`sync.prepare`, `built complete caching database in %`);

	ctx.cache.heads.set(repoHeads);
}

async function syncRoutine(ctx){
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


		/*log.time(
			`sync.update`,
			`tracked updates:`,
			Object.entries(ranges)
				.map(([key, [o, n]]) => `${key} ${o} -> ${n}`)
				.join(`, `)
		)*/
		
		try{
			ctx.cache.tx(() => {
				//log.time(`sync.update.exchanges`)
				register$2.call(ctx, {ranges, affected});
				//log.time(`sync.update.exchanges`, `applied exchanges in %`)

				//log.time(`sync.update.stats`)
				register.call(ctx, {ranges, affected});
				//log.time(`sync.update.stats`, `applied stats in %`)

				//log.time(`sync.update.tokens`)
				register$1.call(ctx, {ranges, affected});
				//log.time(`sync.update.tokens`, `applied tokens in %`)

				ctx.cache.heads.set(repoHeads);
			});
		}catch(e){
			log.error(`failed to commit updates:\n`, e);
			await wait(1000);
			continue
		}

		//log.time(`sync.update`, `committed updates in %`)

		for(let [key, [o, n]] of Object.entries(ranges)){
			accumulate({[`+% ${key}`]: n-o});
		}
	}
}

async function refreshRoutine(ctx){
	while(true){
		await wait(10000);

		let outdatedTokens = ctx.cache.tokens.all({updatedBefore: unixNow() - 60 * 15});

		if(outdatedTokens.length > 0){
			let failed = 0;
			
			log.time(`sync.tokensupdate`, `updating ${outdatedTokens.length} stale tokens`);

			try{
				for(let { id } of outdatedTokens){
					try{
						update.call(ctx, id);
					}catch{
						failed++;
					}
				}
			}catch(e){
				log.error(`failed to commit token updates:\n`, e);
			}

			log.time(`sync.tokensupdate`, `updated ${outdatedTokens.length - failed} / ${outdatedTokens.length} stale tokens in %`);
		}
	}
}

var sync = /*#__PURE__*/Object.freeze({
	__proto__: null,
	willRun: willRun$1,
	run: run$1
});

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
	snapshot: ['trustlines', 'marketcap', 'supply', 'liquidity', 'distribution']
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



async function tokens(ctx){
	let limit = Math.min(1000, ctx.parameters.limit || 100);
	let offset = ctx.parameters.offset || 0;
	let sort = ctx.parameters.sort || allowedSorts[0];
	let trusted = ctx.parameters.trusted;
	let search = ctx.parameters.search;
	ctx.cache.tokens.count();
	ctx.config.server.sourcePriorities;


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


async function token_series(ctx){
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
				[...metricDivisions.market, ...metricDivisions.snapshot].join(', ')
			}`, 
			expose: true
		}
	}

	if(!ctx.config.server[`${division}Timeframes`][timeframe]){
		throw {
			message: `timeframe "${timeframe}" not available - available timeframes are: ${
				Object.keys(ctx.config.server[`${division}Timeframes`]).join(', ')
			}`, 
			expose: true
		}
	}

	if(division === 'market'){
		let candles = ctx.cache.candles.all(
			{
				base: token.id, 
				quote: null, 
				timeframe: ctx.config.server.marketTimeframes[timeframe]
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
	}else if(division === 'snapshot'){
		let stats = ctx.cache.stats.all(
			{
				token: token.id, 
				timeframe: ctx.config.server.snapshotTimeframes[timeframe]
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

var methods = /*#__PURE__*/Object.freeze({
	__proto__: null,
	tokens: tokens,
	token: token,
	token_series: token_series
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
				'token_series', 
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
			if(!methods[name]){
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

				ctx.body = await methods[name]({
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

const keepAliveInterval = 10000;


class WSManager{
	constructor(ctx){
		this.ctx = ctx;
		this.clients = [];
		this.counter = 0;

		setInterval(() => this.ping(), keepAliveInterval);
	}

	register(socket){
		 let client = {
			id: ++this.counter,
			socket, 
			subscriptions: [],
			alive: true
		};

		socket.on('message', async message => {
			try{
				var request = JSON.parse(message);
			}catch{
				log.info(`client #${client.id} sent malformed request - dropping them`);
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
					log.info(`internal server error while serving client #${client.id}:`, error);
					response = {message: 'internal server error'};
				}

				socket.send(JSON.stringify({id: request.id, error: response}));
			}
		});

		socket.on('pong', () => {
			client.alive = true;
		});

		socket.on('close', () => {
			this.clients.splice(this.clients.indexOf(client));
			log.info(`client #${client.id} disconnected`);
		});

		this.clients.push(client);
		log.info(`new connection (#${client.id})`);
	}

	async serveRequest(client, request){
		if(!methods[request.command]){
			throw {message: 'unknown command', expose: true}
		}

		return await methods[request.command]({
			...this.ctx,
			parameters: request
		})
	}

	async subscribe(client, request){
		
	}

	ping(){
		for(let client of this.clients){
			if(!client.alive){
				client.socket.close();
				log.info(`client #${client.id} inactivity kick`);
				continue
			}

			client.alive = false;
			client.socket.ping();
		}
	}
}

function willRun(config){
	return !!config.server
}


function run({ config, repo }) {
	let cache = initCache(config);
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

	log.info(`listening on port ${config.server.port}`);
}

var api = /*#__PURE__*/Object.freeze({
	__proto__: null,
	willRun: willRun,
	run: run
});

const tasks$1 = {
	'server:sync': sync,
	'server:api': api,
};

const args = minimist(process.argv.slice(2));
const configPath = args.config
	? args.config
	: path.join(os.homedir(), '.xrplmeta', 'config.toml');


log.config({
	name: 'main', 
	color: 'yellow', 
	severity: args.log || 'info'
});

log.info(`*** XRPLMETA NODE ***`);
log.info(`using config at "${configPath}"`);


const config = load(configPath, true);
const repo = initRepo(config);
const command = args._[0] || 'run';
const tasks = {...tasks$2, ...tasks$1};


log.info(`data directory is at "${config.data.dir}"`);



switch(command){
	case 'run': {
		const xrpl = new Hub(config.xrpl);
		const only = args.only ? args.only.split(',') : null;
		const activeTasks = [];

		for(let [id, task] of Object.entries(tasks)){
			if((!only || only.includes(id)) && task.willRun(config)){
				activeTasks.push(id);
			}else {
				log.warn(`disabling [${id}] (as per config)`);
			}
		}

		if(activeTasks.length === 0){
			log.error('no tasks to run, bye');
			process.exit();
		}

		for(let task of activeTasks){
			spawn({
				task,
				configPath,
				xrpl
			});
		}

		log.info(`all processes up`);
		
		repo.monitorWAL(60000, 100000000);
		break
	}

	case 'work': {
		const xrpl = new Client();
		const task = tasks[args.task];

		log.config({
			name: args.task, 
			color: 'cyan',
			isSubprocess: true
		});

		task.run({config, repo, xrpl});
		break
	}

	case 'flush': {
		repo.flushWAL();
		break
	}

	default: {
		log.error(`"${command}" is an unknown command`);
		break
	}
}
