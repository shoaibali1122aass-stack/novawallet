import { supabase } from './supabase'
import { getKeystore, saveKeystore, type Keystore, type KeystoreKind } from './localWallet'

const META_KEY = 'nova_wallet_keystore'
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

let lastPushed: string | null = null

function isKeystore(value: unknown): value is Keystore {
  if (!value || typeof value !== 'object') return false
  const keystore = value as Partial<Keystore>
  const kind = keystore.kind as KeystoreKind | undefined
  return (
    keystore.v === 1 &&
    (kind === 'mnemonic' || kind === 'privateKey') &&
    typeof keystore.address === 'string' &&
    ADDRESS_RE.test(keystore.address) &&
    typeof keystore.salt === 'string' &&
    typeof keystore.iv === 'string' &&
    typeof keystore.data === 'string'
  )
}

function signature(keystore: Keystore | null): string {
  return keystore ? `${keystore.address.toLowerCase()}:${keystore.data}` : ''
}

export function keystoreFromMetadata(metadata: unknown): Keystore | null {
  if (!metadata || typeof metadata !== 'object') return null
  const value = (metadata as Record<string, unknown>)[META_KEY]
  return isKeystore(value) ? value : null
}

/**
 * Stores only the password-encrypted keystore in the signed-in user's metadata.
 * The secret itself never leaves the device and cannot be decrypted without the
 * user's password, but the backup lets the same email restore the wallet on
 * another device.
 */
export async function pushKeystoreToAccount(keystore: Keystore | null): Promise<void> {
  const next = signature(keystore)
  if (lastPushed === next) return
  lastPushed = next
  try {
    const { error } = await supabase.auth.updateUser({ data: { [META_KEY]: keystore } })
    if (error) throw error
  } catch {
    lastPushed = null
  }
}

export function restoreKeystoreFromAccount(metadata: unknown): Keystore | null {
  const remote = keystoreFromMetadata(metadata)
  const local = getKeystore()
  if (local) {
    const localAt = Date.parse(local.createdAt) || 0
    const remoteAt = remote ? Date.parse(remote.createdAt) || 0 : -1
    if (!remote || localAt >= remoteAt) {
      if (!remote || remote.data !== local.data || remote.address !== local.address) {
        void pushKeystoreToAccount(local)
      }
      return local
    }
  }
  if (!remote) return null
  saveKeystore(remote)
  return remote
}
