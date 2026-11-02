import { mainnet, bsc, polygon, arbitrum, base } from 'wagmi/chains'
import { erc20Abi } from 'viem'

export type Token = {
  symbol: string
  name: string
  address: `0x${string}`
  decimals: number
}

export const SUPPORTED_CHAINS = [mainnet, bsc, polygon, arbitrum, base] as const

export type SupportedChainId = 1 | 56 | 137 | 42161 | 8453

export const RPC_URLS: Record<number, string> = {
  [mainnet.id]: 'https://ethereum-rpc.publicnode.com',
  [bsc.id]: 'https://bsc-rpc.publicnode.com',
  [polygon.id]: 'https://polygon-bor-rpc.publicnode.com',
  [arbitrum.id]: 'https://arbitrum-one-rpc.publicnode.com',
  [base.id]: 'https://base-rpc.publicnode.com',
}

export const TOKENS: Record<number, Token[]> = {
  [mainnet.id]: [
    { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  ],
  [bsc.id]: [
    { symbol: 'USDT', name: 'Binance-Peg BSC-USD', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    { symbol: 'USDC', name: 'Binance-Peg USD Coin', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
    { symbol: 'DAI', name: 'Binance-Peg Dai', address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', decimals: 18 },
  ],
  [polygon.id]: [
    { symbol: 'USDT', name: 'Tether USD (PoS)', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    { symbol: 'USDC', name: 'USD Coin (native)', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
    { symbol: 'DAI', name: 'Dai Stablecoin (PoS)', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18 },
  ],
  [arbitrum.id]: [
    { symbol: 'USDT', name: 'Tether USD', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    { symbol: 'USDC', name: 'USD Coin', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    { symbol: 'DAI', name: 'Dai Stablecoin', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 },
  ],
  [base.id]: [
    { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    { symbol: 'USDT', name: 'Tether USD', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6 },
    { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 },
  ],
}

export const CHAIN_META: Record<number, { label: string; coin: string; explorer: string; color: string }> = {
  [mainnet.id]: { label: 'Ethereum', coin: 'ETH', explorer: 'https://etherscan.io', color: '#627eea' },
  [bsc.id]: { label: 'BNB Chain', coin: 'BNB', explorer: 'https://bscscan.com', color: '#f3ba2f' },
  [polygon.id]: { label: 'Polygon', coin: 'POL', explorer: 'https://polygonscan.com', color: '#8247e5' },
  [arbitrum.id]: { label: 'Arbitrum', coin: 'ETH', explorer: 'https://arbiscan.io', color: '#28a0f0' },
  [base.id]: { label: 'Base', coin: 'ETH', explorer: 'https://basescan.org', color: '#0052ff' },
}

export { erc20Abi }
