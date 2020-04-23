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

This server is meant to be used with [WebSSHD Credential Storage](https://github.com/Luluno01/web-sshd-credential-storage) and [Cloush](https://github.com/Luluno01/cloush) (you may also use it for your own project if you like).

## Features

* Multi-target support
* Local shell (local pseudo terminal)
* Remote shell (connect to remote legacy SSH server and convert to WebSocket-based SSH protocol)

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

For example, see [`SimpleAuth` middleware](./src/SimpleAuth.ts) (for example purpose only, deprecated) and [`server`](./src/server.ts).

### Run Development Server

For integrated development server, simply run

```bash
npm run serve
```

For integrated development server with auto-reload (by using `nodemon`), simply run

```bash
npm run dev
```

### Config

```JavaScript
{
  "port": 3000,  // Listening port for development server
  "auth": {
    "myAuth1": {  // An authentication configuration
      "type": "salty-auth",
      "timeout": 5000,  // Authentication timeout (to disable timeout, remove this or set to `undefined`)
      "username": "websshd",  // User name
      "password": "b8240ca4f47411d6cbbd2e5d364b92713656200cad8ba2f4fb6243b9ca08e1100932cef95d4596cb62aca51aa99b1aed19064910b6dae960207f4593cb9450db"  // Password
      "salt": "7S=Q`-~TM,iUD.>]"  // Salt for password
    },
    "myAuth2": {  // Another authentication configuration
      "type": "salty-auth",
      "timeout": 5000,  // Authentication timeout (to disable timeout, remove this or set to `undefined`)
      "username": "websshd",  // User name
      "password": "44fcb1f2049c2b80400890922d891c356f73e9bf01c43063e86c4a8f037273796b0f50fe9b16b1776fb24e5eddfd59d08a81cfae7b5e64b035d8823ffab8829e"  // Password
      "salt": "rt.-|(=6)W}64y,{"  // Salt for password
    }
  },
  "targets": [
    {
      "type": "local",  // Local target
      "nsp": "/local",  // Socket.IO namespace (or the "path" part of the URL)
      "auth": "myAuth1",  // Use "myAuth1"
      "shell": "cmd.exe",  // Shell
      "conty": false  // Use CONTY or not (for Windows only)
    },
    {
      "nsp": "/remote1",
      "type": "remote",  // Remote target
      "auth": "myAuth2",
      "host": "192.168.0.1",  // Remote SSH host
      "port": "22",  // Remote SSH port
      "username": "cloush",  // Remote SSH user
      "password": "ohMywebsshd"  // Password for remote SSH
    },
    {
      "nsp": "/remote2",
      "type": "remote",
      "auth": "myAuth2",
      "host": "192.168.0.1",
      "port": "22",
      "username": "cloush",
      "privateKey": "~/.ssh/id_rsa"  // Private key for remote SSH
    }
  ],
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
socket.on('salts', ([ staticSalt, dynamicSalt ]) => socket.emit('password', sha512(dynamicSalt + sha512(staticSalt + 'ohMywebsshd'))))
socket.emit('username', 'websshd')
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
