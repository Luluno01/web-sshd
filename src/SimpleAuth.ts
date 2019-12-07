import { Socket } from 'socket.io'
import * as log4js from 'log4js'
import { EventEmitter } from 'events'
const logger = log4js.getLogger('auth')


export enum ClientEvent {
  AUTH = 'auth'
}

export enum ServerEvent {
  TIMEOUT = 'timeout',
  USERNAME_OR_PASSWORD_INCORRECT = 'username-or-password-incorrect',
  AUTHENTICATED = 'authenticated'
}

export interface AuthOptions {
  timeout: number
  username: string
  password: string
}

export class SimpleAuth {
  public options: AuthOptions
  public authenticator = new EventEmitter
  constructor(options: AuthOptions) {
    this.options = options
  }

  public asMiddleware() {
    return this.onNewConnection.bind(this) as typeof SimpleAuth.prototype.onNewConnection
  }

  public onNewConnection(socket: Socket, next: () => void) {
    const { authenticator } = this
    let t: ReturnType<typeof setTimeout> | null = null
    if(this.options.timeout) t = setTimeout(() => {
      logger.warn(`${socket.handshake.address} - "${socket.id}" authentication timeout`)
      authenticator.emit(socket.id, false)
      socket.emit(ServerEvent.TIMEOUT)
      socket.disconnect()
    }, this.options.timeout)
    socket.on(ClientEvent.AUTH, auth => {
      if(t) clearTimeout(t)
      let username: string
      let password: string
      try {
        username = auth.username
        password = auth.password
      } catch(err) {
        logger.warn(`${socket.handshake.address} - "${socket.id}" authenticate failed (invalid credential)`)
        authenticator.emit(socket.id, false)
        socket.emit(ServerEvent.USERNAME_OR_PASSWORD_INCORRECT)
        socket.disconnect()
        return
      }
      if(username === this.options.username && password === this.options.password) {
        logger.info(`${socket.handshake.address} - "${socket.id}" authenticated`)
        authenticator.emit(socket.id, true)
        socket.emit(ServerEvent.AUTHENTICATED)
      } else {
        logger.warn(`${socket.handshake.address} - "${socket.id}" authenticate failed`)
        authenticator.emit(socket.id, false)
        socket.emit(ServerEvent.USERNAME_OR_PASSWORD_INCORRECT)
        socket.disconnect()
      }
    })
    socket.on('disconnect', () => this.authenticator.removeAllListeners(socket.id))
    next()
  }
}

export default SimpleAuth
