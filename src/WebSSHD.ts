import PTY, { PTYOptions } from './PTY'
import { Socket } from 'socket.io'
import * as log4js from 'log4js'
import { EventEmitter } from 'events'
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
   * PTY ready
   */
  READY = 'ready',
  /**
   * Initial PTY buffer size
   */
  SIZE = 'size',
  /**
   * PTY exit
   */
  EXIT = 'exit',
  /**
   * Failed to start PTY
   */
  FAILED = 'failed'
}

export class WebSSHD {
  public shell?: string
  public conty?: boolean
  protected authenticator?: EventEmitter
  constructor({ shell, conty, authenticator }: { shell?: string, conty?: boolean, authenticator?: EventEmitter }) {
    this.shell = shell
    this.conty = conty
    this.authenticator = authenticator
  }

  public asMiddleware() {
    return this.onNewConnection.bind(this) as typeof WebSSHD.prototype.onNewConnection
  }

  public onNewConnection(socket: Socket, next: () => void) {
    const { authenticator } = this
    if(authenticator) {
      authenticator.once(socket.id, (authenticated: boolean) => {
        if(!authenticated) return
        this.attachPTY(socket)
      })
      next()
    } else {
      this.attachPTY(socket, next)
    }
  }

  protected attachPTY(socket: Socket, next?: () => void) {
    if(next) next()
    logger.info(`${socket.handshake.address} - "${socket.id}" attaching PTY`)
    const pty = new PTY
    if(this.shell) pty.shell = this.shell
    try {
      pty.start(this.conty)
    } catch(err) {
      logger.error(`${socket.handshake.address} - "${socket.id}" failed to start PTY`, err)
      socket.emit(ServerEvent.FAILED)
      socket.disconnect()
      pty.destroy()  // For safety
      return
    }
    const { proc, options } = pty
    socket.emit(ServerEvent.SIZE, options)
    socket
      .on(ClientEvent.MESSAGE, data => {
        try {
          proc.write(data)
        } catch(err) {
          logger.error(`${socket.handshake.address} - "${socket.id}" failed to write to PTY`, err)
        }
      })
      .on(ClientEvent.RESIZE, ({ cols, rows }: PTYOptions) => {
        try {
          proc.resize(cols, rows)
        } catch(err) {
          logger.error(`${socket.handshake.address} - "${socket.id}" failed to resize PTY`, err)
        }
      })
      .on(ClientEvent.EXIT, () => {
        logger.info(`${socket.handshake.address} - "${socket.id}" client force exit`)
        pty.destroy()
        socket.disconnect()  // The exit code is not guaranteed (?) to be delivered to the client
      })
      .on('disconnect', () => {
        if(pty.dead) {
          logger.info(`${socket.handshake.address} - "${socket.id}" PTY already dead`)
        } else {
          logger.info(`${socket.handshake.address} - "${socket.id}" destroying PTY`)
          pty.destroy()
        }
      })
    proc.on('data', data => socket.send(data))
    proc.on('exit', (exitCode, signal) => {
      socket.emit(ServerEvent.EXIT, exitCode, signal)
      socket.disconnect()
      pty.destroy()
    })
  }
}

export default WebSSHD
