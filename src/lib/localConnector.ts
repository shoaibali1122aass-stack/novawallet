import { createConnector } from 'wagmi'
import { createPublicClient, createWalletClient, http, toHex, type Chain } from 'viem'
import { mainnet, bsc, polygon, arbitrum, base } from 'wagmi/chains'
import { localWalletStore } from './localWallet'
import { RPC_URLS } from './chains'

const CHAINS = [mainnet, bsc, polygon, arbitrum, base] as const
const CHAIN_BY_ID = new Map<number, Chain>(CHAINS.map((chain) => [chain.id, chain]))

type Listener = (...args: unknown[]) => void

type RpcTx = {
  to?: `0x${string}`
  value?: string
  data?: `0x${string}`
  gas?: string
  nonce?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
}

function createProvider(getChainId: () => number, setChainId: (chainId: number) => void) {
  const listeners = new Map<string, Set<Listener>>()

  function emit(event: string, ...args: unknown[]) {
    listeners.get(event)?.forEach((listener) => listener(...args))
  }

  return {
    async request({ method, params }: { method: string; params?: unknown }): Promise<unknown> {
      const account = localWalletStore.getAccount()
      if (!account) throw new Error('NovaWallet is locked.')

      const chainId = getChainId()
      const chain = CHAIN_BY_ID.get(chainId) ?? mainnet

      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [account.address]

        case 'eth_chainId':
          return toHex(chainId)

        case 'net_version':
          return String(chainId)

        case 'wallet_switchEthereumChain': {
          const next = Number((params as [{ chainId?: string }])?.[0]?.chainId)
          if (!CHAIN_BY_ID.has(next)) throw new Error('Unsupported network.')
          setChainId(next)
          emit('chainChanged', toHex(next))
          return null
        }

        case 'personal_sign': {
          const [first, second] = (params ?? []) as [string, string]
          const data = first?.toLowerCase() === account.address.toLowerCase() ? second : first
          return account.signMessage({ message: { raw: data as `0x${string}` } })
        }

        case 'eth_sign': {
          const [first, second] = (params ?? []) as [string, string]
          const data = first?.toLowerCase() === account.address.toLowerCase() ? second : first
          return account.signMessage({ message: { raw: data as `0x${string}` } })
        }

        case 'eth_sendTransaction': {
          const [tx] = params as [RpcTx]
          const client = createWalletClient({ account, chain, transport: http(RPC_URLS[chain.id]) })
          return client.sendTransaction({
            account,
            chain,
            to: tx.to,
            value: tx.value ? BigInt(tx.value) : undefined,
            data: tx.data,
            gas: tx.gas ? BigInt(tx.gas) : undefined,
            nonce: tx.nonce !== undefined ? Number(tx.nonce) : undefined,
            maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
          })
        }

        case 'eth_signTransaction': {
          const [tx] = params as [RpcTx]
          const client = createWalletClient({ account, chain, transport: http(RPC_URLS[chain.id]) })
          return client.signTransaction({
            account,
            chain,
            to: tx.to,
            value: tx.value ? BigInt(tx.value) : undefined,
            data: tx.data,
            gas: tx.gas ? BigInt(tx.gas) : undefined,
            nonce: tx.nonce !== undefined ? Number(tx.nonce) : undefined,
            maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
          })
        }

        default: {
          const client = createPublicClient({ chain, transport: http(RPC_URLS[chain.id]) })
          return client.request({ method, params } as never)
        }
      }
    },

    on(event: string, listener: Listener) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(listener)
    },

    removeListener(event: string, listener: Listener) {
      listeners.get(event)?.delete(listener)
    },
  }
}

export function localWalletConnector() {
  return createConnector((config) => {
    let chainId: number = mainnet.id
    const provider = createProvider(
      () => chainId,
      (next) => {
        chainId = next
        config.emitter.emit('change', { chainId: next })
      },
    )

    return {
      id: 'novaLocal',
      name: 'NovaWallet Local',
      type: 'novaLocal',

      async connect(parameters: { chainId?: number } = {}) {
        const account = localWalletStore.getAccount()
        if (!account) throw new Error('Create, import or unlock your NovaWallet first.')
        if (parameters.chainId) chainId = parameters.chainId
        return { accounts: [account.address] as const, chainId }
      },

      async disconnect() {
        localWalletStore.lock()
      },

      async getAccounts() {
        const account = localWalletStore.getAccount()
        return account ? ([account.address] as const) : []
      },

      async getChainId() {
        return chainId
      },

      async getProvider(parameters: { chainId?: number } = {}) {
        if (parameters.chainId) chainId = parameters.chainId
        return provider as never
      },

      async switchChain(parameters: { chainId: number }) {
        const next = CHAIN_BY_ID.get(parameters.chainId)
        if (!next) throw new Error('Unsupported network.')
        chainId = parameters.chainId
        config.emitter.emit('change', { chainId: parameters.chainId })
        return next as Chain
      },

      async isAuthorized() {
        return Boolean(localWalletStore.getAccount())
      },

      onAccountsChanged(accounts: string[]) {
        if (accounts.length === 0) config.emitter.emit('disconnect')
        else config.emitter.emit('change', { accounts: accounts as `0x${string}`[] })
      },
      onChainChanged(chain: string | number) {
        const next = Number(chain)
        if (!CHAIN_BY_ID.has(next)) return
        chainId = next
        config.emitter.emit('change', { chainId: next })
      },
      onDisconnect() {
        localWalletStore.lock()
        config.emitter.emit('disconnect')
      },
    }
  })
}
