import { generateMnemonic, mnemonicToAccount, privateKeyToAccount, english } from 'viem/accounts'
import type { LocalAccount } from 'viem/accounts'

const STORAGE_KEY = 'nova_local_keystore'
const PBKDF2_ITERATIONS = 210_000

export type KeystoreKind = 'mnemonic' | 'privateKey'

export type Keystore = {
  v: 1
  kind: KeystoreKind
  address: `0x${string}`
  salt: string
  iv: string
  data: string
  createdAt: string
}

type Listener = () => void

let account: LocalAccount | null = null
let snapshot: { address: `0x${string}` | null } = { address: null }
const listeners = new Set<Listener>()

function publish() {
  snapshot = { address: account?.address ?? null }
  listeners.forEach((listener) => listener())
}

export const localWalletStore = {
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot() {
    return snapshot
  },
  getAccount() {
    return account
  },
  setAccount(next: LocalAccount) {
    account = next
    publish()
  },
  lock() {
    account = null
    publish()
  },
}

export function getKeystore(): Keystore | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Keystore
    if (
      parsed?.v !== 1 ||
      (parsed.kind !== 'mnemonic' && parsed.kind !== 'privateKey') ||
      !parsed.address ||
      !parsed.salt ||
      !parsed.iv ||
      !parsed.data
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveKeystore(keystore: Keystore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keystore))
}

export function removeKeystore() {
  localStorage.removeItem(STORAGE_KEY)
}

export function createMnemonic(): string {
  return generateMnemonic(english, 128)
}

export function normalizeMnemonic(input: string): string {
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ')
}

export function accountFromMnemonic(input: string): LocalAccount {
  const mnemonic = normalizeMnemonic(input)
  if (mnemonic.split(' ').length < 12) throw new Error('Enter a valid 12 or 24-word recovery phrase.')
  try {
    return mnemonicToAccount(mnemonic) as LocalAccount
  } catch {
    throw new Error('That recovery phrase is not valid. Check every word and try again.')
  }
}

export function accountFromPrivateKey(input: string): LocalAccount {
  const clean = input.trim().replace(/^0X/, '0x')
  const key = /^[0-9a-fA-F]{64}$/.test(clean) ? `0x${clean}` : clean
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('Enter a valid 32-byte private key.')
  try {
    return privateKeyToAccount(key as `0x${string}`) as LocalAccount
  } catch {
    throw new Error('That private key is not valid.')
  }
}

export function parseSecret(input: string): { kind: KeystoreKind; secret: string; account: LocalAccount } {
  const clean = input.trim().replace(/^0X/, '0x')
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(clean)) {
    const account = accountFromPrivateKey(clean)
    return { kind: 'privateKey', secret: `0x${clean.replace(/^0x/, '')}`, account }
  }
  return { kind: 'mnemonic', secret: normalizeMnemonic(clean), account: accountFromMnemonic(clean) }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function assertCrypto() {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('This browser cannot encrypt a local wallet. Use HTTPS or a modern browser.')
  }
}

export async function encryptSecret(
  secret: string,
  password: string,
  kind: KeystoreKind,
  address: `0x${string}`,
): Promise<Keystore> {
  assertCrypto()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(secret),
  )
  return {
    v: 1,
    kind,
    address,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
    createdAt: new Date().toISOString(),
  }
}

export async function decryptKeystore(keystore: Keystore, password: string): Promise<LocalAccount> {
  assertCrypto()
  const salt = fromBase64(keystore.salt)
  const iv = fromBase64(keystore.iv)
  const key = await deriveKey(password, salt)
  let plain: ArrayBuffer
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromBase64(keystore.data))
  } catch {
    throw new Error('Incorrect password.')
  }
  const secret = new TextDecoder().decode(plain)
  const next = keystore.kind === 'privateKey' ? accountFromPrivateKey(secret) : accountFromMnemonic(secret)
  if (next.address.toLowerCase() !== keystore.address.toLowerCase()) {
    throw new Error('The saved wallet is corrupted.')
  }
  return next
}
