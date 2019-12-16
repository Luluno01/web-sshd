# Web-SSHD

<a href="http://www.wtfpl.net/">
  <img
    src="http://www.wtfpl.net/wp-content/uploads/2012/12/wtfpl-badge-4.png"
    width="80"
    height="15"
    alt="WTFPL"
  />
</a>

WebSocket-based SSH server.

## Usage

### Install

```bash
npm install git+https://github.com/Luluno01/web-sshd.git --save
```

### Clone

If you want a standalone `WebSSHD`, clone this repository.

```bash
git clone https://github.com/Luluno01/web-sshd.git --depth=1
```

### `use` as a Middleware

```TypeScript
import * as socketIO from 'socket.io'
import * as http from 'http'
import { WebSSHD } from 'web-sshd'

// ...

const server = http.createServer()
const io = socketIO(server)
io.use(new WebSSHD({ shell: 'bash' }))
```

### Enable Authentication

```TypeScript
import * as socketIO from 'socket.io'
import * as http from 'http'
import { EventEmitter } from 'event'
import { WebSSHD } from 'web-sshd'

// ...

const server = http.createServer()
const io = socketIO(server)
const authenticator = new EventEmitter
// Your own authentication middleware goes here
// Notify `WebSSHD` that whether a `socket` is authenticated or not by
// `authentication.emit(socket.id, authenticated)`, where `authenticated` is a
// boolean value, `true` for authenticated
io.use(new WebSSHD({ shell: 'bash', authenticator }))
```

For example, see [`SimpleAuth` middleware](./src/SimpleAuth.ts) and [`server`](./src/server.ts).

### Run Development Server

For integrated development server, simply run

```bash
npm run serve
```

### Config

```JavaScript
{
  "shell": "cmd.exe",  // Shell
  "conty": false,  // Use CONTY or not (for Windows only)
  "port": 3000,  // Listening port for development server
  "auth": {
    "timeout": 5000,  // Authentication timeout (to disable timeout, set this to `false`)
    "username": "websshd",  // User name
    "password": "ohMywebsshd"  // Password
  },
  "cors": [  // Allowed origins
    "*:*"
  ]
}
```

### Example Usage

Server:

```bash
npm run serve
```

Client:

```TypeScript
const socket = io('/')
socket.emit('auth', { username: 'websshd', password: 'ohMywebsshd' })
socket.on('message', console.log)
socket.on('exit', console.warn)
socket.on('authenticated', () => {
  socket.send('ls\r')
  socket.send('exit\r')
})
socket.on('timeout', () => console.error('Authentication timeout'))
socket.on('username-or-password-incorrect', () => console.error('Username or password incorrect'))
```

## License

<a href="http://www.wtfpl.net/" target="_blank"><img src="http://www.wtfpl.net/wp-content/uploads/2012/12/wtfpl.svg" alt="WTFPL"/></a>
