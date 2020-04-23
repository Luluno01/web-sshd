import { readFile as _readFile } from 'fs'
import { promisify } from 'util'
const readFile = promisify(_readFile)
import * as assert from 'assert'
import Middleware from '../Middleware'
import { Socket } from 'socket.io'
import { EventEmitter } from 'events'
import { Client, PseudoTtyOptions } from 'ssh2'
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
   * Remote exited
   */
  REMOTE_EXIT = 'remote-exit'
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
  public passphrase?: string
  public ignoreContinue?: boolean
  public authenticator?: EventEmitter

  constructor({
    host,
    port,
    username,
    password,
    privateKey,
    passphrase,
    ignoreContinue,
    authenticator
  }: {
    host: string,
    port: number,
    username: string,
    password?: string,
    privateKey?: string | Buffer,
    passphrase?: string,
    ignoreContinue?: boolean,
    authenticator?: EventEmitter
  }) {
    this.host = host
    this.port = port
    this.username = username
    this.password = password
    this.privateKey = privateKey
    this.passphrase = passphrase
    this.ignoreContinue = ignoreContinue
    this.authenticator = authenticator
    this.checkOptions(this)
  }

  public checkOptions({
    host,
    port,
    username,
    password,
    privateKey,
    passphrase
  }: {
    host: string,
    port: number,
    username: string,
    password?: string,
    privateKey?: string | Buffer
    passphrase?: string
  }) {
    assert.doesNotMatch(host, /^\s*$/, `Invalid host ${host}`)
    if (port <= 0 || port > 65535) throw new Error(`Invalid port ${port}`)
    assert.doesNotMatch(username, /^\s*$/, `Invalid username ${username}`)
    if (!!password == !!privateKey) throw new Error('Exactly one of \`password\` and \`privateKey\` should be defined')
    if (passphrase && !privateKey) throw new Error('Passphrase is set but no private is defined')
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
    const { host, port, username, password, passphrase, ignoreContinue } = this
    let { privateKey } = this
    if (typeof privateKey == 'string') {
      try {
        this.privateKey = privateKey = await readFile(privateKey)
      } catch(err) {
        logger.warn(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" failed to read private key`, err)
        socket.emit(ServerEvent.FAILED, 'Failed to read private key')
        socket.disconnect()
        return
      }
    }
    logger.info(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" attaching remote target`)
    // Warning: Remember to close the connection once it finishes its task
    const conn = new Client
    let canSendData = true
    conn
      .on('ready', () => {
        // Authenticated, open an interactive shell session
        logger.info(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" connected to remote target`)
        conn.shell((err, remoteServer) => {
          if (err) {
            logger.warn(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" failed to connect to remote legacy SSH server`, err)
            socket.emit(ServerEvent.FAILED, 'Failed to connect to remote server')
            conn.end()
            socket.disconnect()
            return
          }
          socket.emit(ServerEvent.REMOTE_READY)
          socket
            .on(ClientEvent.MESSAGE, data => {
              if (canSendData || ignoreContinue) {
                try {
                  remoteServer.write(data)
                } catch (err) {
                  logger.error(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" failed to write to remote legacy SSH server`, err)
                }
              } else {
                logger.warn(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" discarding client data sent before \`continue\` event`)
              }
            })
            .on(ClientEvent.EXIT, () => {
              logger.info(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" client force exit`)
              conn.end()
              socket.disconnect()
            })
            .on(ClientEvent.RESIZE, (options: Omit<PseudoTtyOptions, 'term'>) => {
              try {
                const { cols, rows } = options
                let { height, width } = options
                // Sanity check and fix
                if (typeof cols != 'number' || cols <= 0 || isNaN(cols) || typeof rows != 'number' || rows <= 0 || isNaN(rows)) throw new Error('Invalid resize options')
                switch (typeof height) {
                  case 'undefined': {
                    height = rows * 19  // Default value, 19 pixels per row
                    break
                  }
                  case 'number': {
                    if (height <= 0 || isNaN(height)) height = rows * 19  // Default value, 19 pixels per row
                    break
                  }
                  default: throw new Error('Invalid resize options')
                }
                switch (typeof width) {
                  case 'undefined': {
                    width = cols * 9  // Default value, 9 pixels per column
                    break
                  }
                  case 'number': {
                    if (width <= 0 || isNaN(width)) width = cols * 9  // Default value, 9 pixels per column
                    break
                  }
                  default: throw new Error('Invalid resize options')
                }
                canSendData = remoteServer.setWindow(rows, cols, height, width)
              } catch (err) {
                logger.warn(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" sent invalid resize options`)
              }
            })
          remoteServer
            .on('data', (data: Buffer) => socket.send(data.toString()))
            .on('exit', (exitCode, signalName, didCoreDump, description) => {
              logger.info(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" remote exited with code ${exitCode}`)
              socket.emit(ServerEvent.REMOTE_EXIT, exitCode, signalName, didCoreDump, description)
              conn.end()
              socket.disconnect()
            })
            .on('close', () => {
              conn.end()
              if (socket.connected) socket.disconnect()
            })
            .on('error', (err: any) => {
              logger.warn(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" remote legacy SSH server channel error`, err)
              socket.emit(ServerEvent.FAILED, 'Remote channel error')
              conn.end()
              socket.disconnect()
            })
        })
      })
      .on('continue', () => canSendData = true)
      .on('timeout', () => {
        logger.warn(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" remote connection timeout`)
        socket.emit(ServerEvent.FAILED, 'Remote connection timeout')
        conn.end()
        socket.disconnect()
      })
      .on('greeting', greeting => {
        if (!greeting.endsWith('\r') && !greeting.endsWith('\n')) greeting += '\r\n'
        socket.send(greeting)
      })
      .on('close', () => {
        conn.end()
        if (socket.connected) socket.disconnect()
      })
      .on('end', () => {
        logger.info(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" remote connection ends`)
        if (socket.connected) socket.disconnect()
      })
      .on('error', err => {
        logger.warn(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" remote socket/SSH error`, err)
        switch (err.level) {
          case 'client-socket': {
            socket.emit(ServerEvent.FAILED, `Remote connection error: ${err.message}`)
            break
          }
          case 'client-ssh': {
            socket.emit(ServerEvent.FAILED, `Remote SSH error: ${err.message}${err.description ? ('; ' + err.description) : ''}`)
            break
          }
          default:
            socket.emit(ServerEvent.FAILED, `Unknown error: ${err.message}`)
        }
        conn.end()
        socket.disconnect()
      })
      .connect({
        host,
        port,
        username,
        password,
        privateKey,
        passphrase
      })
    socket.on('disconnect', () => {
      logger.info(`${socket.handshake.address} - "${socket.id}" - "${host}:${port}" disconnecting from remote SSH server`)
      conn.end()
    })
  }

  public asMiddleware(): (socket: Socket, next: () => void) => void {
    return this.onNewConnection.bind(this)
  }
}

export default SSHAdapter
