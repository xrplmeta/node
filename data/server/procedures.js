export async function currencies(ctx){
	let currencies = await ctx.dataset('currencies')

	return currencies
}