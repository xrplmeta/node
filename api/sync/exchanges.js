import mainlog from '@xrplmeta/log'


const log = mainlog.branch({
	name: 'sync:exchanges',
	color: 'cyan'
})


export function allocate(heads){
	log.time(`sync.candles`, `building exchanges cache`)

	let pairs = this.repo.exchanges.pairs(true)
	let count = this.repo.exchanges.count()
	let processed = 0
	let progress = 0


	for(let {base, quote} of pairs){
		let exchanges = [
			...this.repo.exchanges.iter({base: base, quote: quote}),
			...this.repo.exchanges.iter({base: quote, quote: base})
		]
		
		if(!base || !quote){
			//align exchange so volume is XRP
			exchanges = exchanges
				.filter(exchange => this.repo.exchanges.align(
					exchange,
					base ? base : quote,
					base ? quote : base
				).volume.gte('0.01'))
		}

		exchanges.sort((a, b) => a.date - b.date)

		if(exchanges.length > 0){
			let exchangesBQ = exchanges.map(exchange => this.repo.exchanges.align(
				exchange, 
				base, 
				quote
			))

			let exchangesQB = exchanges.map(exchange => this.repo.exchanges.align(
				exchange, 
				quote, 
				base
			))

			this.cache.tx(() => {
				for(let interval of Object.values(this.config.exchanges.candleIntervals)){
					this.cache.candles.allocate(
						{base: base, quote: quote, interval},
						exchangesBQ
					)

					this.cache.candles.allocate(
						{base: quote, quote: base, interval},
						exchangesQB
					)
				}

				this.cache.trades.allocate(
					{base: base, quote: quote},
					exchangesBQ
				)

				this.cache.trades.allocate(
					{base: quote, quote: base},
					exchangesQB
				)
			})

			processed += exchanges.length
		}

		let newProgress = Math.floor((processed / count) * 100)

		if(newProgress !== progress){
			progress = newProgress
			log.info(`processed`, processed, `of`, count, `exchanges (${progress}%)`)
		}
	}
	
	log.time(`sync.candles`, `built exchanges cache in %`)
}


export function register({ ranges }){
	if(!ranges.exchanges)
		return

	let newExchanges = this.repo.exchanges.iter({
		from: ranges.exchanges[0],
		to: ranges.exchanges[1]
	})

	for(let exchange of newExchanges){
		let exchangeBQ = this.repo.exchanges.align(exchange, exchange.base, exchange.quote)
		let exchangeQB = this.repo.exchanges.align(exchange, exchange.quote, exchange.base)

		if(!exchange.base || !exchange.quote){
			let volume = exchange.base ? exchangeBQ.volume : exchangeQB.volume

			if(volume.lt('0.01'))
				continue
		}

		for(let interval of intervals){
			this.cache.candles.integrate(
				{base: exchange.base, quote: exchange.quote, interval},
				exchangeBQ
			)

			this.cache.candles.integrate(
				{base: exchange.quote, quote: exchange.base, interval},
				exchangeQB
			)
		}

		this.cache.trades.integrate(
			{base: exchange.base, quote: exchange.quote},
			exchangeBQ
		)

		this.cache.trades.integrate(
			{base: exchange.quote, quote: exchange.base},
			exchangeQB
		)
	}
}