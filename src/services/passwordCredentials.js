const PBKDF2_ITERATIONS = 210_000

function lettersOnly(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}]/gu, '')
    .toLocaleLowerCase()
}

export function generateDefaultPassword(firstName, lastName) {
  const first = lettersOnly(firstName)
  const last = lettersOnly(lastName)
  if (!first || !last) {
    throw new Error('A first name and surname are required to create sign-in credentials.')
  }
  return `${first.slice(0, 2)}${last}`
}

function getCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Secure password verification is unavailable in this browser.')
  }
  return globalThis.crypto
}

function toHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function deriveHash(password, salt) {
  const crypto = getCrypto()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: Uint8Array.from(salt.match(/.{2}/g), value => Number.parseInt(value, 16)),
    iterations: PBKDF2_ITERATIONS,
  }, key, 256)
}

export async function createPasswordCredential(password) {
  const crypto = getCrypto()
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  const passwordSalt = toHex(salt)
  const passwordHash = toHex(await deriveHash(password, passwordSalt))
  return { passwordSalt, passwordHash }
}

export async function verifyPasswordCredential(password, credential) {
  if (
    !credential
    || typeof credential.passwordSalt !== 'string'
    || typeof credential.passwordHash !== 'string'
  ) return false
  const computed = toHex(await deriveHash(password, credential.passwordSalt))
  return computed === credential.passwordHash
}
