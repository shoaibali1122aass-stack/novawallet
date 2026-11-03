import ethereumIcon from '../assets/icons/ethereum.svg'
import bnbIcon from '../assets/icons/bnb.svg'
import polygonIcon from '../assets/icons/polygon.svg'
import arbitrumIcon from '../assets/icons/arbitrum.svg'
import baseIcon from '../assets/icons/base.svg'
import usdtIcon from '../assets/icons/usdt.svg'
import usdcIcon from '../assets/icons/usdc.svg'
import daiIcon from '../assets/icons/dai.svg'
import btcIcon from '../assets/icons/btc.svg'
import solIcon from '../assets/icons/sol.svg'

const CHAIN_ICONS: Record<number, string> = {
  1: ethereumIcon,
  56: bnbIcon,
  137: polygonIcon,
  42161: arbitrumIcon,
  8453: baseIcon,
}

const TOKEN_ICONS: Record<string, string> = {
  ETH: ethereumIcon,
  WETH: ethereumIcon,
  BNB: bnbIcon,
  WBNB: bnbIcon,
  POL: polygonIcon,
  MATIC: polygonIcon,
  ARB: arbitrumIcon,
  USDT: usdtIcon,
  USDC: usdcIcon,
  DAI: daiIcon,
  BTC: btcIcon,
  SOL: solIcon,
}

type IconProps = {
  size?: number
  className?: string
}

function Fallback({ label, size = 32, className = '' }: IconProps & { label: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-white/10 font-bold text-slate-200 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}
    >
      {label.slice(0, 1).toUpperCase() || '?'}
    </span>
  )
}

export function ChainIcon({
  chainId,
  size = 32,
  className = '',
}: IconProps & { chainId: number }) {
  const src = CHAIN_ICONS[chainId]
  if (!src) return <Fallback label={String(chainId)} size={size} className={className} />
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

export function TokenIcon({
  symbol,
  size = 32,
  className = '',
}: IconProps & { symbol: string }) {
  const src = TOKEN_ICONS[symbol.toUpperCase()]
  if (!src) return <Fallback label={symbol} size={size} className={className} />
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
