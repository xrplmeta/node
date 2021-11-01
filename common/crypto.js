export async function encrypt(str, password){
	let encoder = new TextEncoder()
	let key = await deriveKey(password)
	let encrypted = await crypto.subtle.encrypt(
		{
			name: 'AES-CTR',
			length: 64,
			counter: new Uint8Array(16)
		},
		key,
		encoder.encode(str)
	)

	return buffer2hex(encrypted)
}

export async function decrypt(hex, password){
	let decoder = new TextDecoder()
	let key = await deriveKey(password)
	let decrypted = await crypto.subtle.decrypt(
		{
			name: 'AES-CTR',
			length: 64,
			counter: new Uint8Array(16)
		},
		key,
		hex2buffer(hex)
	)

	return decoder.decode(decrypted)
}


async function deriveKey(password){
	let encoder = new TextEncoder()
	let material = await crypto.subtle.importKey(
		'raw', 
		encoder.encode(password), 
		'PBKDF2', 
		false, 
		['deriveKey']
	)
	
	return await crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: encoder.encode('no-salt'),
			iterations: 1,
			hash: 'SHA-256'
		},
		material,
		{
			name: 'AES-CTR', 
			length: 256
		},
		true,
		[
			'encrypt',
			'decrypt'
		]
	)
}


function buffer2hex(buffer) {
	return [...new Uint8Array(buffer)]
		.map(x => x.toString(16).padStart(2, '0'))
		.join('')
		.toUpperCase()
}

function hex2buffer(hex){
	return new Uint8Array(hex.match(/[\da-f]{2}/gi).map((h) => parseInt(h, 16)))
}