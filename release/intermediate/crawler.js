'use strict';

var child_process = require('child_process');
require('url');
var minimist = require('minimist');
var fs = require('fs');
var toml = require('toml');
var path = require('path');
var Adapter = require('better-sqlite3');
var Decimal = require('decimal.js');
var codec = require('ripple-address-codec');
var EventEmitter = require('events');
var xrpl = require('xrpl');
var http = require('node:http');
var https = require('node:https');
var zlib = require('node:zlib');
var Stream = require('node:stream');
var node_buffer = require('node:buffer');
var node_util = require('node:util');
var node_url = require('node:url');
var node_net = require('node:net');
require('node:fs');
require('node:path');
require('node-domexception');
var limiter = require('limiter');
var require$$0 = require('web-streams-polyfill/dist/ponyfill.es2018.js');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var minimist__default = /*#__PURE__*/_interopDefaultLegacy(minimist);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var toml__default = /*#__PURE__*/_interopDefaultLegacy(toml);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var Adapter__default = /*#__PURE__*/_interopDefaultLegacy(Adapter);
var Decimal__default = /*#__PURE__*/_interopDefaultLegacy(Decimal);
var codec__default = /*#__PURE__*/_interopDefaultLegacy(codec);
var EventEmitter__default = /*#__PURE__*/_interopDefaultLegacy(EventEmitter);
var xrpl__default = /*#__PURE__*/_interopDefaultLegacy(xrpl);
var http__default = /*#__PURE__*/_interopDefaultLegacy(http);
var https__default = /*#__PURE__*/_interopDefaultLegacy(https);
var zlib__default = /*#__PURE__*/_interopDefaultLegacy(zlib);
var Stream__default = /*#__PURE__*/_interopDefaultLegacy(Stream);
var require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0);

/**
 * Returns a `Buffer` instance from the given data URI `uri`.
 *
 * @param {String} uri Data URI to turn into a Buffer instance
 * @returns {Buffer} Buffer instance from Data URI
 * @api public
 */
function dataUriToBuffer(uri) {
    if (!/^data:/i.test(uri)) {
        throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');
    }
    // strip newlines
    uri = uri.replace(/\r?\n/g, '');
    // split the URI up into the "metadata" and the "data" portions
    const firstComma = uri.indexOf(',');
    if (firstComma === -1 || firstComma <= 4) {
        throw new TypeError('malformed data: URI');
    }
    // remove the "data:" scheme and parse the metadata
    const meta = uri.substring(5, firstComma).split(';');
    let charset = '';
    let base64 = false;
    const type = meta[0] || 'text/plain';
    let typeFull = type;
    for (let i = 1; i < meta.length; i++) {
        if (meta[i] === 'base64') {
            base64 = true;
        }
        else {
            typeFull += `;${meta[i]}`;
            if (meta[i].indexOf('charset=') === 0) {
                charset = meta[i].substring(8);
            }
        }
    }
    // defaults to US-ASCII only if type is not provided
    if (!meta[0] && !charset.length) {
        typeFull += ';charset=US-ASCII';
        charset = 'US-ASCII';
    }
    // get the encoded data portion and decode URI-encoded chars
    const encoding = base64 ? 'base64' : 'ascii';
    const data = unescape(uri.substring(firstComma + 1));
    const buffer = Buffer.from(data, encoding);
    // set `.type` and `.typeFull` properties to MIME type
    buffer.type = type;
    buffer.typeFull = typeFull;
    // set the `.charset` property
    buffer.charset = charset;
    return buffer;
}

/* c8 ignore start */

// 64 KiB (same size chrome slice theirs blob into Uint8array's)
const POOL_SIZE$1 = 65536;

if (!globalThis.ReadableStream) {
  // `node:stream/web` got introduced in v16.5.0 as experimental
  // and it's preferred over the polyfilled version. So we also
  // suppress the warning that gets emitted by NodeJS for using it.
  try {
    const process = require('node:process');
    const { emitWarning } = process;
    try {
      process.emitWarning = () => {};
      Object.assign(globalThis, require('node:stream/web'));
      process.emitWarning = emitWarning;
    } catch (error) {
      process.emitWarning = emitWarning;
      throw error
    }
  } catch (error) {
    // fallback to polyfill implementation
    Object.assign(globalThis, require$$0__default["default"]);
  }
}

try {
  // Don't use node: prefix for this, require+node: is not supported until node v14.14
  // Only `import()` can use prefix in 12.20 and later
  const { Blob } = require('buffer');
  if (Blob && !Blob.prototype.stream) {
    Blob.prototype.stream = function name (params) {
      let position = 0;
      const blob = this;

      return new ReadableStream({
        type: 'bytes',
        async pull (ctrl) {
          const chunk = blob.slice(position, Math.min(blob.size, position + POOL_SIZE$1));
          const buffer = await chunk.arrayBuffer();
          position += buffer.byteLength;
          ctrl.enqueue(new Uint8Array(buffer));

          if (position === blob.size) {
            ctrl.close();
          }
        }
      })
    };
  }
} catch (error) {}

/*! fetch-blob. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */

// 64 KiB (same size chrome slice theirs blob into Uint8array's)
const POOL_SIZE = 65536;

/** @param {(Blob | Uint8Array)[]} parts */
async function * toIterator (parts, clone = true) {
  for (const part of parts) {
    if ('stream' in part) {
      yield * (/** @type {AsyncIterableIterator<Uint8Array>} */ (part.stream()));
    } else if (ArrayBuffer.isView(part)) {
      if (clone) {
        let position = part.byteOffset;
        const end = part.byteOffset + part.byteLength;
        while (position !== end) {
          const size = Math.min(end - position, POOL_SIZE);
          const chunk = part.buffer.slice(position, position + size);
          position += chunk.byteLength;
          yield new Uint8Array(chunk);
        }
      } else {
        yield part;
      }
    /* c8 ignore next 10 */
    } else {
      // For blobs that have arrayBuffer but no stream method (nodes buffer.Blob)
      let position = 0, b = (/** @type {Blob} */ (part));
      while (position !== b.size) {
        const chunk = b.slice(position, Math.min(b.size, position + POOL_SIZE));
        const buffer = await chunk.arrayBuffer();
        position += buffer.byteLength;
        yield new Uint8Array(buffer);
      }
    }
  }
}

