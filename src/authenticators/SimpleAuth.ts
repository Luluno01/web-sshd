import * as assert from 'assert'
import { Socket } from 'socket.io'
import * as log4js from 'log4js'
import Authenticator from './Authenticator'
const logger = log4js.getLogger('auth')


export enum ClientEvent {
  AUTH = 'auth'
}

export enum ServerEvent {
  TIMEOUT = 'timeout',
  USERNAME_OR_PASSWORD_INCORRECT = 'username-or-password-incorrect',
  AUTHENTICATED = 'authenticated'
}

export interface SimpleAuthOptions {
  timeout: number
  username: string
  password: string
}

export class SimpleAuth extends Authenticator<SimpleAuthOptions> {
  public checkOptions({ timeout, username, password }: SimpleAuthOptions) {
    const timeoutErrorMsg = `Expecting \`timeout\` to be either undefined or a non-negative number, got ${timeout}`
    switch (typeof timeout) {
      case 'number': if (timeout < 0) throw new Error(timeoutErrorMsg)
      case 'undefined': break
      default:
        throw new Error(timeoutErrorMsg)
    }
    const usernameErrorMsg = '`username` must be a non-empty string'
    const emptyReg = /^\s*$/
    assert.equal(typeof username, 'string', usernameErrorMsg)
    assert.doesNotMatch(username, emptyReg, usernameErrorMsg)
    const passwordErrorMsg = '`password` must be a non-empty string'
    assert.equal(typeof password, 'string', passwordErrorMsg)
    assert.doesNotMatch(password, emptyReg, passwordErrorMsg)
  }

  public asMiddleware() {
    return this.onNewConnection.bind(this) as typeof SimpleAuth.prototype.onNewConnection
  }

  public onNewConnection(socket: Socket, next: () => void) {
    let t: ReturnType<typeof setTimeout> | null = null
    if(this.options.timeout) t = setTimeout(() => {
      logger.warn(`${socket.handshake.address} - "${socket.id}" authentication timeout`)
      this.emit(socket.id, false)
      socket.emit(ServerEvent.TIMEOUT)
      socket.disconnect()
    }, this.options.timeout)
    const disconnectOnAuthFailed = () => {
      this.emit(socket.id, false)
      socket.emit(ServerEvent.USERNAME_OR_PASSWORD_INCORRECT)
      socket.disconnect()
    }
    socket
      .once(ClientEvent.AUTH, auth => {
        if(t) {
          clearTimeout(t)
          t = null
        }
        let username: string
        let password: string
        try {
          username = auth.username
          password = auth.password
        } catch(err) {
          logger.warn(`${socket.handshake.address} - "${socket.id}" authenticate failed (invalid credential)`)
          disconnectOnAuthFailed()
          return
        }
        if(username === this.options.username && password === this.options.password) {
          logger.info(`${socket.handshake.address} - "${socket.id}" authenticated`)
          this.emit(socket.id, true)
          socket.emit(ServerEvent.AUTHENTICATED)
        } else {
          logger.warn(`${socket.handshake.address} - "${socket.id}" authenticate failed`)
          disconnectOnAuthFailed()
        }
      })
      .once('disconnect', () => {
        if(t) {
          clearTimeout(t)
          t = null
        }
        this.removeAllListeners(socket.id)
      })
    next()
  }
}

export default SimpleAuth
