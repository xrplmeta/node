import dotenv from 'dotenv'
import Server from './server.js'

dotenv.config()

let server = new Server()

server.listen(parseInt(process.env.PORT))