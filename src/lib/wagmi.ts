import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { mainnet, bsc, polygon, arbitrum, base } from 'wagmi/chains'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

const connectors = [
  injected({ shimDisconnect: true }),
  ...(projectId
    ? [
        walletConnect({
          projectId,
          showQrModal: true,
          metadata: {
            name: 'NovaWallet',
            description: 'Non-custodial multi-chain portfolio wallet',
            url: typeof window !== 'undefined' ? window.location.origin : 'https://novawallet.app',
            icons: ['/favicon.svg'],
          },
        }),
      ]
    : []),
]

export const wagmiConfig = createConfig({
  chains: [mainnet, bsc, polygon, arbitrum, base],
  connectors,
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
