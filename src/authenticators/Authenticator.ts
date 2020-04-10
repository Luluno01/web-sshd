import { EventEmitter } from 'events'
import { Socket } from 'socket.io'
import Middleware from '../Middleware'


/**
 * Base class for authenticators
 */
export class Authenticator<AuthOptionType> extends EventEmitter implements Middleware {
  private _options: AuthOptionType
  public get options() {
    return this._options
  }
  public set options(options: AuthOptionType) {
    this.checkOptions(options)
    // Assign new options
    this._options = options
  }

  constructor(options: AuthOptionType) {
    super()
    this.options = options
  }

  /**
   * Check if new options are valid
   * @param options New options to set
   */
  public checkOptions(options: AuthOptionType) {}

  /**
   * Called on incoming connection
   * 
   * Shall emit `socket.id` event with argument `true` when the connection is
   * successfully authenticated (`false` otherwise)
   * @param socket WebSocket object for incoming connection
   * @param next Next callback
   */
  public onNewConnection(socket: Socket, next: () => void) {}
  
  public asMiddleware(): (socket: Socket, next: () => void) => void {
    return this.onNewConnection.bind(this)
  }
}

export default Authenticator
