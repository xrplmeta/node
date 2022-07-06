import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pkgPath = path.resolve(__dirname, '..', '..', 'package.json')
const { version } = JSON.parse(fs.readFileSync(pkgPath))


export default version