const _Blob = class Blob {
  /** @type {Array.<(Blob|Uint8Array)>} */
  #parts = []
  #type = ''
  #size = 0
  #endings = 'transparent'

  /**
   * The Blob() constructor returns a new Blob object. The content
   * of the blob consists of the concatenation of the values given
   * in the parameter array.
   *
   * @param {*} blobParts
   * @param {{ type?: string, endings?: string }} [options]
   */
  constructor (blobParts = [], options = {}) {
    if (typeof blobParts !== 'object' || blobParts === null) {
      throw new TypeError('Failed to construct \'Blob\': The provided value cannot be converted to a sequence.')
    }

    if (typeof blobParts[Symbol.iterator] !== 'function') {
      throw new TypeError('Failed to construct \'Blob\': The object must have a callable @@iterator property.')
    }

    if (typeof options !== 'object' && typeof options !== 'function') {
      throw new TypeError('Failed to construct \'Blob\': parameter 2 cannot convert to dictionary.')
    }

    if (options === null) options = {};

    const encoder = new TextEncoder();
    for (const element of blobParts) {
      let part;
      if (ArrayBuffer.isView(element)) {
        part = new Uint8Array(element.buffer.slice(element.byteOffset, element.byteOffset + element.byteLength));
      } else if (element instanceof ArrayBuffer) {
        part = new Uint8Array(element.slice(0));
      } else if (element instanceof Blob) {
        part = element;
      } else {
        part = encoder.encode(`${element}`);
      }

      const size = ArrayBuffer.isView(part) ? part.byteLength : part.size;
      // Avoid pushing empty parts into the array to better GC them
      if (size) {
        this.#size += size;
        this.#parts.push(part);
      }
    }

    this.#endings = `${options.endings === undefined ? 'transparent' : options.endings}`;
    const type = options.type === undefined ? '' : String(options.type);
    this.#type = /^[\x20-\x7E]*$/.test(type) ? type : '';
  }

  /**
   * The Blob interface's size property returns the
   * size of the Blob in bytes.
   */
  get size () {
    return this.#size
  }

  /**
   * The type property of a Blob object returns the MIME type of the file.
   */
  get type () {
    return this.#type
  }

  /**
   * The text() method in the Blob interface returns a Promise
   * that resolves with a string containing the contents of
   * the blob, interpreted as UTF-8.
   *
   * @return {Promise<string>}
   */
  async text () {
    // More optimized than using this.arrayBuffer()
    // that requires twice as much ram
    const decoder = new TextDecoder();
    let str = '';
    for await (const part of toIterator(this.#parts, false)) {
      str += decoder.decode(part, { stream: true });
    }
    // Remaining
    str += decoder.decode();
    return str
  }

  /**
   * The arrayBuffer() method in the Blob interface returns a
   * Promise that resolves with the contents of the blob as
   * binary data contained in an ArrayBuffer.
   *
   * @return {Promise<ArrayBuffer>}
   */
  async arrayBuffer () {
    // Easier way... Just a unnecessary overhead
    // const view = new Uint8Array(this.size);
    // await this.stream().getReader({mode: 'byob'}).read(view);
    // return view.buffer;

    const data = new Uint8Array(this.size);
    let offset = 0;
    for await (const chunk of toIterator(this.#parts, false)) {
      data.set(chunk, offset);
      offset += chunk.length;
    }

    return data.buffer
  }

  stream () {
    const it = toIterator(this.#parts, true);

    return new globalThis.ReadableStream({
      // @ts-ignore
      type: 'bytes',
      async pull (ctrl) {
        const chunk = await it.next();
        chunk.done ? ctrl.close() : ctrl.enqueue(chunk.value);
      },

      async cancel () {
        await it.return();
      }
    })
  }

  /**
   * The Blob interface's slice() method creates and returns a
   * new Blob object which contains data from a subset of the
   * blob on which it's called.
   *
   * @param {number} [start]
   * @param {number} [end]
   * @param {string} [type]
   */
  slice (start = 0, end = this.size, type = '') {
    const { size } = this;

    let relativeStart = start < 0 ? Math.max(size + start, 0) : Math.min(start, size);
    let relativeEnd = end < 0 ? Math.max(size + end, 0) : Math.min(end, size);

    const span = Math.max(relativeEnd - relativeStart, 0);
    const parts = this.#parts;
    const blobParts = [];
    let added = 0;

    for (const part of parts) {
      // don't add the overflow to new blobParts
      if (added >= span) {
        break
      }

      const size = ArrayBuffer.isView(part) ? part.byteLength : part.size;
      if (relativeStart && size <= relativeStart) {
        // Skip the beginning and change the relative
        // start & end position as we skip the unwanted parts
        relativeStart -= size;
        relativeEnd -= size;
      } else {
        let chunk;
        if (ArrayBuffer.isView(part)) {
          chunk = part.subarray(relativeStart, Math.min(size, relativeEnd));
          added += chunk.byteLength;
        } else {
          chunk = part.slice(relativeStart, Math.min(size, relativeEnd));
          added += chunk.size;
        }
        relativeEnd -= size;
        blobParts.push(chunk);
        relativeStart = 0; // All next sequential parts should start at 0
      }
    }

    const blob = new Blob([], { type: String(type).toLowerCase() });
    blob.#size = span;
    blob.#parts = blobParts;

    return blob
  }

  get [Symbol.toStringTag] () {
    return 'Blob'
  }

  static [Symbol.hasInstance] (object) {
    return (
      object &&
      typeof object === 'object' &&
      typeof object.constructor === 'function' &&
      (
        typeof object.stream === 'function' ||
        typeof object.arrayBuffer === 'function'
      ) &&
      /^(Blob|File)$/.test(object[Symbol.toStringTag])
    )
  }
};

Object.defineProperties(_Blob.prototype, {
  size: { enumerable: true },
  type: { enumerable: true },
  slice: { enumerable: true }
});

/** @type {typeof globalThis.Blob} */
const Blob = _Blob;
var Blob$1 = Blob;

const _File = class File extends Blob$1 {
  #lastModified = 0
  #name = ''

  /**
   * @param {*[]} fileBits
   * @param {string} fileName
   * @param {{lastModified?: number, type?: string}} options
   */// @ts-ignore
  constructor (fileBits, fileName, options = {}) {
    if (arguments.length < 2) {
      throw new TypeError(`Failed to construct 'File': 2 arguments required, but only ${arguments.length} present.`)
    }
    super(fileBits, options);

    if (options === null) options = {};

    // Simulate WebIDL type casting for NaN value in lastModified option.
    const lastModified = options.lastModified === undefined ? Date.now() : Number(options.lastModified);
    if (!Number.isNaN(lastModified)) {
      this.#lastModified = lastModified;
    }

    this.#name = String(fileName);
  }

  get name () {
    return this.#name
  }

  get lastModified () {
    return this.#lastModified
  }

  get [Symbol.toStringTag] () {
    return 'File'
  }

  static [Symbol.hasInstance] (object) {
    return !!object && object instanceof Blob$1 &&
      /^(File)$/.test(object[Symbol.toStringTag])
  }
};

/** @type {typeof globalThis.File} */// @ts-ignore
const File = _File;

/*! formdata-polyfill. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */

var {toStringTag:t,iterator:i,hasInstance:h}=Symbol,
r=Math.random,
m='append,set,get,getAll,delete,keys,values,entries,forEach,constructor'.split(','),
f$1=(a,b,c)=>(a+='',/^(Blob|File)$/.test(b && b[t])?[(c=c!==void 0?c+'':b[t]=='File'?b.name:'blob',a),b.name!==c||b[t]=='blob'?new File([b],c,b):b]:[a,b+'']),
e=(c,f)=>(f?c:c.replace(/\r?\n|\r/g,'\r\n')).replace(/\n/g,'%0A').replace(/\r/g,'%0D').replace(/"/g,'%22'),
x=(n, a, e)=>{if(a.length<e){throw new TypeError(`Failed to execute '${n}' on 'FormData': ${e} arguments required, but only ${a.length} present.`)}};

/** @type {typeof globalThis.FormData} */
const FormData = class FormData {
#d=[];
constructor(...a){if(a.length)throw new TypeError(`Failed to construct 'FormData': parameter 1 is not of type 'HTMLFormElement'.`)}
get [t]() {return 'FormData'}
[i](){return this.entries()}
static [h](o) {return o&&typeof o==='object'&&o[t]==='FormData'&&!m.some(m=>typeof o[m]!='function')}
append(...a){x('append',arguments,2);this.#d.push(f$1(...a));}
delete(a){x('delete',arguments,1);a+='';this.#d=this.#d.filter(([b])=>b!==a);}
get(a){x('get',arguments,1);a+='';for(var b=this.#d,l=b.length,c=0;c<l;c++)if(b[c][0]===a)return b[c][1];return null}
getAll(a,b){x('getAll',arguments,1);b=[];a+='';this.#d.forEach(c=>c[0]===a&&b.push(c[1]));return b}
has(a){x('has',arguments,1);a+='';return this.#d.some(b=>b[0]===a)}
forEach(a,b){x('forEach',arguments,1);for(var [c,d]of this)a.call(b,d,c,this);}
set(...a){x('set',arguments,2);var b=[],c=!0;a=f$1(...a);this.#d.forEach(d=>{d[0]===a[0]?c&&(c=!b.push(a)):b.push(d);});c&&b.push(a);this.#d=b;}
*entries(){yield*this.#d;}
*keys(){for(var[a]of this)yield a;}
*values(){for(var[,a]of this)yield a;}};

/** @param {FormData} F */
function formDataToBlob (F,B=Blob$1){
var b=`${r()}${r()}`.replace(/\./g, '').slice(-28).padStart(32, '-'),c=[],p=`--${b}\r\nContent-Disposition: form-data; name="`;
F.forEach((v,n)=>typeof v=='string'
?c.push(p+e(n)+`"\r\n\r\n${v.replace(/\r(?!\n)|(?<!\r)\n/g, '\r\n')}\r\n`)
:c.push(p+e(n)+`"; filename="${e(v.name, 1)}"\r\nContent-Type: ${v.type||"application/octet-stream"}\r\n\r\n`, v, '\r\n'));
c.push(`--${b}--`);
return new B(c,{type:"multipart/form-data; boundary="+b})}

class FetchBaseError extends Error {
	constructor(message, type) {
		super(message);
		// Hide custom error implementation details from end-users
		Error.captureStackTrace(this, this.constructor);

		this.type = type;
	}

	get name() {
		return this.constructor.name;
	}

	get [Symbol.toStringTag]() {
		return this.constructor.name;
	}
}

/**
 * @typedef {{ address?: string, code: string, dest?: string, errno: number, info?: object, message: string, path?: string, port?: number, syscall: string}} SystemError
*/

/**
 * FetchError interface for operational errors
 */
class FetchError extends FetchBaseError {
	/**
	 * @param  {string} message -      Error message for human
	 * @param  {string} [type] -        Error type for machine
	 * @param  {SystemError} [systemError] - For Node.js system error
	 */
	constructor(message, type, systemError) {
		super(message, type);
		// When err.type is `system`, err.erroredSysCall contains system error and err.code contains system error code
		if (systemError) {
			// eslint-disable-next-line no-multi-assign
			this.code = this.errno = systemError.code;
			this.erroredSysCall = systemError.syscall;
		}
	}
}

/**
 * Is.js
 *
 * Object type checks.
 */

const NAME = Symbol.toStringTag;

/**
 * Check if `obj` is a URLSearchParams object
 * ref: https://github.com/node-fetch/node-fetch/issues/296#issuecomment-307598143
 * @param {*} object - Object to check for
 * @return {boolean}
 */
const isURLSearchParameters = object => {
	return (
		typeof object === 'object' &&
		typeof object.append === 'function' &&
		typeof object.delete === 'function' &&
		typeof object.get === 'function' &&
		typeof object.getAll === 'function' &&
		typeof object.has === 'function' &&
		typeof object.set === 'function' &&
		typeof object.sort === 'function' &&
		object[NAME] === 'URLSearchParams'
	);
};

/**
 * Check if `object` is a W3C `Blob` object (which `File` inherits from)
 * @param {*} object - Object to check for
 * @return {boolean}
 */
const isBlob = object => {
	return (
		object &&
		typeof object === 'object' &&
		typeof object.arrayBuffer === 'function' &&
		typeof object.type === 'string' &&
		typeof object.stream === 'function' &&
		typeof object.constructor === 'function' &&
		/^(Blob|File)$/.test(object[NAME])
	);
};

/**
 * Check if `obj` is an instance of AbortSignal.
 * @param {*} object - Object to check for
 * @return {boolean}
 */
const isAbortSignal = object => {
	return (
		typeof object === 'object' && (
			object[NAME] === 'AbortSignal' ||
			object[NAME] === 'EventTarget'
		)
	);
};

/**
 * isDomainOrSubdomain reports whether sub is a subdomain (or exact match) of
 * the parent domain.
 *
 * Both domains must already be in canonical form.
 * @param {string|URL} original
 * @param {string|URL} destination
 */
const isDomainOrSubdomain = (destination, original) => {
	const orig = new URL(original).hostname;
	const dest = new URL(destination).hostname;

	return orig === dest || orig.endsWith(`.${dest}`);
};

const pipeline = node_util.promisify(Stream__default["default"].pipeline);
const INTERNALS$2 = Symbol('Body internals');

/**
 * Body mixin
 *
 * Ref: https://fetch.spec.whatwg.org/#body
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
class Body {
	constructor(body, {
		size = 0
	} = {}) {
		let boundary = null;

		if (body === null) {
			// Body is undefined or null
			body = null;
		} else if (isURLSearchParameters(body)) {
			// Body is a URLSearchParams
			body = node_buffer.Buffer.from(body.toString());
		} else if (isBlob(body)) ; else if (node_buffer.Buffer.isBuffer(body)) ; else if (node_util.types.isAnyArrayBuffer(body)) {
			// Body is ArrayBuffer
			body = node_buffer.Buffer.from(body);
		} else if (ArrayBuffer.isView(body)) {
			// Body is ArrayBufferView
			body = node_buffer.Buffer.from(body.buffer, body.byteOffset, body.byteLength);
		} else if (body instanceof Stream__default["default"]) ; else if (body instanceof FormData) {
			// Body is FormData
			body = formDataToBlob(body);
			boundary = body.type.split('=')[1];
		} else {
			// None of the above
			// coerce to string then buffer
			body = node_buffer.Buffer.from(String(body));
		}

		let stream = body;

		if (node_buffer.Buffer.isBuffer(body)) {
			stream = Stream__default["default"].Readable.from(body);
		} else if (isBlob(body)) {
			stream = Stream__default["default"].Readable.from(body.stream());
		}

		this[INTERNALS$2] = {
			body,
			stream,
			boundary,
			disturbed: false,
			error: null
		};
		this.size = size;

		if (body instanceof Stream__default["default"]) {
			body.on('error', error_ => {
				const error = error_ instanceof FetchBaseError ?
					error_ :
					new FetchError(`Invalid response body while trying to fetch ${this.url}: ${error_.message}`, 'system', error_);
				this[INTERNALS$2].error = error;
			});
		}
	}

	get body() {
		return this[INTERNALS$2].stream;
	}

	get bodyUsed() {
		return this[INTERNALS$2].disturbed;
	}

	/**
	 * Decode response as ArrayBuffer
	 *
	 * @return  Promise
	 */
	async arrayBuffer() {
		const {buffer, byteOffset, byteLength} = await consumeBody(this);
		return buffer.slice(byteOffset, byteOffset + byteLength);
	}

	async formData() {
		const ct = this.headers.get('content-type');

		if (ct.startsWith('application/x-www-form-urlencoded')) {
			const formData = new FormData();
			const parameters = new URLSearchParams(await this.text());

			for (const [name, value] of parameters) {
				formData.append(name, value);
			}

			return formData;
		}

		const {toFormData} = await Promise.resolve().then(function () { return multipartParser; });
		return toFormData(this.body, ct);
	}

	/**
	 * Return raw response as Blob
	 *
	 * @return Promise
	 */
	async blob() {
		const ct = (this.headers && this.headers.get('content-type')) || (this[INTERNALS$2].body && this[INTERNALS$2].body.type) || '';
		const buf = await this.arrayBuffer();

		return new Blob$1([buf], {
			type: ct
		});
	}

	/**
	 * Decode response as json
	 *
	 * @return  Promise
	 */
	async json() {
		const text = await this.text();
		return JSON.parse(text);
	}

	/**
	 * Decode response as text
	 *
	 * @return  Promise
	 */
	async text() {
		const buffer = await consumeBody(this);
		return new TextDecoder().decode(buffer);
	}

	/**
	 * Decode response as buffer (non-spec api)
	 *
	 * @return  Promise
	 */
	buffer() {
		return consumeBody(this);
	}
}

Body.prototype.buffer = node_util.deprecate(Body.prototype.buffer, 'Please use \'response.arrayBuffer()\' instead of \'response.buffer()\'', 'node-fetch#buffer');

// In browsers, all properties are enumerable.
Object.defineProperties(Body.prototype, {
	body: {enumerable: true},
	bodyUsed: {enumerable: true},
	arrayBuffer: {enumerable: true},
	blob: {enumerable: true},
	json: {enumerable: true},
	text: {enumerable: true},
	data: {get: node_util.deprecate(() => {},
		'data doesn\'t exist, use json(), text(), arrayBuffer(), or body instead',
		'https://github.com/node-fetch/node-fetch/issues/1000 (response)')}
});

/**
 * Consume and convert an entire Body to a Buffer.
 *
 * Ref: https://fetch.spec.whatwg.org/#concept-body-consume-body
 *
 * @return Promise
 */
async function consumeBody(data) {
	if (data[INTERNALS$2].disturbed) {
		throw new TypeError(`body used already for: ${data.url}`);
	}

	data[INTERNALS$2].disturbed = true;

	if (data[INTERNALS$2].error) {
		throw data[INTERNALS$2].error;
	}

	const {body} = data;

	// Body is null
	if (body === null) {
		return node_buffer.Buffer.alloc(0);
	}

	/* c8 ignore next 3 */
	if (!(body instanceof Stream__default["default"])) {
		return node_buffer.Buffer.alloc(0);
	}

	// Body is stream
	// get ready to actually consume the body
	const accum = [];
	let accumBytes = 0;

	try {
		for await (const chunk of body) {
			if (data.size > 0 && accumBytes + chunk.length > data.size) {
				const error = new FetchError(`content size at ${data.url} over limit: ${data.size}`, 'max-size');
				body.destroy(error);
				throw error;
			}

			accumBytes += chunk.length;
			accum.push(chunk);
		}
	} catch (error) {
		const error_ = error instanceof FetchBaseError ? error : new FetchError(`Invalid response body while trying to fetch ${data.url}: ${error.message}`, 'system', error);
		throw error_;
	}

	if (body.readableEnded === true || body._readableState.ended === true) {
		try {
			if (accum.every(c => typeof c === 'string')) {
				return node_buffer.Buffer.from(accum.join(''));
			}

			return node_buffer.Buffer.concat(accum, accumBytes);
		} catch (error) {
			throw new FetchError(`Could not create Buffer from response body for ${data.url}: ${error.message}`, 'system', error);
		}
	} else {
		throw new FetchError(`Premature close of server response while trying to fetch ${data.url}`);
	}
}

/**
 * Clone body given Res/Req instance
 *
 * @param   Mixed   instance       Response or Request instance
 * @param   String  highWaterMark  highWaterMark for both PassThrough body streams
 * @return  Mixed
 */
const clone = (instance, highWaterMark) => {
	let p1;
	let p2;
	let {body} = instance[INTERNALS$2];

	// Don't allow cloning a used body
	if (instance.bodyUsed) {
		throw new Error('cannot clone body after it is used');
	}

	// Check that body is a stream and not form-data object
	// note: we can't clone the form-data object without having it as a dependency
	if ((body instanceof Stream__default["default"]) && (typeof body.getBoundary !== 'function')) {
		// Tee instance body
		p1 = new Stream.PassThrough({highWaterMark});
		p2 = new Stream.PassThrough({highWaterMark});
		body.pipe(p1);
		body.pipe(p2);
		// Set instance body to teed body and return the other teed body
		instance[INTERNALS$2].stream = p1;
		body = p2;
	}

	return body;
};

const getNonSpecFormDataBoundary = node_util.deprecate(
	body => body.getBoundary(),
	'form-data doesn\'t follow the spec and requires special treatment. Use alternative package',
	'https://github.com/node-fetch/node-fetch/issues/1167'
);

/**
 * Performs the operation "extract a `Content-Type` value from |object|" as
 * specified in the specification:
 * https://fetch.spec.whatwg.org/#concept-bodyinit-extract
 *
 * This function assumes that instance.body is present.
 *
 * @param {any} body Any options.body input
 * @returns {string | null}
 */
const extractContentType = (body, request) => {
	// Body is null or undefined
	if (body === null) {
		return null;
	}

	// Body is string
	if (typeof body === 'string') {
		return 'text/plain;charset=UTF-8';
	}

	// Body is a URLSearchParams
	if (isURLSearchParameters(body)) {
		return 'application/x-www-form-urlencoded;charset=UTF-8';
	}

	// Body is blob
	if (isBlob(body)) {
		return body.type || null;
	}

	// Body is a Buffer (Buffer, ArrayBuffer or ArrayBufferView)
	if (node_buffer.Buffer.isBuffer(body) || node_util.types.isAnyArrayBuffer(body) || ArrayBuffer.isView(body)) {
		return null;
	}

	if (body instanceof FormData) {
		return `multipart/form-data; boundary=${request[INTERNALS$2].boundary}`;
	}

	// Detect form data input from form-data module
	if (body && typeof body.getBoundary === 'function') {
		return `multipart/form-data;boundary=${getNonSpecFormDataBoundary(body)}`;
	}

	// Body is stream - can't really do much about this
	if (body instanceof Stream__default["default"]) {
		return null;
	}

	// Body constructor defaults other things to string
	return 'text/plain;charset=UTF-8';
};

/**
 * The Fetch Standard treats this as if "total bytes" is a property on the body.
 * For us, we have to explicitly get it with a function.
 *
 * ref: https://fetch.spec.whatwg.org/#concept-body-total-bytes
 *
 * @param {any} obj.body Body object from the Body instance.
 * @returns {number | null}
 */
const getTotalBytes = request => {
	const {body} = request[INTERNALS$2];

	// Body is null or undefined
	if (body === null) {
		return 0;
	}

	// Body is Blob
	if (isBlob(body)) {
		return body.size;
	}

	// Body is Buffer
	if (node_buffer.Buffer.isBuffer(body)) {
		return body.length;
	}

	// Detect form data input from form-data module
	if (body && typeof body.getLengthSync === 'function') {
		return body.hasKnownLength && body.hasKnownLength() ? body.getLengthSync() : null;
	}

	// Body is stream
	return null;
};

/**
 * Write a Body to a Node.js WritableStream (e.g. http.Request) object.
 *
 * @param {Stream.Writable} dest The stream to write to.
 * @param obj.body Body object from the Body instance.
 * @returns {Promise<void>}
 */
const writeToStream = async (dest, {body}) => {
	if (body === null) {
		// Body is null
		dest.end();
	} else {
		// Body is stream
		await pipeline(body, dest);
	}
};

/**
 * Headers.js
 *
 * Headers class offers convenient helpers
 */

/* c8 ignore next 9 */
const validateHeaderName = typeof http__default["default"].validateHeaderName === 'function' ?
	http__default["default"].validateHeaderName :
	name => {
		if (!/^[\^`\-\w!#$%&'*+.|~]+$/.test(name)) {
			const error = new TypeError(`Header name must be a valid HTTP token [${name}]`);
			Object.defineProperty(error, 'code', {value: 'ERR_INVALID_HTTP_TOKEN'});
			throw error;
		}
	};

/* c8 ignore next 9 */
const validateHeaderValue = typeof http__default["default"].validateHeaderValue === 'function' ?
	http__default["default"].validateHeaderValue :
	(name, value) => {
		if (/[^\t\u0020-\u007E\u0080-\u00FF]/.test(value)) {
			const error = new TypeError(`Invalid character in header content ["${name}"]`);
			Object.defineProperty(error, 'code', {value: 'ERR_INVALID_CHAR'});
			throw error;
		}
	};

/**
 * @typedef {Headers | Record<string, string> | Iterable<readonly [string, string]> | Iterable<Iterable<string>>} HeadersInit
 */

/**
 * This Fetch API interface allows you to perform various actions on HTTP request and response headers.
 * These actions include retrieving, setting, adding to, and removing.
 * A Headers object has an associated header list, which is initially empty and consists of zero or more name and value pairs.
 * You can add to this using methods like append() (see Examples.)
 * In all methods of this interface, header names are matched by case-insensitive byte sequence.
 *
 */
class Headers extends URLSearchParams {
	/**
	 * Headers class
	 *
	 * @constructor
	 * @param {HeadersInit} [init] - Response headers
	 */
	constructor(init) {
		// Validate and normalize init object in [name, value(s)][]
		/** @type {string[][]} */
		let result = [];
		if (init instanceof Headers) {
			const raw = init.raw();
			for (const [name, values] of Object.entries(raw)) {
				result.push(...values.map(value => [name, value]));
			}
		} else if (init == null) ; else if (typeof init === 'object' && !node_util.types.isBoxedPrimitive(init)) {
			const method = init[Symbol.iterator];
			// eslint-disable-next-line no-eq-null, eqeqeq
			if (method == null) {
				// Record<ByteString, ByteString>
				result.push(...Object.entries(init));
			} else {
				if (typeof method !== 'function') {
					throw new TypeError('Header pairs must be iterable');
				}

				// Sequence<sequence<ByteString>>
				// Note: per spec we have to first exhaust the lists then process them
				result = [...init]
					.map(pair => {
						if (
							typeof pair !== 'object' || node_util.types.isBoxedPrimitive(pair)
						) {
							throw new TypeError('Each header pair must be an iterable object');
						}

						return [...pair];
					}).map(pair => {
						if (pair.length !== 2) {
							throw new TypeError('Each header pair must be a name/value tuple');
						}

						return [...pair];
					});
			}
		} else {
			throw new TypeError('Failed to construct \'Headers\': The provided value is not of type \'(sequence<sequence<ByteString>> or record<ByteString, ByteString>)');
		}

		// Validate and lowercase
		result =
			result.length > 0 ?
				result.map(([name, value]) => {
					validateHeaderName(name);
					validateHeaderValue(name, String(value));
					return [String(name).toLowerCase(), String(value)];
				}) :
				undefined;

		super(result);

		// Returning a Proxy that will lowercase key names, validate parameters and sort keys
		// eslint-disable-next-line no-constructor-return
		return new Proxy(this, {
			get(target, p, receiver) {
				switch (p) {
					case 'append':
					case 'set':
						return (name, value) => {
							validateHeaderName(name);
							validateHeaderValue(name, String(value));
							return URLSearchParams.prototype[p].call(
								target,
								String(name).toLowerCase(),
								String(value)
							);
						};

					case 'delete':
					case 'has':
					case 'getAll':
						return name => {
							validateHeaderName(name);
							return URLSearchParams.prototype[p].call(
								target,
								String(name).toLowerCase()
							);
						};

					case 'keys':
						return () => {
							target.sort();
							return new Set(URLSearchParams.prototype.keys.call(target)).keys();
						};

					default:
						return Reflect.get(target, p, receiver);
				}
			}
		});
		/* c8 ignore next */
	}

	get [Symbol.toStringTag]() {
		return this.constructor.name;
	}

	toString() {
		return Object.prototype.toString.call(this);
	}

	get(name) {
		const values = this.getAll(name);
		if (values.length === 0) {
			return null;
		}

		let value = values.join(', ');
		if (/^content-encoding$/i.test(name)) {
			value = value.toLowerCase();
		}

		return value;
	}

	forEach(callback, thisArg = undefined) {
		for (const name of this.keys()) {
			Reflect.apply(callback, thisArg, [this.get(name), name, this]);
		}
	}

	* values() {
		for (const name of this.keys()) {
			yield this.get(name);
		}
	}

	/**
	 * @type {() => IterableIterator<[string, string]>}
	 */
	* entries() {
		for (const name of this.keys()) {
			yield [name, this.get(name)];
		}
	}

	[Symbol.iterator]() {
		return this.entries();
	}

	/**
	 * Node-fetch non-spec method
	 * returning all headers and their values as array
	 * @returns {Record<string, string[]>}
	 */
	raw() {
		return [...this.keys()].reduce((result, key) => {
			result[key] = this.getAll(key);
			return result;
		}, {});
	}

	/**
	 * For better console.log(headers) and also to convert Headers into Node.js Request compatible format
	 */
	[Symbol.for('nodejs.util.inspect.custom')]() {
		return [...this.keys()].reduce((result, key) => {
			const values = this.getAll(key);
			// Http.request() only supports string as Host header.
			// This hack makes specifying custom Host header possible.
			if (key === 'host') {
				result[key] = values[0];
			} else {
				result[key] = values.length > 1 ? values : values[0];
			}

			return result;
		}, {});
	}
}

/**
 * Re-shaping object for Web IDL tests
 * Only need to do it for overridden methods
 */
Object.defineProperties(
	Headers.prototype,
	['get', 'entries', 'forEach', 'values'].reduce((result, property) => {
		result[property] = {enumerable: true};
		return result;
	}, {})
);

/**
 * Create a Headers object from an http.IncomingMessage.rawHeaders, ignoring those that do
 * not conform to HTTP grammar productions.
 * @param {import('http').IncomingMessage['rawHeaders']} headers
 */
function fromRawHeaders(headers = []) {
	return new Headers(
		headers
			// Split into pairs
			.reduce((result, value, index, array) => {
				if (index % 2 === 0) {
					result.push(array.slice(index, index + 2));
				}

				return result;
			}, [])
			.filter(([name, value]) => {
				try {
					validateHeaderName(name);
					validateHeaderValue(name, String(value));
					return true;
				} catch {
					return false;
				}
			})

	);
}

const redirectStatus = new Set([301, 302, 303, 307, 308]);

/**
 * Redirect code matching
 *
 * @param {number} code - Status code
 * @return {boolean}
 */
const isRedirect = code => {
	return redirectStatus.has(code);
};

/**
 * Response.js
 *
 * Response class provides content decoding
 */

const INTERNALS$1 = Symbol('Response internals');

/**
 * Response class
 *
 * Ref: https://fetch.spec.whatwg.org/#response-class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
class Response extends Body {
	constructor(body = null, options = {}) {
		super(body, options);

		// eslint-disable-next-line no-eq-null, eqeqeq, no-negated-condition
		const status = options.status != null ? options.status : 200;

		const headers = new Headers(options.headers);

		if (body !== null && !headers.has('Content-Type')) {
			const contentType = extractContentType(body, this);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		this[INTERNALS$1] = {
			type: 'default',
			url: options.url,
			status,
			statusText: options.statusText || '',
			headers,
			counter: options.counter,
			highWaterMark: options.highWaterMark
		};
	}

	get type() {
		return this[INTERNALS$1].type;
	}

	get url() {
		return this[INTERNALS$1].url || '';
	}

	get status() {
		return this[INTERNALS$1].status;
	}

	/**
	 * Convenience property representing if the request ended normally
	 */
	get ok() {
		return this[INTERNALS$1].status >= 200 && this[INTERNALS$1].status < 300;
	}

	get redirected() {
		return this[INTERNALS$1].counter > 0;
	}

	get statusText() {
		return this[INTERNALS$1].statusText;
	}

	get headers() {
		return this[INTERNALS$1].headers;
	}

	get highWaterMark() {
		return this[INTERNALS$1].highWaterMark;
	}

	/**
	 * Clone this response
	 *
	 * @return  Response
	 */
	clone() {
		return new Response(clone(this, this.highWaterMark), {
			type: this.type,
			url: this.url,
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
			ok: this.ok,
			redirected: this.redirected,
			size: this.size,
			highWaterMark: this.highWaterMark
		});
	}

	/**
	 * @param {string} url    The URL that the new response is to originate from.
	 * @param {number} status An optional status code for the response (e.g., 302.)
	 * @returns {Response}    A Response object.
	 */
	static redirect(url, status = 302) {
		if (!isRedirect(status)) {
			throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');
		}

		return new Response(null, {
			headers: {
				location: new URL(url).toString()
			},
			status
		});
	}

	static error() {
		const response = new Response(null, {status: 0, statusText: ''});
		response[INTERNALS$1].type = 'error';
		return response;
	}

	get [Symbol.toStringTag]() {
		return 'Response';
	}
}

Object.defineProperties(Response.prototype, {
	type: {enumerable: true},
	url: {enumerable: true},
	status: {enumerable: true},
	ok: {enumerable: true},
	redirected: {enumerable: true},
	statusText: {enumerable: true},
	headers: {enumerable: true},
	clone: {enumerable: true}
});

const getSearch = parsedURL => {
	if (parsedURL.search) {
		return parsedURL.search;
	}

	const lastOffset = parsedURL.href.length - 1;
	const hash = parsedURL.hash || (parsedURL.href[lastOffset] === '#' ? '#' : '');
	return parsedURL.href[lastOffset - hash.length] === '?' ? '?' : '';
};

/**
 * @external URL
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/URL|URL}
 */

/**
 * @module utils/referrer
 * @private
 */

/**
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#strip-url|Referrer Policy §8.4. Strip url for use as a referrer}
 * @param {string} URL
 * @param {boolean} [originOnly=false]
 */
function stripURLForUseAsAReferrer(url, originOnly = false) {
	// 1. If url is null, return no referrer.
	if (url == null) { // eslint-disable-line no-eq-null, eqeqeq
		return 'no-referrer';
	}

	url = new URL(url);

	// 2. If url's scheme is a local scheme, then return no referrer.
	if (/^(about|blob|data):$/.test(url.protocol)) {
		return 'no-referrer';
	}

	// 3. Set url's username to the empty string.
	url.username = '';

	// 4. Set url's password to null.
	// Note: `null` appears to be a mistake as this actually results in the password being `"null"`.
	url.password = '';

	// 5. Set url's fragment to null.
	// Note: `null` appears to be a mistake as this actually results in the fragment being `"#null"`.
	url.hash = '';

	// 6. If the origin-only flag is true, then:
	if (originOnly) {
		// 6.1. Set url's path to null.
		// Note: `null` appears to be a mistake as this actually results in the path being `"/null"`.
		url.pathname = '';

		// 6.2. Set url's query to null.
		// Note: `null` appears to be a mistake as this actually results in the query being `"?null"`.
		url.search = '';
	}

	// 7. Return url.
	return url;
}

/**
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#enumdef-referrerpolicy|enum ReferrerPolicy}
 */
const ReferrerPolicy = new Set([
	'',
	'no-referrer',
	'no-referrer-when-downgrade',
	'same-origin',
	'origin',
	'strict-origin',
	'origin-when-cross-origin',
	'strict-origin-when-cross-origin',
	'unsafe-url'
]);

/**
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#default-referrer-policy|default referrer policy}
 */
const DEFAULT_REFERRER_POLICY = 'strict-origin-when-cross-origin';

/**
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#referrer-policies|Referrer Policy §3. Referrer Policies}
 * @param {string} referrerPolicy
 * @returns {string} referrerPolicy
 */
function validateReferrerPolicy(referrerPolicy) {
	if (!ReferrerPolicy.has(referrerPolicy)) {
		throw new TypeError(`Invalid referrerPolicy: ${referrerPolicy}`);
	}

	return referrerPolicy;
}

/**
 * @see {@link https://w3c.github.io/webappsec-secure-contexts/#is-origin-trustworthy|Referrer Policy §3.2. Is origin potentially trustworthy?}
 * @param {external:URL} url
 * @returns `true`: "Potentially Trustworthy", `false`: "Not Trustworthy"
 */
function isOriginPotentiallyTrustworthy(url) {
	// 1. If origin is an opaque origin, return "Not Trustworthy".
	// Not applicable

	// 2. Assert: origin is a tuple origin.
	// Not for implementations

	// 3. If origin's scheme is either "https" or "wss", return "Potentially Trustworthy".
	if (/^(http|ws)s:$/.test(url.protocol)) {
		return true;
	}

	// 4. If origin's host component matches one of the CIDR notations 127.0.0.0/8 or ::1/128 [RFC4632], return "Potentially Trustworthy".
	const hostIp = url.host.replace(/(^\[)|(]$)/g, '');
	const hostIPVersion = node_net.isIP(hostIp);

	if (hostIPVersion === 4 && /^127\./.test(hostIp)) {
		return true;
	}

	if (hostIPVersion === 6 && /^(((0+:){7})|(::(0+:){0,6}))0*1$/.test(hostIp)) {
		return true;
	}

	// 5. If origin's host component is "localhost" or falls within ".localhost", and the user agent conforms to the name resolution rules in [let-localhost-be-localhost], return "Potentially Trustworthy".
	// We are returning FALSE here because we cannot ensure conformance to
	// let-localhost-be-loalhost (https://tools.ietf.org/html/draft-west-let-localhost-be-localhost)
	if (/^(.+\.)*localhost$/.test(url.host)) {
		return false;
	}

	// 6. If origin's scheme component is file, return "Potentially Trustworthy".
	if (url.protocol === 'file:') {
		return true;
	}

	// 7. If origin's scheme component is one which the user agent considers to be authenticated, return "Potentially Trustworthy".
	// Not supported

	// 8. If origin has been configured as a trustworthy origin, return "Potentially Trustworthy".
	// Not supported

	// 9. Return "Not Trustworthy".
	return false;
}

/**
 * @see {@link https://w3c.github.io/webappsec-secure-contexts/#is-url-trustworthy|Referrer Policy §3.3. Is url potentially trustworthy?}
 * @param {external:URL} url
 * @returns `true`: "Potentially Trustworthy", `false`: "Not Trustworthy"
 */
function isUrlPotentiallyTrustworthy(url) {
	// 1. If url is "about:blank" or "about:srcdoc", return "Potentially Trustworthy".
	if (/^about:(blank|srcdoc)$/.test(url)) {
		return true;
	}

	// 2. If url's scheme is "data", return "Potentially Trustworthy".
	if (url.protocol === 'data:') {
		return true;
	}

	// Note: The origin of blob: and filesystem: URLs is the origin of the context in which they were
	// created. Therefore, blobs created in a trustworthy origin will themselves be potentially
	// trustworthy.
	if (/^(blob|filesystem):$/.test(url.protocol)) {
		return true;
	}

	// 3. Return the result of executing §3.2 Is origin potentially trustworthy? on url's origin.
	return isOriginPotentiallyTrustworthy(url);
}

/**
 * Modifies the referrerURL to enforce any extra security policy considerations.
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#determine-requests-referrer|Referrer Policy §8.3. Determine request's Referrer}, step 7
 * @callback module:utils/referrer~referrerURLCallback
 * @param {external:URL} referrerURL
 * @returns {external:URL} modified referrerURL
 */

/**
 * Modifies the referrerOrigin to enforce any extra security policy considerations.
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#determine-requests-referrer|Referrer Policy §8.3. Determine request's Referrer}, step 7
 * @callback module:utils/referrer~referrerOriginCallback
 * @param {external:URL} referrerOrigin
 * @returns {external:URL} modified referrerOrigin
 */

/**
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#determine-requests-referrer|Referrer Policy §8.3. Determine request's Referrer}
 * @param {Request} request
 * @param {object} o
 * @param {module:utils/referrer~referrerURLCallback} o.referrerURLCallback
 * @param {module:utils/referrer~referrerOriginCallback} o.referrerOriginCallback
 * @returns {external:URL} Request's referrer
 */
function determineRequestsReferrer(request, {referrerURLCallback, referrerOriginCallback} = {}) {
	// There are 2 notes in the specification about invalid pre-conditions.  We return null, here, for
	// these cases:
	// > Note: If request's referrer is "no-referrer", Fetch will not call into this algorithm.
	// > Note: If request's referrer policy is the empty string, Fetch will not call into this
	// > algorithm.
	if (request.referrer === 'no-referrer' || request.referrerPolicy === '') {
		return null;
	}

	// 1. Let policy be request's associated referrer policy.
	const policy = request.referrerPolicy;

	// 2. Let environment be request's client.
	// not applicable to node.js

	// 3. Switch on request's referrer:
	if (request.referrer === 'about:client') {
		return 'no-referrer';
	}

	// "a URL": Let referrerSource be request's referrer.
	const referrerSource = request.referrer;

	// 4. Let request's referrerURL be the result of stripping referrerSource for use as a referrer.
	let referrerURL = stripURLForUseAsAReferrer(referrerSource);

	// 5. Let referrerOrigin be the result of stripping referrerSource for use as a referrer, with the
	//    origin-only flag set to true.
	let referrerOrigin = stripURLForUseAsAReferrer(referrerSource, true);

	// 6. If the result of serializing referrerURL is a string whose length is greater than 4096, set
	//    referrerURL to referrerOrigin.
	if (referrerURL.toString().length > 4096) {
		referrerURL = referrerOrigin;
	}

	// 7. The user agent MAY alter referrerURL or referrerOrigin at this point to enforce arbitrary
	//    policy considerations in the interests of minimizing data leakage. For example, the user
	//    agent could strip the URL down to an origin, modify its host, replace it with an empty
	//    string, etc.
	if (referrerURLCallback) {
		referrerURL = referrerURLCallback(referrerURL);
	}

	if (referrerOriginCallback) {
		referrerOrigin = referrerOriginCallback(referrerOrigin);
	}

	// 8.Execute the statements corresponding to the value of policy:
	const currentURL = new URL(request.url);

	switch (policy) {
		case 'no-referrer':
			return 'no-referrer';

		case 'origin':
			return referrerOrigin;

		case 'unsafe-url':
			return referrerURL;

		case 'strict-origin':
			// 1. If referrerURL is a potentially trustworthy URL and request's current URL is not a
			//    potentially trustworthy URL, then return no referrer.
			if (isUrlPotentiallyTrustworthy(referrerURL) && !isUrlPotentiallyTrustworthy(currentURL)) {
				return 'no-referrer';
			}

			// 2. Return referrerOrigin.
			return referrerOrigin.toString();

		case 'strict-origin-when-cross-origin':
			// 1. If the origin of referrerURL and the origin of request's current URL are the same, then
			//    return referrerURL.
			if (referrerURL.origin === currentURL.origin) {
				return referrerURL;
			}

			// 2. If referrerURL is a potentially trustworthy URL and request's current URL is not a
			//    potentially trustworthy URL, then return no referrer.
			if (isUrlPotentiallyTrustworthy(referrerURL) && !isUrlPotentiallyTrustworthy(currentURL)) {
				return 'no-referrer';
			}

			// 3. Return referrerOrigin.
			return referrerOrigin;

		case 'same-origin':
			// 1. If the origin of referrerURL and the origin of request's current URL are the same, then
			//    return referrerURL.
			if (referrerURL.origin === currentURL.origin) {
				return referrerURL;
			}

			// 2. Return no referrer.
			return 'no-referrer';

		case 'origin-when-cross-origin':
			// 1. If the origin of referrerURL and the origin of request's current URL are the same, then
			//    return referrerURL.
			if (referrerURL.origin === currentURL.origin) {
				return referrerURL;
			}

			// Return referrerOrigin.
			return referrerOrigin;

		case 'no-referrer-when-downgrade':
			// 1. If referrerURL is a potentially trustworthy URL and request's current URL is not a
			//    potentially trustworthy URL, then return no referrer.
			if (isUrlPotentiallyTrustworthy(referrerURL) && !isUrlPotentiallyTrustworthy(currentURL)) {
				return 'no-referrer';
			}

			// 2. Return referrerURL.
			return referrerURL;

		default:
			throw new TypeError(`Invalid referrerPolicy: ${policy}`);
	}
}

/**
 * @see {@link https://w3c.github.io/webappsec-referrer-policy/#parse-referrer-policy-from-header|Referrer Policy §8.1. Parse a referrer policy from a Referrer-Policy header}
 * @param {Headers} headers Response headers
 * @returns {string} policy
 */
function parseReferrerPolicyFromHeader(headers) {
	// 1. Let policy-tokens be the result of extracting header list values given `Referrer-Policy`
	//    and response’s header list.
	const policyTokens = (headers.get('referrer-policy') || '').split(/[,\s]+/);

	// 2. Let policy be the empty string.
	let policy = '';

	// 3. For each token in policy-tokens, if token is a referrer policy and token is not the empty
	//    string, then set policy to token.
	// Note: This algorithm loops over multiple policy values to allow deployment of new policy
	// values with fallbacks for older user agents, as described in § 11.1 Unknown Policy Values.
	for (const token of policyTokens) {
		if (token && ReferrerPolicy.has(token)) {
			policy = token;
		}
	}

	// 4. Return policy.
	return policy;
}

/**
 * Request.js
 *
 * Request class contains server only options
 *
 * All spec algorithm step numbers are based on https://fetch.spec.whatwg.org/commit-snapshots/ae716822cb3a61843226cd090eefc6589446c1d2/.
 */

const INTERNALS = Symbol('Request internals');

/**
 * Check if `obj` is an instance of Request.
 *
 * @param  {*} object
 * @return {boolean}
 */
const isRequest = object => {
	return (
		typeof object === 'object' &&
		typeof object[INTERNALS] === 'object'
	);
};

const doBadDataWarn = node_util.deprecate(() => {},
	'.data is not a valid RequestInit property, use .body instead',
	'https://github.com/node-fetch/node-fetch/issues/1000 (request)');

/**
 * Request class
 *
 * Ref: https://fetch.spec.whatwg.org/#request-class
 *
 * @param   Mixed   input  Url or Request instance
 * @param   Object  init   Custom options
 * @return  Void
 */
class Request extends Body {
	constructor(input, init = {}) {
		let parsedURL;

		// Normalize input and force URL to be encoded as UTF-8 (https://github.com/node-fetch/node-fetch/issues/245)
		if (isRequest(input)) {
			parsedURL = new URL(input.url);
		} else {
			parsedURL = new URL(input);
			input = {};
		}

		if (parsedURL.username !== '' || parsedURL.password !== '') {
			throw new TypeError(`${parsedURL} is an url with embedded credentials.`);
		}

		let method = init.method || input.method || 'GET';
		method = method.toUpperCase();

		if ('data' in init) {
			doBadDataWarn();
		}

		// eslint-disable-next-line no-eq-null, eqeqeq
		if ((init.body != null || (isRequest(input) && input.body !== null)) &&
			(method === 'GET' || method === 'HEAD')) {
			throw new TypeError('Request with GET/HEAD method cannot have body');
		}

		const inputBody = init.body ?
			init.body :
			(isRequest(input) && input.body !== null ?
				clone(input) :
				null);

		super(inputBody, {
			size: init.size || input.size || 0
		});

		const headers = new Headers(init.headers || input.headers || {});

		if (inputBody !== null && !headers.has('Content-Type')) {
			const contentType = extractContentType(inputBody, this);
			if (contentType) {
				headers.set('Content-Type', contentType);
			}
		}

		let signal = isRequest(input) ?
			input.signal :
			null;
		if ('signal' in init) {
			signal = init.signal;
		}

		// eslint-disable-next-line no-eq-null, eqeqeq
		if (signal != null && !isAbortSignal(signal)) {
			throw new TypeError('Expected signal to be an instanceof AbortSignal or EventTarget');
		}

		// §5.4, Request constructor steps, step 15.1
		// eslint-disable-next-line no-eq-null, eqeqeq
		let referrer = init.referrer == null ? input.referrer : init.referrer;
		if (referrer === '') {
			// §5.4, Request constructor steps, step 15.2
			referrer = 'no-referrer';
		} else if (referrer) {
			// §5.4, Request constructor steps, step 15.3.1, 15.3.2
			const parsedReferrer = new URL(referrer);
			// §5.4, Request constructor steps, step 15.3.3, 15.3.4
			referrer = /^about:(\/\/)?client$/.test(parsedReferrer) ? 'client' : parsedReferrer;
		} else {
			referrer = undefined;
		}

		this[INTERNALS] = {
			method,
			redirect: init.redirect || input.redirect || 'follow',
			headers,
			parsedURL,
			signal,
			referrer
		};

		// Node-fetch-only options
		this.follow = init.follow === undefined ? (input.follow === undefined ? 20 : input.follow) : init.follow;
		this.compress = init.compress === undefined ? (input.compress === undefined ? true : input.compress) : init.compress;
		this.counter = init.counter || input.counter || 0;
		this.agent = init.agent || input.agent;
		this.highWaterMark = init.highWaterMark || input.highWaterMark || 16384;
		this.insecureHTTPParser = init.insecureHTTPParser || input.insecureHTTPParser || false;

		// §5.4, Request constructor steps, step 16.
		// Default is empty string per https://fetch.spec.whatwg.org/#concept-request-referrer-policy
		this.referrerPolicy = init.referrerPolicy || input.referrerPolicy || '';
	}

	/** @returns {string} */
	get method() {
		return this[INTERNALS].method;
	}

	/** @returns {string} */
	get url() {
		return node_url.format(this[INTERNALS].parsedURL);
	}

	/** @returns {Headers} */
	get headers() {
		return this[INTERNALS].headers;
	}

	get redirect() {
		return this[INTERNALS].redirect;
	}

	/** @returns {AbortSignal} */
	get signal() {
		return this[INTERNALS].signal;
	}

	// https://fetch.spec.whatwg.org/#dom-request-referrer
	get referrer() {
		if (this[INTERNALS].referrer === 'no-referrer') {
			return '';
		}

		if (this[INTERNALS].referrer === 'client') {
			return 'about:client';
		}

		if (this[INTERNALS].referrer) {
			return this[INTERNALS].referrer.toString();
		}

		return undefined;
	}

	get referrerPolicy() {
		return this[INTERNALS].referrerPolicy;
	}

	set referrerPolicy(referrerPolicy) {
		this[INTERNALS].referrerPolicy = validateReferrerPolicy(referrerPolicy);
	}

	/**
	 * Clone this request
	 *
	 * @return  Request
	 */
	clone() {
		return new Request(this);
	}

	get [Symbol.toStringTag]() {
		return 'Request';
	}
}

Object.defineProperties(Request.prototype, {
	method: {enumerable: true},
	url: {enumerable: true},
	headers: {enumerable: true},
	redirect: {enumerable: true},
	clone: {enumerable: true},
	signal: {enumerable: true},
	referrer: {enumerable: true},
	referrerPolicy: {enumerable: true}
});

/**
 * Convert a Request to Node.js http request options.
 *
 * @param {Request} request - A Request instance
 * @return The options object to be passed to http.request
 */
const getNodeRequestOptions = request => {
	const {parsedURL} = request[INTERNALS];
	const headers = new Headers(request[INTERNALS].headers);

	// Fetch step 1.3
	if (!headers.has('Accept')) {
		headers.set('Accept', '*/*');
	}

	// HTTP-network-or-cache fetch steps 2.4-2.7
	let contentLengthValue = null;
	if (request.body === null && /^(post|put)$/i.test(request.method)) {
		contentLengthValue = '0';
	}

	if (request.body !== null) {
		const totalBytes = getTotalBytes(request);
		// Set Content-Length if totalBytes is a number (that is not NaN)
		if (typeof totalBytes === 'number' && !Number.isNaN(totalBytes)) {
			contentLengthValue = String(totalBytes);
		}
	}

	if (contentLengthValue) {
		headers.set('Content-Length', contentLengthValue);
	}

	// 4.1. Main fetch, step 2.6
	// > If request's referrer policy is the empty string, then set request's referrer policy to the
	// > default referrer policy.
	if (request.referrerPolicy === '') {
		request.referrerPolicy = DEFAULT_REFERRER_POLICY;
	}

	// 4.1. Main fetch, step 2.7
	// > If request's referrer is not "no-referrer", set request's referrer to the result of invoking
	// > determine request's referrer.
	if (request.referrer && request.referrer !== 'no-referrer') {
		request[INTERNALS].referrer = determineRequestsReferrer(request);
	} else {
		request[INTERNALS].referrer = 'no-referrer';
	}

	// 4.5. HTTP-network-or-cache fetch, step 6.9
	// > If httpRequest's referrer is a URL, then append `Referer`/httpRequest's referrer, serialized
	// >  and isomorphic encoded, to httpRequest's header list.
	if (request[INTERNALS].referrer instanceof URL) {
		headers.set('Referer', request.referrer);
	}

	// HTTP-network-or-cache fetch step 2.11
	if (!headers.has('User-Agent')) {
		headers.set('User-Agent', 'node-fetch');
	}

	// HTTP-network-or-cache fetch step 2.15
	if (request.compress && !headers.has('Accept-Encoding')) {
		headers.set('Accept-Encoding', 'gzip,deflate,br');
	}

	let {agent} = request;
	if (typeof agent === 'function') {
		agent = agent(parsedURL);
	}

	if (!headers.has('Connection') && !agent) {
		headers.set('Connection', 'close');
	}

	// HTTP-network fetch step 4.2
	// chunked encoding is handled by Node.js

	const search = getSearch(parsedURL);

	// Pass the full URL directly to request(), but overwrite the following
	// options:
	const options = {
		// Overwrite search to retain trailing ? (issue #776)
		path: parsedURL.pathname + search,
		// The following options are not expressed in the URL
		method: request.method,
		headers: headers[Symbol.for('nodejs.util.inspect.custom')](),
		insecureHTTPParser: request.insecureHTTPParser,
		agent
	};

	return {
		/** @type {URL} */
		parsedURL,
		options
	};
};

/**
 * AbortError interface for cancelled requests
 */
class AbortError extends FetchBaseError {
	constructor(message, type = 'aborted') {
		super(message, type);
	}
}

/**
 * Index.js
 *
 * a request API compatible with window.fetch
 *
 * All spec algorithm step numbers are based on https://fetch.spec.whatwg.org/commit-snapshots/ae716822cb3a61843226cd090eefc6589446c1d2/.
 */

const supportedSchemas = new Set(['data:', 'http:', 'https:']);

/**
 * Fetch function
 *
 * @param   {string | URL | import('./request').default} url - Absolute url or Request instance
 * @param   {*} [options_] - Fetch options
 * @return  {Promise<import('./response').default>}
 */
async function fetch(url, options_) {
	return new Promise((resolve, reject) => {
		// Build request object
		const request = new Request(url, options_);
		const {parsedURL, options} = getNodeRequestOptions(request);
		if (!supportedSchemas.has(parsedURL.protocol)) {
			throw new TypeError(`node-fetch cannot load ${url}. URL scheme "${parsedURL.protocol.replace(/:$/, '')}" is not supported.`);
		}

		if (parsedURL.protocol === 'data:') {
			const data = dataUriToBuffer(request.url);
			const response = new Response(data, {headers: {'Content-Type': data.typeFull}});
			resolve(response);
			return;
		}

		// Wrap http.request into fetch
		const send = (parsedURL.protocol === 'https:' ? https__default["default"] : http__default["default"]).request;
		const {signal} = request;
		let response = null;

		const abort = () => {
			const error = new AbortError('The operation was aborted.');
			reject(error);
			if (request.body && request.body instanceof Stream__default["default"].Readable) {
				request.body.destroy(error);
			}

			if (!response || !response.body) {
				return;
			}

			response.body.emit('error', error);
		};

		if (signal && signal.aborted) {
			abort();
			return;
		}

		const abortAndFinalize = () => {
			abort();
			finalize();
		};

		// Send request
		const request_ = send(parsedURL.toString(), options);

		if (signal) {
			signal.addEventListener('abort', abortAndFinalize);
		}

		const finalize = () => {
			request_.abort();
			if (signal) {
				signal.removeEventListener('abort', abortAndFinalize);
			}
		};

		request_.on('error', error => {
			reject(new FetchError(`request to ${request.url} failed, reason: ${error.message}`, 'system', error));
			finalize();
		});

		fixResponseChunkedTransferBadEnding(request_, error => {
			response.body.destroy(error);
		});

		/* c8 ignore next 18 */
		if (process.version < 'v14') {
			// Before Node.js 14, pipeline() does not fully support async iterators and does not always
			// properly handle when the socket close/end events are out of order.
			request_.on('socket', s => {
				let endedWithEventsCount;
				s.prependListener('end', () => {
					endedWithEventsCount = s._eventsCount;
				});
				s.prependListener('close', hadError => {
					// if end happened before close but the socket didn't emit an error, do it now
					if (response && endedWithEventsCount < s._eventsCount && !hadError) {
						const error = new Error('Premature close');
						error.code = 'ERR_STREAM_PREMATURE_CLOSE';
						response.body.emit('error', error);
					}
				});
			});
		}

		request_.on('response', response_ => {
			request_.setTimeout(0);
			const headers = fromRawHeaders(response_.rawHeaders);

			// HTTP fetch step 5
			if (isRedirect(response_.statusCode)) {
				// HTTP fetch step 5.2
				const location = headers.get('Location');

				// HTTP fetch step 5.3
				let locationURL = null;
				try {
					locationURL = location === null ? null : new URL(location, request.url);
				} catch {
					// error here can only be invalid URL in Location: header
					// do not throw when options.redirect == manual
					// let the user extract the errorneous redirect URL
					if (request.redirect !== 'manual') {
						reject(new FetchError(`uri requested responds with an invalid redirect URL: ${location}`, 'invalid-redirect'));
						finalize();
						return;
					}
				}

				// HTTP fetch step 5.5
				switch (request.redirect) {
					case 'error':
						reject(new FetchError(`uri requested responds with a redirect, redirect mode is set to error: ${request.url}`, 'no-redirect'));
						finalize();
						return;
					case 'manual':
						// Nothing to do
						break;
					case 'follow': {
						// HTTP-redirect fetch step 2
						if (locationURL === null) {
							break;
						}

						// HTTP-redirect fetch step 5
						if (request.counter >= request.follow) {
							reject(new FetchError(`maximum redirect reached at: ${request.url}`, 'max-redirect'));
							finalize();
							return;
						}

						// HTTP-redirect fetch step 6 (counter increment)
						// Create a new Request object.
						const requestOptions = {
							headers: new Headers(request.headers),
							follow: request.follow,
							counter: request.counter + 1,
							agent: request.agent,
							compress: request.compress,
							method: request.method,
							body: clone(request),
							signal: request.signal,
							size: request.size,
							referrer: request.referrer,
							referrerPolicy: request.referrerPolicy
						};

						// when forwarding sensitive headers like "Authorization",
						// "WWW-Authenticate", and "Cookie" to untrusted targets,
						// headers will be ignored when following a redirect to a domain
						// that is not a subdomain match or exact match of the initial domain.
						// For example, a redirect from "foo.com" to either "foo.com" or "sub.foo.com"
						// will forward the sensitive headers, but a redirect to "bar.com" will not.
						if (!isDomainOrSubdomain(request.url, locationURL)) {
							for (const name of ['authorization', 'www-authenticate', 'cookie', 'cookie2']) {
								requestOptions.headers.delete(name);
							}
						}

						// HTTP-redirect fetch step 9
						if (response_.statusCode !== 303 && request.body && options_.body instanceof Stream__default["default"].Readable) {
							reject(new FetchError('Cannot follow redirect with body being a readable stream', 'unsupported-redirect'));
							finalize();
							return;
						}

						// HTTP-redirect fetch step 11
						if (response_.statusCode === 303 || ((response_.statusCode === 301 || response_.statusCode === 302) && request.method === 'POST')) {
							requestOptions.method = 'GET';
							requestOptions.body = undefined;
							requestOptions.headers.delete('content-length');
						}

						// HTTP-redirect fetch step 14
						const responseReferrerPolicy = parseReferrerPolicyFromHeader(headers);
						if (responseReferrerPolicy) {
							requestOptions.referrerPolicy = responseReferrerPolicy;
						}

						// HTTP-redirect fetch step 15
						resolve(fetch(new Request(locationURL, requestOptions)));
						finalize();
						return;
					}

					default:
						return reject(new TypeError(`Redirect option '${request.redirect}' is not a valid value of RequestRedirect`));
				}
			}

			// Prepare response
			if (signal) {
				response_.once('end', () => {
					signal.removeEventListener('abort', abortAndFinalize);
				});
			}

			let body = Stream.pipeline(response_, new Stream.PassThrough(), error => {
				if (error) {
					reject(error);
				}
			});
			// see https://github.com/nodejs/node/pull/29376
			/* c8 ignore next 3 */
			if (process.version < 'v12.10') {
				response_.on('aborted', abortAndFinalize);
			}

			const responseOptions = {
				url: request.url,
				status: response_.statusCode,
				statusText: response_.statusMessage,
				headers,
				size: request.size,
				counter: request.counter,
				highWaterMark: request.highWaterMark
			};

			// HTTP-network fetch step 12.1.1.3
			const codings = headers.get('Content-Encoding');

			// HTTP-network fetch step 12.1.1.4: handle content codings

			// in following scenarios we ignore compression support
			// 1. compression support is disabled
			// 2. HEAD request
			// 3. no Content-Encoding header
			// 4. no content response (204)
			// 5. content not modified response (304)
			if (!request.compress || request.method === 'HEAD' || codings === null || response_.statusCode === 204 || response_.statusCode === 304) {
				response = new Response(body, responseOptions);
				resolve(response);
				return;
			}

			// For Node v6+
			// Be less strict when decoding compressed responses, since sometimes
			// servers send slightly invalid responses that are still accepted
			// by common browsers.
			// Always using Z_SYNC_FLUSH is what cURL does.
			const zlibOptions = {
				flush: zlib__default["default"].Z_SYNC_FLUSH,
				finishFlush: zlib__default["default"].Z_SYNC_FLUSH
			};

			// For gzip
			if (codings === 'gzip' || codings === 'x-gzip') {
				body = Stream.pipeline(body, zlib__default["default"].createGunzip(zlibOptions), error => {
					if (error) {
						reject(error);
					}
				});
				response = new Response(body, responseOptions);
				resolve(response);
				return;
			}

			// For deflate
			if (codings === 'deflate' || codings === 'x-deflate') {
				// Handle the infamous raw deflate response from old servers
				// a hack for old IIS and Apache servers
				const raw = Stream.pipeline(response_, new Stream.PassThrough(), error => {
					if (error) {
						reject(error);
					}
				});
				raw.once('data', chunk => {
					// See http://stackoverflow.com/questions/37519828
					if ((chunk[0] & 0x0F) === 0x08) {
						body = Stream.pipeline(body, zlib__default["default"].createInflate(), error => {
							if (error) {
								reject(error);
							}
						});
					} else {
						body = Stream.pipeline(body, zlib__default["default"].createInflateRaw(), error => {
							if (error) {
								reject(error);
							}
						});
					}

					response = new Response(body, responseOptions);
					resolve(response);
				});
				raw.once('end', () => {
					// Some old IIS servers return zero-length OK deflate responses, so
					// 'data' is never emitted. See https://github.com/node-fetch/node-fetch/pull/903
					if (!response) {
						response = new Response(body, responseOptions);
						resolve(response);
					}
				});
				return;
			}

			// For br
			if (codings === 'br') {
				body = Stream.pipeline(body, zlib__default["default"].createBrotliDecompress(), error => {
					if (error) {
						reject(error);
					}
				});
				response = new Response(body, responseOptions);
				resolve(response);
				return;
			}

			// Otherwise, use response as-is
			response = new Response(body, responseOptions);
			resolve(response);
		});

		// eslint-disable-next-line promise/prefer-await-to-then
		writeToStream(request_, request).catch(reject);
	});
}

function fixResponseChunkedTransferBadEnding(request, errorCallback) {
	const LAST_CHUNK = node_buffer.Buffer.from('0\r\n\r\n');

	let isChunkedTransfer = false;
	let properLastChunkReceived = false;
	let previousChunk;

	request.on('response', response => {
		const {headers} = response;
		isChunkedTransfer = headers['transfer-encoding'] === 'chunked' && !headers['content-length'];
	});

	request.on('socket', socket => {
		const onSocketClose = () => {
			if (isChunkedTransfer && !properLastChunkReceived) {
				const error = new Error('Premature close');
				error.code = 'ERR_STREAM_PREMATURE_CLOSE';
				errorCallback(error);
			}
		};

		socket.prependListener('close', onSocketClose);

		request.on('abort', () => {
			socket.removeListener('close', onSocketClose);
		});

		socket.on('data', buf => {
			properLastChunkReceived = node_buffer.Buffer.compare(buf.slice(-5), LAST_CHUNK) === 0;

			// Sometimes final 0-length chunk and end of message code are in separate packets
			if (!properLastChunkReceived && previousChunk) {
				properLastChunkReceived = (
					node_buffer.Buffer.compare(previousChunk.slice(-3), LAST_CHUNK.slice(0, 3)) === 0 &&
					node_buffer.Buffer.compare(buf.slice(-2), LAST_CHUNK.slice(3)) === 0
				);
			}

			previousChunk = buf;
		});
	});
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

function load(path){
	return parse$1(fs__default["default"].readFileSync(path, 'utf-8'))
}

function parse$1(str, raw){
	let config = toml__default["default"].parse(str);

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

  if (exponent > Decimal__default["default"].maxE || exponent < Decimal__default["default"].minE) {
    exponent = NaN;
    digits = null;
  }

  return Object.create(Decimal__default["default"].prototype, {
    constructor: { value: Decimal__default["default"] },
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
			value: Decimal__default["default"].sub(previousTakerPays.value, finalTakerPays.value)
		};

		let takerGot = {
			...finalTakerGets, 
			value: Decimal__default["default"].sub(previousTakerGets.value, finalTakerGets.value)
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
			price: Decimal__default["default"].div(takerGot.value, takerPaid.value),
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


function fromLedgerAmount(amount, convertCurrencyCode){
	if(typeof amount === 'string')
		return {
			currency: 'XRP',
			value: Decimal__default["default"].div(amount, '1000000')
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
		this.fileName = path__default["default"].basename(config.file);
		this.open();
	}

	open(){
		let config = this.config;

		this.con = new Adapter__default["default"](config.file, {readonly: config.readonly || false});
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

		fs__default["default"].unlinkSync(this.file);

		if(fs__default["default"].existsSync(`${this.file}-wal`))
			fs__default["default"].unlinkSync(`${this.file}-wal`);

		if(fs__default["default"].existsSync(`${this.file}-shm`))
			fs__default["default"].unlinkSync(`${this.file}-shm`);

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
				let stat = fs__default["default"].statSync(`${this.file}-wal`);

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
				? codec__default["default"].decodeAccountID(address)
				: address
		);
	}

	if(!row)
		return null

	return {
		...row,
		address: codec__default["default"].encodeAccountID(row.address)
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
				? codec__default["default"].decodeAccountID(address)
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
			"holders"		INTEGER NOT NULL,
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
			let maker = codec__default["default"].decodeAccountID(exchange.maker);
			let taker = codec__default["default"].decodeAccountID(exchange.taker);
			let base = this.tokens.id(exchange.base);
			let quote = this.tokens.id(exchange.quote);
			let price = serialize(new Decimal__default["default"](exchange.price));
			let volume = serialize(new Decimal__default["default"](exchange.volume));

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
			volume: Decimal__default["default"].mul(exchange.volume, exchange.price)
		}
	}else if(exchange.base === quote){
		return {
			id: exchange.id,
			ledger: exchange.ledger,
			date: exchange.date,
			price: Decimal__default["default"].div('1', exchange.price),
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
		price: Decimal__default["default"].div('1', exchange.price),
		volume: Decimal__default["default"].mul(exchange.volume, exchange.price)
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

class Pool extends EventEmitter__default["default"]{
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
				let client = new xrpl__default["default"].Client(spec.url, {timeout: 60000});

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

class Client extends EventEmitter__default["default"]{
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
			? new limiter.RateLimiter({
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
			let query = new URLSearchParams$1(data).toString();

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


function URLSearchParams$1(query) {
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
	URLSearchParamsProto = URLSearchParams$1.prototype,
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
		if(fs__default["default"].existsSync(file))
			fs__default["default"].unlinkSync(file);

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
								balance: new Decimal__default["default"](state.Balance)
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
								gets = new Decimal__default["default"](state.TakerGets)
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
								pays = new Decimal__default["default"](state.TakerPays)
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
			let liquidity = new Decimal__default["default"](0);

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
					({balance}) => new Decimal__default["default"](balance),
					decimalCompare.DESC
				);

				let count = lines.length;
				let holders = nonZeroBalances.length;
				let bid = new Decimal__default["default"](0);
				let ask = new Decimal__default["default"](0);
				let supply = nonZeroBalances
					.reduce((sum, {balance}) => sum.plus(balance), new Decimal__default["default"](0));

				
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
									let amount = Decimal__default["default"].min(offer.pays, xrpBalance.balance);

									bid = bid.plus(amount);
									liquidity = liquidity.plus(amount);
								}else if(offer.base === null){
									let amount = Decimal__default["default"].min(offer.gets, xrpBalance.balance);

									liquidity = liquidity.plus(amount);
								}
							}

							if(offer.quote === token.id){
								ask = ask.plus(Decimal__default["default"].min(offer.pays, balance));
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
						let wealth = group.reduce((sum, {balance}) => sum.plus(balance), new Decimal__default["default"](0));
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

const args = minimist__default["default"](process.argv.slice(2));
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

			let subprocess = child_process.fork(
				__filename, 
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

let s = 0;
const S = {
	START_BOUNDARY: s++,
	HEADER_FIELD_START: s++,
	HEADER_FIELD: s++,
	HEADER_VALUE_START: s++,
	HEADER_VALUE: s++,
	HEADER_VALUE_ALMOST_DONE: s++,
	HEADERS_ALMOST_DONE: s++,
	PART_DATA_START: s++,
	PART_DATA: s++,
	END: s++
};

let f = 1;
const F = {
	PART_BOUNDARY: f,
	LAST_BOUNDARY: f *= 2
};

const LF = 10;
const CR = 13;
const SPACE = 32;
const HYPHEN = 45;
const COLON = 58;
const A = 97;
const Z = 122;

const lower = c => c | 0x20;

const noop = () => {};

class MultipartParser {
	/**
	 * @param {string} boundary
	 */
	constructor(boundary) {
		this.index = 0;
		this.flags = 0;

		this.onHeaderEnd = noop;
		this.onHeaderField = noop;
		this.onHeadersEnd = noop;
		this.onHeaderValue = noop;
		this.onPartBegin = noop;
		this.onPartData = noop;
		this.onPartEnd = noop;

		this.boundaryChars = {};

		boundary = '\r\n--' + boundary;
		const ui8a = new Uint8Array(boundary.length);
		for (let i = 0; i < boundary.length; i++) {
			ui8a[i] = boundary.charCodeAt(i);
			this.boundaryChars[ui8a[i]] = true;
		}

		this.boundary = ui8a;
		this.lookbehind = new Uint8Array(this.boundary.length + 8);
		this.state = S.START_BOUNDARY;
	}

	/**
	 * @param {Uint8Array} data
	 */
	write(data) {
		let i = 0;
		const length_ = data.length;
		let previousIndex = this.index;
		let {lookbehind, boundary, boundaryChars, index, state, flags} = this;
		const boundaryLength = this.boundary.length;
		const boundaryEnd = boundaryLength - 1;
		const bufferLength = data.length;
		let c;
		let cl;

		const mark = name => {
			this[name + 'Mark'] = i;
		};

		const clear = name => {
			delete this[name + 'Mark'];
		};

		const callback = (callbackSymbol, start, end, ui8a) => {
			if (start === undefined || start !== end) {
				this[callbackSymbol](ui8a && ui8a.subarray(start, end));
			}
		};

		const dataCallback = (name, clear) => {
			const markSymbol = name + 'Mark';
			if (!(markSymbol in this)) {
				return;
			}

			if (clear) {
				callback(name, this[markSymbol], i, data);
				delete this[markSymbol];
			} else {
				callback(name, this[markSymbol], data.length, data);
				this[markSymbol] = 0;
			}
		};

		for (i = 0; i < length_; i++) {
			c = data[i];

			switch (state) {
				case S.START_BOUNDARY:
					if (index === boundary.length - 2) {
						if (c === HYPHEN) {
							flags |= F.LAST_BOUNDARY;
						} else if (c !== CR) {
							return;
						}

						index++;
						break;
					} else if (index - 1 === boundary.length - 2) {
						if (flags & F.LAST_BOUNDARY && c === HYPHEN) {
							state = S.END;
							flags = 0;
						} else if (!(flags & F.LAST_BOUNDARY) && c === LF) {
							index = 0;
							callback('onPartBegin');
							state = S.HEADER_FIELD_START;
						} else {
							return;
						}

						break;
					}

					if (c !== boundary[index + 2]) {
						index = -2;
					}

					if (c === boundary[index + 2]) {
						index++;
					}

					break;
				case S.HEADER_FIELD_START:
					state = S.HEADER_FIELD;
					mark('onHeaderField');
					index = 0;
					// falls through
				case S.HEADER_FIELD:
					if (c === CR) {
						clear('onHeaderField');
						state = S.HEADERS_ALMOST_DONE;
						break;
					}

					index++;
					if (c === HYPHEN) {
						break;
					}

					if (c === COLON) {
						if (index === 1) {
							// empty header field
							return;
						}

						dataCallback('onHeaderField', true);
						state = S.HEADER_VALUE_START;
						break;
					}

					cl = lower(c);
					if (cl < A || cl > Z) {
						return;
					}

					break;
				case S.HEADER_VALUE_START:
					if (c === SPACE) {
						break;
					}

					mark('onHeaderValue');
					state = S.HEADER_VALUE;
					// falls through
				case S.HEADER_VALUE:
					if (c === CR) {
						dataCallback('onHeaderValue', true);
						callback('onHeaderEnd');
						state = S.HEADER_VALUE_ALMOST_DONE;
					}

					break;
				case S.HEADER_VALUE_ALMOST_DONE:
					if (c !== LF) {
						return;
					}

					state = S.HEADER_FIELD_START;
					break;
				case S.HEADERS_ALMOST_DONE:
					if (c !== LF) {
						return;
					}

					callback('onHeadersEnd');
					state = S.PART_DATA_START;
					break;
				case S.PART_DATA_START:
					state = S.PART_DATA;
					mark('onPartData');
					// falls through
				case S.PART_DATA:
					previousIndex = index;

					if (index === 0) {
						// boyer-moore derrived algorithm to safely skip non-boundary data
						i += boundaryEnd;
						while (i < bufferLength && !(data[i] in boundaryChars)) {
							i += boundaryLength;
						}

						i -= boundaryEnd;
						c = data[i];
					}

					if (index < boundary.length) {
						if (boundary[index] === c) {
							if (index === 0) {
								dataCallback('onPartData', true);
							}

							index++;
						} else {
							index = 0;
						}
					} else if (index === boundary.length) {
						index++;
						if (c === CR) {
							// CR = part boundary
							flags |= F.PART_BOUNDARY;
						} else if (c === HYPHEN) {
							// HYPHEN = end boundary
							flags |= F.LAST_BOUNDARY;
						} else {
							index = 0;
						}
					} else if (index - 1 === boundary.length) {
						if (flags & F.PART_BOUNDARY) {
							index = 0;
							if (c === LF) {
								// unset the PART_BOUNDARY flag
								flags &= ~F.PART_BOUNDARY;
								callback('onPartEnd');
								callback('onPartBegin');
								state = S.HEADER_FIELD_START;
								break;
							}
						} else if (flags & F.LAST_BOUNDARY) {
							if (c === HYPHEN) {
								callback('onPartEnd');
								state = S.END;
								flags = 0;
							} else {
								index = 0;
							}
						} else {
							index = 0;
						}
					}

					if (index > 0) {
						// when matching a possible boundary, keep a lookbehind reference
						// in case it turns out to be a false lead
						lookbehind[index - 1] = c;
					} else if (previousIndex > 0) {
						// if our boundary turned out to be rubbish, the captured lookbehind
						// belongs to partData
						const _lookbehind = new Uint8Array(lookbehind.buffer, lookbehind.byteOffset, lookbehind.byteLength);
						callback('onPartData', 0, previousIndex, _lookbehind);
						previousIndex = 0;
						mark('onPartData');

						// reconsider the current character even so it interrupted the sequence
						// it could be the beginning of a new sequence
						i--;
					}

					break;
				case S.END:
					break;
				default:
					throw new Error(`Unexpected state entered: ${state}`);
			}
		}

		dataCallback('onHeaderField');
		dataCallback('onHeaderValue');
		dataCallback('onPartData');

		// Update properties for the next call
		this.index = index;
		this.state = state;
		this.flags = flags;
	}

	end() {
		if ((this.state === S.HEADER_FIELD_START && this.index === 0) ||
			(this.state === S.PART_DATA && this.index === this.boundary.length)) {
			this.onPartEnd();
		} else if (this.state !== S.END) {
			throw new Error('MultipartParser.end(): stream ended unexpectedly');
		}
	}
}

function _fileName(headerValue) {
	// matches either a quoted-string or a token (RFC 2616 section 19.5.1)
	const m = headerValue.match(/\bfilename=("(.*?)"|([^()<>@,;:\\"/[\]?={}\s\t]+))($|;\s)/i);
	if (!m) {
		return;
	}

	const match = m[2] || m[3] || '';
	let filename = match.slice(match.lastIndexOf('\\') + 1);
	filename = filename.replace(/%22/g, '"');
	filename = filename.replace(/&#(\d{4});/g, (m, code) => {
		return String.fromCharCode(code);
	});
	return filename;
}

async function toFormData(Body, ct) {
	if (!/multipart/i.test(ct)) {
		throw new TypeError('Failed to fetch');
	}

	const m = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

	if (!m) {
		throw new TypeError('no or bad content-type header, no multipart boundary');
	}

	const parser = new MultipartParser(m[1] || m[2]);

	let headerField;
	let headerValue;
	let entryValue;
	let entryName;
	let contentType;
	let filename;
	const entryChunks = [];
	const formData = new FormData();

	const onPartData = ui8a => {
		entryValue += decoder.decode(ui8a, {stream: true});
	};

	const appendToFile = ui8a => {
		entryChunks.push(ui8a);
	};

	const appendFileToFormData = () => {
		const file = new File(entryChunks, filename, {type: contentType});
		formData.append(entryName, file);
	};

	const appendEntryToFormData = () => {
		formData.append(entryName, entryValue);
	};

	const decoder = new TextDecoder('utf-8');
	decoder.decode();

	parser.onPartBegin = function () {
		parser.onPartData = onPartData;
		parser.onPartEnd = appendEntryToFormData;

		headerField = '';
		headerValue = '';
		entryValue = '';
		entryName = '';
		contentType = '';
		filename = null;
		entryChunks.length = 0;
	};

	parser.onHeaderField = function (ui8a) {
		headerField += decoder.decode(ui8a, {stream: true});
	};

	parser.onHeaderValue = function (ui8a) {
		headerValue += decoder.decode(ui8a, {stream: true});
	};

	parser.onHeaderEnd = function () {
		headerValue += decoder.decode();
		headerField = headerField.toLowerCase();

		if (headerField === 'content-disposition') {
			// matches either a quoted-string or a token (RFC 2616 section 19.5.1)
			const m = headerValue.match(/\bname=("([^"]*)"|([^()<>@,;:\\"/[\]?={}\s\t]+))/i);

			if (m) {
				entryName = m[2] || m[3] || '';
			}

			filename = _fileName(headerValue);

			if (filename) {
				parser.onPartData = appendToFile;
				parser.onPartEnd = appendFileToFormData;
			}
		} else if (headerField === 'content-type') {
			contentType = headerValue;
		}

		headerValue = '';
		headerField = '';
	};

	for await (const chunk of Body) {
		parser.write(chunk);
	}

	parser.end();

	return formData;
}

var multipartParser = /*#__PURE__*/Object.freeze({
    __proto__: null,
    toFormData: toFormData
});
