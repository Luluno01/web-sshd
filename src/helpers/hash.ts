import { createHash, BinaryLike } from 'crypto'


/**
 * Get hash value of `data`
 * @param data Content to be hashed
 * @param algorithm Hash algorithm, defaults to `sha512`
 */
export function hash(data: BinaryLike, algorithm: string = 'sha512') {
  return createHash(algorithm).update(data).digest('hex')
}

export default hash
