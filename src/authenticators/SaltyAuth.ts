import * as assert from 'assert'
import { Socket } from 'socket.io'
import * as log4js from 'log4js'
import Authenticator from './Authenticator'
import { randStr } from '../helpers/random'
import { hash } from '../helpers/hash'
const logger = log4js.getLogger('auth')


export enum ClientEvent {
  USERNAME = 'username',
  PASSWORD = 'password'
}

export enum ServerEvent {
  SALTS = 'salts',
  TIMEOUT = 'timeout',
  USERNAME_OR_PASSWORD_INCORRECT = 'username-or-password-incorrect',
  AUTHENTICATED = 'authenticated'
}

export interface SaltyAuthOptions {
  /**
   * Authentication timeout
   */
  timeout: number
  /**
   * Username
   */
  username: string
  /**
   * sha512(staticSalt + password)
   */
  password: string
  /**
   * Static salt
   */
  salt: string
}

export class SaltyAuth extends Authenticator<SaltyAuthOptions> {
  public fakeSalt = randStr(16)
  public checkOptions({ timeout, username, password, salt }: SaltyAuthOptions) {
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
    const passwordErrorMsg = '`password` must be a 128-hex-digit string'
    assert.equal(typeof password, 'string', passwordErrorMsg)
    assert.match(password, /^[0-9a-fA-F]{128}$/, passwordErrorMsg)
    const saltErrorMsg = '`salt` must be a non-empty string and is at least 8-character long'
    assert.equal(typeof salt, 'string', saltErrorMsg)
    assert.doesNotMatch(salt, emptyReg, saltErrorMsg)
    assert(salt.length >= 8, saltErrorMsg)
  }

  /**
   * Handle authentication on new connection
   * 
   * ```
   * User                                       Server
   *   |------------------username---------------->|
   *   |<------------[ sSalt, dSalt ]--------------|
   *   |---hash(dSalt + hash(sSalt + password))--->|
   *   |<------------------result------------------|
   * ```
   * @param socket Incoming socket
   * @param next Callback for next middleware
   */
  public onNewConnection(socket: Socket, next: () => void) {
    let t: ReturnType<typeof setTimeout> | null = null
    if (this.options.timeout) t = setTimeout(() => {
      logger.warn(`${socket.handshake.address} - "${socket.id}" authentication timeout`)
      this.emit(socket.id, false)
      socket.emit(ServerEvent.TIMEOUT)
      socket.disconnect()
    }, this.options.timeout)
    const disconnectOnAuthFailed = () => {
      this.emit(socket.id, false)
      /**
       * Username or password incorrect, notify the user
       * User                                       Server
       *   |                   ...                     |
       *   |<------------result (failed)---------------|
       */
      socket.emit(ServerEvent.USERNAME_OR_PASSWORD_INCORRECT)
      socket.disconnect()
    }
    let username: string | undefined
    /**
     * Dynamic salt for this connection
     */
    let dynamicSalt = randStr(16)
    socket
      /**
       * On user sends username
       * User                                       Server
       *   |------------------username---------------->|
       */
      .once(ClientEvent.USERNAME, _username => {
        // Send salts until we know the username for future support for
        // multi-user
        if (_username === this.options.username) {
          if (typeof _username == 'string') {
            username = _username
            /**
             * Send back static and dynamic salt
             * User                                       Server
             *   |                   ...                     |
             *   |<------------[ sSalt, dSalt ]--------------|
             */
            socket.emit(ServerEvent.SALTS, [ this.options.salt, dynamicSalt ])
          } else {
            logger.warn(`${socket.handshake.address} - "${socket.id}" authenticate failed (invalid username)`)
            disconnectOnAuthFailed()
          }
        } else {
          /**
           * Username does not match, however, send back fake static and
           * dynamic salt
           * User                                       Server
           *   |                   ...                     |
           *   |<------------[ fSalt, dSalt ]--------------|
           */
          socket.emit(ServerEvent.SALTS, [ this.fakeSalt, dynamicSalt ])
        }
      })
      /**
       * On user sends the hash value of dynamic-salted hash value of
       * static-salted password
       * User                                       Server
       *   |                   ...                     |
       *   |---hash(dSalt + hash(sSalt + password))--->|
       */
      .once(ClientEvent.PASSWORD, password => {
        if (t) {
          clearTimeout(t)
          t = null
        }
        if (typeof password == 'string' && password.match(/^[0-9a-fA-F]{128}$/)) {
          if (username === this.options.username && password === hash(dynamicSalt + this.options.password)) {
            logger.info(`${socket.handshake.address} - "${socket.id}" authenticated`)
            this.emit(socket.id, true)
            /**
             * Username and password matched, send feedback
             * User                                       Server
             *   |                   ...                     |
             *   |<--------result (authenticated)------------|
             */
            socket.emit(ServerEvent.AUTHENTICATED)
          } else {
            logger.warn(`${socket.handshake.address} - "${socket.id}" authenticate failed (incorrect username or password)`)
            disconnectOnAuthFailed()
          }
        } else {
          logger.warn(`${socket.handshake.address} - "${socket.id}" authenticate failed (invalid password)`)
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

export default SaltyAuth
