///<reference path="global.d.ts"/>
import * as http from 'http'
import * as socketIO from 'socket.io'
import WebSSHD from './backends/WebSSHD'
import * as log4js from 'log4js'
import checkTargetConfig from './helpers/checkTargetConfig'
import { authenticators, AuthenticatorNames } from './authenticators'
import Authenticator from './authenticators/Authenticator'
import SSHAdapter from './backends/SSHAdapter'
const config: Config = require('../config.json')


log4js.configure('./log4js.json')
const logger = log4js.getLogger('app')
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
checkTargetConfig(config)
for (const target of config.targets) {
  const authOptions = config.auth[target.auth]
  const AuthenticatorClass = authenticators.get(authOptions.type as AuthenticatorNames)
  const authenticator: Authenticator<any> = new AuthenticatorClass(authOptions)
  let sshd: (socket: socketIO.Socket, next: () => void) => void
  if (target.type == 'local') {
    sshd = (new WebSSHD({ ...target, authenticator })).asMiddleware()
  } else {
    sshd = (new SSHAdapter({ ...target, authenticator })).asMiddleware()
  }
  logger.info(`Installing ${target.type} target on namespace ${target.nsp || '/cloush'}`)
  io.of(target.nsp || '/cloush')
    .use(authenticator.asMiddleware())
    .use(sshd)
}

server.listen(config.port, () => {
  logger.info(`Server running @ ${config.port}`)
})
