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
  protected authenticator?: EventEmitter
  constructor({ shell, authenticator }: { shell?: string, authenticator?: EventEmitter }) {
    this.shell = shell
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
    logger.info(`${socket.handshake.address} - "${socket.id}" attaching PTY`)
    const pty = new PTY
    if(this.shell) pty.shell = this.shell
    try {
      pty.start()
    } catch(err) {
      logger.error(`${socket.handshake.address} - "${socket.id}" failed to start PTY`)
      socket.emit(ServerEvent.FAILED)
      socket.disconnect()
      pty.destroy()  // For safety
      if(next) next()
      return
    }
    const { proc, options } = pty
    socket.emit(ServerEvent.SIZE, options)
    socket
      .on(ClientEvent.MESSAGE, data => proc.write(data))
      .on(ClientEvent.RESIZE, ({ cols, rows }: PTYOptions) => proc.resize(cols, rows))
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
    if(next) next()
  }
}

export default WebSSHD
