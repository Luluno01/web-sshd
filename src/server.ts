import * as http from 'http'
import * as socketIO from 'socket.io'
import WebSSHD from './WebSSHD'
import * as log4js from 'log4js'
import SimpleAuth from './SimpleAuth'
const config = require('../config.json')


log4js.configure('./log4js.json')
const logger = log4js.getLogger('app')
const auth = new SimpleAuth(config.auth)
const sshd = new WebSSHD({ shell: config.shell, authenticator: auth.authenticator })
const server = http.createServer((_, res) => {
  res.statusCode = 200
  res.end(`<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>WebSSHD</title>
    <script src="/socket.io/socket.io.js"></script>
  </head>
  <body>
    Hello, WebSSHD!
  </body>
  </html>`)
})
const io = socketIO(server)
io.origins(config.cors)
io.use(auth.asMiddleware())
io.use(sshd.asMiddleware())
server.listen(config.port, () => {
  logger.info(`Server running @ ${config.port}`)
})
