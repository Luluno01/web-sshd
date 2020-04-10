///<reference path="../global.d.ts"/>
import { readFile as _readFile, writeFile as _writeFile } from 'fs'
import { promisify } from 'util'
const readFile = promisify(_readFile)
const writeFile = promisify(_writeFile)
import * as yargs from 'yargs'
import { randStr } from '../helpers/random'
import hash from '../helpers/hash'
import { SaltyAuthOptions } from '../authenticators/SaltyAuth'


async function loadJSON(path: string) {
  return JSON.parse((await readFile(path)).toString())
}

async function dumpJSON(path: string, obj: any) {
  await writeFile(path, JSON.stringify(obj, null, 2))
}

async function main() {
  const { conf: _conf, name, username, password, timeout, help } = yargs
    .option('conf', {
      alias: 'c',
      type: 'string',
      description: 'Config file',
      demandOption: false
    })
    .option('name', {
      alias: 'n',
      type: 'string',
      description: 'Name of authentication configuration to be added',
      demandOption: true
    })
    .option('username', {
      alias: 'u',
      type: 'string',
      description: 'Username',
      demandOption: true
    })
    .option('password', {
      alias: 'p',
      type: 'string',
      description: 'Password',
      demandOption: true
    })
    .option('timeout', {
      alias: 't',
      type: 'number',
      description: 'Authentication timeout',
      demandOption: false,
      default: 5000
    })
    .option('help', {
      alias: 'h',
      type: 'boolean',
      description: 'Show help message',
      default: false
    }).argv
    const conf = _conf || 'config.json'
    if (help) {
      yargs.showHelp()
      process.exit(0)
    }
    if (name && username && password && timeout >= 0) {
      const config: Config = await loadJSON(conf)
      if (name in config.auth) {
        console.error(`Authentication configuration ${name} already exists`)
        process.exit(1)
      }
      const salt = randStr(16)
      const hashedSaltedPassword = hash(salt + password)
      config.auth[name] = {
        type: 'salty-auth',
        timeout,
        username,
        password: hashedSaltedPassword,
        salt
      } as SaltyAuthOptions
      await dumpJSON(conf, config)
      console.log('New auth:', name)
      console.log('  type: salty-auth')
      console.log('  timeout:', timeout)
      console.log('  username:', username)
      console.log('  password:', password)
      console.log('  salt:', salt)
      console.log('  SHA512(salt + password):', hashedSaltedPassword)
      console.log('Saved to', conf)
    } else {
      yargs.showHelp()
      process.exit(1)
    }
}

main()
