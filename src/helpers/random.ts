/**
 * Generate a random number in range [lower, upper)
 * @param lower Lower bound (inclusive)
 * @param upper Upper bound (exclusive)
 */
export function random(lower: number, upper: number) {
  return lower + Math.random() * (upper - lower)
}

export default random

/**
 * Generate a random integer in range [lower, upper)
 * @param lower Lower bound (inclusive)
 * @param upper Upper bound (exclusive)
 */
export function randInt(lower: number, upper: number) {
  return Math.floor(random(lower, upper))
}

/**
 * Generate a random string
 * @param length Length of random string
 * @param pool Random pool, optional
 */
export function randStr(
  length: number,
  pool: string = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
) {
  const poolSize = pool.length
  let str = ''
  for (let i = 0; i < length; i++) {
    str += pool[randInt(0, poolSize)]
  }
  return str
}
