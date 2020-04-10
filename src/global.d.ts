interface Target {
  /**
   * Socket.io namespace, e.g. `/cloush`
   */
  nsp: string
  /**
   * Target type
   */
  type: 'local' | 'remote'
  /**
   * Name of authentication configuration
   */
  auth?: string
}

interface RemoteTarget extends Target {
  /**
   * Remote target
   */
  type: 'remote'
  /**
   * Remote host
   */
  host: string
  /**
   * Remote port
   */
  port: number
  /**
   * Remote username
   */
  username: string
  /**
   * Remote password
   */
  password?: string
  /**
   * Path to private key
   */
  privateKey?: string
}

interface LocalTarget extends Target {
  /**
   * Local target
   */
  type: 'local'
  /**
   * Shell binary, e.g. `/usr/bin/bash`
   */
  shell?: string
  /**
   * Use conty (for Windows, experimental)
   */
  conty?: boolean
}

interface TargetConfig {
  auth: { [key: string]: { type: string } & any }
  targets: (LocalTarget | RemoteTarget)[]
}

interface Config extends TargetConfig {
  port: number
  cors: string[]
}
