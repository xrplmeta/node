import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import log from '../lib/log.js'
import { PrismaClient as SnapshotClient } from './clients/snapshot/index.js'
import { PrismaClient as MetaClient } from './clients/meta/index.js'


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


function createBase(Client, templateFile){
	return class extends Client{
		constructor({ file }){
			if(!fs.existsSync(file)){
				log.info(`creating database at "${file}"`)
				fs.copyFileSync(templateFile, file)
			}
	
			super({
				datasources: {
					db: {
						url: `file:${file}`
					}
				}
			})
		}

		async open(){
			await this.$queryRaw`PRAGMA journal_mode = 'WAL'`
		}

		extend(extensions){
			for(let [key, patch] of Object.entries(extensions)){
				Object.assign(this[key], patch(this))
			}
		}

		async tx(fn){
			return await this.$transaction(fn)
		}
	}
}


export const Snapshot = createBase(SnapshotClient, `${__dirname}/templates/snapshot.db`)
export const Meta = createBase(MetaClient, `${__dirname}/templates/neta.db`)