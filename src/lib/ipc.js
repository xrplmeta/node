export default function(){
	let callbacks = []

	return {
		emit(payload){
			for(let callback of callbacks){
				try{
					callback(payload)
				}catch{
					// *shrug*
				}
			}
		},
		subscribe(callback){
			callbacks.push(callback)
		}
	}
}