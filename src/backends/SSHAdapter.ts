import { readFile as _readFile } from 'fs'
import { promisify } from 'util'
const readFile = promisify(_readFile)
import * as assert from 'assert'
import Middleware from '../Middleware'
import { Socket } from 'socket.io'
import { EventEmitter } from 'events'
import * as log4js from 'log4js'
const logger = log4js.getLogger('app')


export enum ClientEvent {
  /**
   * Client input
   */
  MESSAGE = 'message',
  /**
   * Client force exit
   */
  EXIT = 'exit',
  /**
   * Client buffer resizes
   */
  RESIZE = 'resize'
}

export enum ServerEvent {
  /**
   * PTY output
   */
  MESSAGE = 'message',
  /**
   * Initial PTY buffer size
   */
  SIZE = 'size',
  /**
   * Failed to connect to remote
   */
  FAILED = 'failed',
  /**
   * Remote logged in
   */
  REMOTE_READY = 'remote-ready',
  /**
   * Remote disconnected
   */
  REMOTE_DISCONNECT = 'remote-disconnect',
  /**
   * Remote authentication failed
   */
  REMOTE_AUTH_FAILED = 'remote-auth-failed'
}

export class SSHAdapter implements Middleware {
  public host: string
  public port: number
  public username: string
  public password?: string
  /**
   * Path to private key file or its content
   */
  public privateKey?: string | Buffer
  public authenticator?: EventEmitter

  constructor({
    host,
    port,
    username,
    password,
    privateKey,
    authenticator
  }: {
    host: string,
    port: number,
    username: string,
    password?: string,
    privateKey?: string | Buffer,
    authenticator?: EventEmitter
  }) {
    this.host = host
    this.port = port
    this.username = username
    this.password = password
    this.privateKey = privateKey
    this.authenticator = authenticator
    this.checkOptions(this)
  }

  public checkOptions({
    host,
    port,
    username,
    password,
    privateKey
  }: {
    host: string,
    port: number,
    username: string,
    password?: string,
    privateKey?: string | Buffer
  }) {
    assert.doesNotMatch(host, /^\s*$/, `Invalid host ${host}`)
    if (port <= 0 || port > 65535) throw new Error(`Invalid port ${port}`)
    assert.doesNotMatch(username, /^\s*$/, `Invalid username ${username}`)
    if (!!password == !!privateKey) throw new Error('Exactly one of \`password\` and \`privateKey\` should be defined')
  }

  public onNewConnection(socket: Socket, next: () => void): void {
    const { authenticator } = this
    if (authenticator) {
      authenticator.once(socket.id, (authenticated: boolean) => {
        if (!authenticated) return
        socket.send()
        this.attachRemote(socket)
      })
    } else {
      logger.warn('No authenticator configured!')
      this.attachRemote(socket)
    }
    next()
  }

  protected async attachRemote(socket: Socket) {
    this.checkOptions(this)
    const { host, port, username, password } = this
    let { privateKey } = this
    if (typeof privateKey == 'string') {
      try {
        this.privateKey = privateKey = await readFile(privateKey)
      } catch(err) {
        logger.warn(`${socket.handshake.address} - "${socket.id}" failed to read private key`)
        socket.emit(ServerEvent.FAILED)
        socket.disconnect()
        return
      }
    }
    logger.info(`${socket.handshake.address} - "${socket.id}" attaching remote target `)
    // TODO: Attach remote SSH, disconnect on failed or connection close
    // TODO: Emit corresponding ServerEvent
  }

  public asMiddleware(): (socket: Socket, next: () => void) => void {
    return this.onNewConnection.bind(this)
  }
}

export default SSHAdapter
