import { Socket } from 'socket.io'

export interface Middleware {
  onNewConnection(socket: Socket, next: (err?: Error) => void): void
  asMiddleware(): (socket: Socket, next: (err?: Error) => void) => void
}

export default Middleware
