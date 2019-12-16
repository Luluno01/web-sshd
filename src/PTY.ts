import * as os from 'os'
import * as pty from 'node-pty'
import * as log4js from 'log4js'
const logger = log4js.getLogger('pty')


export interface PTYOptions {
  cols: number
  rows: number
}

export class PTY {
  public static defaultHome = os.platform() == 'win32' ? process.env.USERPROFILE : process.env.HOME
  public static defaultShell = os.platform() == 'win32' ? 'cmd.exe' : 'bash'
  public options: PTYOptions
  public shell = PTY.defaultShell
  public home = PTY.defaultHome
  public proc!: ReturnType<typeof pty.spawn>
  public dead?: boolean
  
  constructor(options: PTYOptions = { cols: 80, rows: 30 }) {
    this.options = options
  }

  start(conty: boolean = false) {
    if(this.proc) {
      logger.error(`PTY already or started or has not been destroyed (pid: ${this.proc.pid})`)
      throw new Error('Already started')
    }
    const proc = this.proc = pty.spawn(this.shell, [], {
      name: 'xterm-color',
      ...this.options,
      cwd: this.home,
      env: process.env,
      useConpty: conty
    })
    const { pid } = proc
    if(!pid) {
      this.dead = true
      this.destroy()
      logger.error('PTY failed to start: falsy `pid`')
      throw new Error('Falsy `pid`')
    }
    this.dead = false
  }

  destroy() {
    try {
      const { proc } = this
      if(proc) {
        const { pid } = proc
        logger.info(`Destroying PTY (pid ${pid})`)
        if(os.platform() == 'win32') {
          proc.kill()
        } else {
          proc.kill('SIGKILL')
        }
        logger.info(`PTY (pid ${pid}) destroyed`)
      }
    } catch(err) {}
    this.proc = null
    this.dead = true
  }
}

export default PTY
