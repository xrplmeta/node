import version from '../../lib/version.js'
import { getAvailableRange } from '../../db/helpers/ledgers.js'


export function serveServerInfo(){
	return () => {
		return {
			server_version: version,
			available_range: getAvailableRange({ ctx })
		}
	}
}