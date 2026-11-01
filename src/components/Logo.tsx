import { Link } from 'react-router-dom'

export function Logo({ to = '/', compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow">
        <svg viewBox="0 0 64 64" className="h-5 w-5" fill="none">
          <path
            d="M18 46V18l28 28V18"
            stroke="#05060a"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!compact && (
        <span className="text-lg font-extrabold tracking-tight text-white">
          Nova<span className="text-gradient">Wallet</span>
        </span>
      )}
    </Link>
  )
}
