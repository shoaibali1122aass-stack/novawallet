import { useState, useSyncExternalStore, type FormEvent } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import {
  accountFromMnemonic,
  createMnemonic,
  decryptKeystore,
  encryptSecret,
  getKeystore,
  localWalletStore,
  parseSecret,
  removeKeystore,
  saveKeystore,
  type Keystore,
  type KeystoreKind,
} from '../lib/localWallet'
import { shortAddr } from '../lib/format'
import { CopyButton } from './CopyButton'

type Mode = 'idle' | 'create' | 'import' | 'unlock'
type Step = 'phrase' | 'password' | 'secret'

export function LocalWalletCard() {
  const [mode, setMode] = useState<Mode>('idle')
  const [step, setStep] = useState<Step>('phrase')
  const [keystore, setKeystore] = useState<Keystore | null>(() =>
    typeof window === 'undefined' ? null : getKeystore(),
  )
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [backedUp, setBackedUp] = useState(false)
  const [secretInput, setSecretInput] = useState('')
  const [importSecret, setImportSecret] = useState<{
    kind: KeystoreKind
    secret: string
    address: `0x${string}`
  } | null>(null)

  const snapshot = useSyncExternalStore(
    localWalletStore.subscribe,
    localWalletStore.getSnapshot,
    localWalletStore.getSnapshot,
  )
  const { isConnected, connector: activeConnector } = useAccount()
  const { connectors, connectAsync, isPending: connecting } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const localConnector = connectors.find((connector) => connector.id === 'novaLocal')
  const localConnected = isConnected && activeConnector?.id === 'novaLocal'
  const working = busy || connecting

  function clearForm() {
    setStep('phrase')
    setPassword('')
    setConfirm('')
    setMnemonic('')
    setBackedUp(false)
    setSecretInput('')
    setImportSecret(null)
  }

  function backToIdle() {
    clearForm()
    setError('')
    setOk('')
    setMode('idle')
  }

  function finish(message: string) {
    clearForm()
    setError('')
    setOk(message)
    setMode('idle')
  }

  function startCreate() {
    setError('')
    setOk('')
    clearForm()
    setStep('phrase')
    try {
      setMnemonic(createMnemonic())
      setMode('create')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a recovery phrase.')
    }
  }

  function startImport() {
    setError('')
    setOk('')
    clearForm()
    setStep('secret')
    setMode('import')
  }

  function startUnlock() {
    setError('')
    setOk('')
    setPassword('')
    setConfirm('')
    setMode('unlock')
  }

  async function connectLocal() {
    if (!localConnector) throw new Error('Local wallet connector is unavailable. Reload the page.')
    if (!localWalletStore.getAccount()) throw new Error('Wallet is locked.')
    if (activeConnector?.id === 'novaLocal') return
    if (isConnected) await disconnectAsync()
    await connectAsync({ connector: localConnector })
  }

  async function autoConnect() {
    if (isConnected && activeConnector?.id !== 'novaLocal') return
    try {
      await connectLocal()
    } catch {
      /* the card still offers a Connect button */
    }
  }

  async function handleConnect() {
    setError('')
    setOk('')
    setBusy(true)
    try {
      await connectLocal()
      setOk('NovaWallet local wallet connected.')
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0] : 'Could not connect the local wallet.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLock() {
    setError('')
    setOk('')
    try {
      if (localConnected) await disconnectAsync()
      else localWalletStore.lock()
      setOk('Wallet locked. The encrypted backup remains on this device.')
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0] : 'Could not lock the wallet.')
    }
  }

  async function handleRemove() {
    if (
      !window.confirm(
        'Remove this encrypted wallet from this device? You can only restore it with your recovery phrase.',
      )
    ) {
      return
    }
    setError('')
    setOk('')
    try {
      if (localConnected) await disconnectAsync()
    } catch {
      /* ignore */
    }
    removeKeystore()
    localWalletStore.lock()
    setKeystore(null)
    finish('Encrypted wallet removed from this device.')
  }

  async function createWallet(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!backedUp) {
      setError('Confirm that you saved your recovery phrase.')
      return
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for the encryption password.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const account = accountFromMnemonic(mnemonic)
      const next = await encryptSecret(mnemonic, password, 'mnemonic', account.address)
      saveKeystore(next)
      setKeystore(next)
      localWalletStore.setAccount(account)
      await autoConnect()
      finish('Wallet created and encrypted on this device.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the wallet.')
    } finally {
      setBusy(false)
    }
  }

  function prepareImport(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const parsed = parseSecret(secretInput)
      setImportSecret({ kind: parsed.kind, secret: parsed.secret, address: parsed.account.address })
      setStep('password')
      setPassword('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that wallet.')
    }
  }

  async function importWallet(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!importSecret) return
    if (password.length < 8) {
      setError('Use at least 8 characters for the encryption password.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const parsed = parseSecret(importSecret.secret)
      const next = await encryptSecret(parsed.secret, password, parsed.kind, parsed.account.address)
      saveKeystore(next)
      setKeystore(next)
      localWalletStore.setAccount(parsed.account)
      await autoConnect()
      finish('Wallet imported and encrypted on this device.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import the wallet.')
    } finally {
      setBusy(false)
    }
  }

  async function unlockWallet(e: FormEvent) {
    e.preventDefault()
    if (!keystore) return
    setError('')
    setBusy(true)
    try {
      const account = await decryptKeystore(keystore, password)
      localWalletStore.setAccount(account)
      await autoConnect()
      finish('Wallet unlocked.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock the wallet.')
    } finally {
      setBusy(false)
    }
  }

  const savedAddress = keystore?.address ?? null
  const unlockedAddress = snapshot.address

  return (
    <div id="local-wallet" className="card scroll-mt-24 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Create or import a wallet</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            EVM wallet for Ethereum, BNB Chain, Polygon, Arbitrum and Base. The secret is encrypted on this device and
            never sent to our servers.
          </p>
        </div>
        <span className="badge shrink-0 border-white/10 bg-white/5 text-slate-400">On-device</span>
      </div>

      {mode === 'idle' && (
        <div className="mt-4 space-y-3">
          {unlockedAddress ? (
            <>
              <div className="rounded-xl border border-accent-500/20 bg-accent-500/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    {localConnected ? 'Connected local wallet' : 'Unlocked wallet'}
                  </p>
                  <span className="badge border-accent-500/30 bg-accent-500/10 text-accent-400">
                    {localConnected ? 'Connected' : 'Unlocked'}
                  </span>
                </div>
                <p className="mt-1 break-all font-mono text-xs text-slate-200">{unlockedAddress}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CopyButton value={unlockedAddress} label="Copy address" />
                  {!localConnected && (
                    <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={handleConnect} disabled={working}>
                      {working ? 'Connecting…' : 'Connect'}
                    </button>
                  )}
                  <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={handleLock} disabled={working}>
                    Lock
                  </button>
                  <button
                    className="text-xs font-semibold text-rose-400 hover:underline"
                    onClick={handleRemove}
                    disabled={working}
                  >
                    Remove
                  </button>
                </div>
              </div>
              {isConnected && !localConnected && (
                <p className="text-[11px] leading-relaxed text-amber-400">
                  An external wallet is connected. Connecting this local wallet will disconnect it.
                </p>
              )}
            </>
          ) : savedAddress ? (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Saved wallet</p>
                  <span className="badge border-white/10 bg-white/5 text-slate-400">Locked</span>
                </div>
                <p className="mt-1 break-all font-mono text-xs text-slate-200">{savedAddress}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={startUnlock}>
                    Unlock
                  </button>
                  <CopyButton value={savedAddress} label="Copy address" />
                  <button
                    className="text-xs font-semibold text-rose-400 hover:underline"
                    onClick={handleRemove}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Unlock with the password you chose. NovaWallet cannot recover a forgotten password.
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button className="btn-primary flex-1" onClick={startCreate}>
                  Create new wallet
                </button>
                <button className="btn-secondary flex-1" onClick={startImport}>
                  Import existing wallet
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Create a fresh 12-word wallet or import a recovery phrase / private key. The encrypted backup is stored
                only in this browser.
              </p>
            </>
          )}
        </div>
      )}

      {mode === 'create' && (
        <div className="mt-4 space-y-3">
          {step === 'phrase' ? (
            <>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                <p className="text-xs font-semibold text-amber-300">Save this recovery phrase now</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Anyone with these words can steal your funds. Never share them. NovaWallet will not show them again.
                </p>
              </div>
              <ol className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-ink-900/70 p-3 font-mono text-xs text-slate-200 sm:grid-cols-3">
                {mnemonic.split(' ').map((word, index) => (
                  <li key={`${word}-${index}`} className="flex items-center gap-2">
                    <span className="w-4 text-right text-slate-600">{index + 1}.</span>
                    {word}
                  </li>
                ))}
              </ol>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={backedUp}
                    onChange={(e) => setBackedUp(e.target.checked)}
                  />
                  I wrote down my recovery phrase and understand it cannot be recovered.
                </label>
                <CopyButton value={mnemonic} label="Copy phrase" />
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={backToIdle} disabled={working}>
                  Cancel
                </button>
                <button
                  className="btn-primary flex-1"
                  onClick={() => setStep('password')}
                  disabled={!backedUp || !mnemonic}
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={createWallet} className="space-y-3">
              <p className="text-[11px] leading-relaxed text-slate-400">
                Choose a password to encrypt the recovery phrase in this browser. It is never sent anywhere and cannot
                be recovered.
              </p>
              <div>
                <label className="label">Encryption password</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input
                  type="password"
                  className="input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setStep('phrase')}
                  disabled={working}
                >
                  Back
                </button>
                <button className="btn-primary flex-1" disabled={working}>
                  {working ? 'Creating…' : 'Create wallet'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {mode === 'import' && (
        <div className="mt-4 space-y-3">
          {step === 'secret' ? (
            <form onSubmit={prepareImport} className="space-y-3">
              <div>
                <label className="label">Recovery phrase or private key</label>
                <textarea
                  className="input min-h-[92px] font-mono text-xs"
                  placeholder="12 or 24 words, or 0x… private key"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                Paste only in a browser you trust. The secret is encrypted locally before anything is saved.
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary flex-1" onClick={backToIdle}>
                  Cancel
                </button>
                <button className="btn-primary flex-1" disabled={!secretInput.trim()}>
                  Continue
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={importWallet} className="space-y-3">
              {importSecret && (
                <div className="rounded-xl border border-white/10 bg-ink-900/70 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Wallet address</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-200">{importSecret.address}</p>
                </div>
              )}
              <div>
                <label className="label">Encryption password</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input
                  type="password"
                  className="input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setStep('secret')}
                  disabled={working}
                >
                  Back
                </button>
                <button className="btn-primary flex-1" disabled={working}>
                  {working ? 'Importing…' : 'Import wallet'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {mode === 'unlock' && (
        <form onSubmit={unlockWallet} className="mt-4 space-y-3">
          {savedAddress && (
            <div className="rounded-xl border border-white/10 bg-ink-900/70 p-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Saved wallet</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-200">{savedAddress}</p>
            </div>
          )}
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={backToIdle} disabled={working}>
              Cancel
            </button>
            <button className="btn-primary flex-1" disabled={working || !password}>
              {working ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
      {ok && <p className="mt-3 text-xs text-accent-400">{ok}</p>}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        {savedAddress
          ? `Encrypted backup: ${shortAddr(savedAddress, 6)} · stored only in this browser.`
          : 'No local wallet on this device yet.'}
      </p>
    </div>
  )
}
