const bruteIterationsPerSecond = Math.pow(2, 28)

export function approximatePasswordCrackTime(password){
	let entropy = 0

	if(/[a-z]/g.test(password))
		entropy += 25

	if(/[A-Z]/g.test(password))
		entropy += 25

	if(/[0-9]/g.test(password))
		entropy += 10

	if(/[^a-zA-Z0-9]/g.test(password))
		entropy += 25

	return Math.pow(entropy, password.length) / bruteIterationsPerSecond
}