import { SimpleAuth } from './SimpleAuth'
import { SaltyAuth } from './SaltyAuth'


export enum AuthenticatorNames {
  SIMPLE_AUTH = 'simple-auth',
  SALTY_AUTH = 'salty-auth'
}

export const authenticators = new Map<AuthenticatorNames, any>([
  [ AuthenticatorNames.SIMPLE_AUTH, SimpleAuth ],
  [ AuthenticatorNames.SALTY_AUTH, SaltyAuth ]
])
