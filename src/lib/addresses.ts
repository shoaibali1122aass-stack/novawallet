import { HDKey } from '@scure/bip32'
import { mnemonicToSeedSync } from '@scure/bip39'
import { p2wpkh } from '@scure/btc-signer'
import { base58 } from '@scure/base'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { ed25519 } from '@noble/curves/ed25519.js'
import { hmac } from '@noble/hashes/hmac.js'
import { sha512 } from '@noble/hashes/sha2.js'
import type { KeystoreKind } from './localWallet'

export type DerivedAddresses = {
  btcAddress?: string
  solAddress?: string
}

const BTC_PATH = "m/84'/0'/0'/0/0"
const SOL_PATH = [44, 501, 0, 0]

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '')
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error('Invalid private key.')
  }
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function ser32(index: number): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setUint32(0, index >>> 0, false)
  return out
}

function deriveEd25519(seed: Uint8Array, path: number[]): Uint8Array {
  let digest = hmac(sha512, new TextEncoder().encode('ed25519 seed'), seed)
  let key = digest.slice(0, 32)
  let chainCode = digest.slice(32)
  for (const index of path) {
    const data = new Uint8Array(1 + 32 + 4)
    data[0] = 0
    data.set(key, 1)
    data.set(ser32((index + 0x80000000) >>> 0), 33)
    digest = hmac(sha512, chainCode, data)
    key = digest.slice(0, 32)
    chainCode = digest.slice(32)
  }
  return key
}

export function deriveBtcAddressFromMnemonic(mnemonic: string): string {
  const seed = mnemonicToSeedSync(mnemonic.trim())
  const node = HDKey.fromMasterSeed(seed).derive(BTC_PATH)
  if (!node.publicKey) throw new Error('Could not derive a Bitcoin address.')
  return p2wpkh(node.publicKey).address
}

export function deriveBtcAddressFromPrivateKey(privateKey: string): string {
  const publicKey = secp256k1.getPublicKey(hexToBytes(privateKey), true)
  return p2wpkh(publicKey).address
}

export function deriveSolAddressFromMnemonic(mnemonic: string): string {
  const seed = mnemonicToSeedSync(mnemonic.trim())
  const key = deriveEd25519(seed, SOL_PATH)
  return base58.encode(ed25519.getPublicKey(key))
}

export function deriveWalletAddresses(secret: string, kind: KeystoreKind): DerivedAddresses {
  const clean = secret.trim().replace(/^0X/, '0x')
  if (kind === 'privateKey') {
    return { btcAddress: deriveBtcAddressFromPrivateKey(clean) }
  }
  return {
    btcAddress: deriveBtcAddressFromMnemonic(clean),
    solAddress: deriveSolAddressFromMnemonic(clean),
  }
}
