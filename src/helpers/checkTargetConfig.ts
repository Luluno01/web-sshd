import { authenticators, AuthenticatorNames } from '../authenticators'


export class TargetConfigError extends Error {
  name = 'TargetConfigError'
  path: string
  constructor(path: string, msg: string) {
    super(`\`${path}\` invalid: ${msg}`)
    this.path = path
  }
}

/**
 * Check if target config is valid
 * @param param0 Target config
 */
export function checkTargetConfig({ auth, targets }: TargetConfig) {
  if (Object.keys(auth).length == 0) throw new TargetConfigError('auth', 'no authentication configuration')
  for (const [ confName, authOptions ] of Object.entries(auth)) {
    if (typeof authOptions.type != 'string') throw new TargetConfigError(`auth.${confName}.type`, 'invalid type, string expected')
    const AuthenticatorClass = authenticators.get(authOptions.type as AuthenticatorNames)
    if (!AuthenticatorClass) throw new TargetConfigError(`auth.${confName}.type`, `invalid authenticator, installed authenticators are ${Array.from(authenticators.keys()).join(', ')}`)
    try {
      new AuthenticatorClass(authOptions)
    } catch(err) {
      console.log(err)
      throw new TargetConfigError(`auth.${confName}`, 'authentication options invalid')
    }
  }
  if (!(targets instanceof Array)) throw new TargetConfigError('targets', 'invalid type, array expected')
  const namespaces = new Set<string>()
  let i = 0
  for (const target of targets) {
    if (typeof target.type != 'string' || ![ 'local', 'remote' ].includes(target.type)) throw new TargetConfigError(`targets[${i}].type`, 'invalid target type')
    if (typeof target.nsp != 'string' || target.nsp.match(/^\s*$/)) throw new TargetConfigError(`targets[${i}].nsp`, 'invalid namespace, non-empty string expected')
    if (target.nsp.trim() == '/') throw new TargetConfigError(`targets[${i}].nsp`, 'default namespace `/` not allowed')
    if (namespaces.has(target.nsp)) throw new TargetConfigError(`targets[${i}].nsp`, 'namespace taken')
    namespaces.add(target.nsp)
    if (typeof target.auth != 'string') throw new TargetConfigError(`targets[${i}].auth`, 'invalid type, string expected')
    if (!(target.auth in auth))  throw new TargetConfigError(`targets[${i}].auth`, 'undefined authentication configuration')
    i++
  }
}

export default checkTargetConfig
