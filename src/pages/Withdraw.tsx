import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SendPanel } from '../components/SendPanel'
import { BtcCard } from '../components/BtcCard'
import { SolCard } from '../components/SolCard'

export default function Withdraw() {
  const { profile } = useAuth()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Withdraw / Send</h1>
          <p className="mt-1 text-sm text-slate-400">
            Withdraw by sending crypto from your own wallet. Every transfer is signed on your device.
          </p>
        </div>
        <Link to="/deposit" className="btn-secondary w-fit">
          Go to deposit →
        </Link>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SendPanel />

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-bold text-white">Before you withdraw</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-400">
              <li>• The recipient address must be a valid EVM address (0x…).</li>
              <li>• Keep enough native gas (ETH / BNB / POL) for the network fee.</li>
              <li>• Withdrawals are EVM only. BTC and SOL stay in the wallet that controls them.</li>
              <li>• Transactions cannot be reversed once confirmed on-chain.</li>
            </ul>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Withdrawal lock</h2>
              <span
                className={`badge ${
                  profile?.withdrawal_lock
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-white/10 bg-white/5 text-slate-400'
                }`}
              >
                {profile?.withdrawal_lock ? 'Enabled' : 'Off'}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {profile?.withdrawal_lock
                ? 'A wallet signature and a fresh email code are required before the send form unlocks.'
                : 'Enable the withdrawal lock in Security to require a wallet signature plus an email code before sending.'}
            </p>
            <Link to="/security" className="btn-secondary mt-3 w-full">
              Manage withdrawal lock
            </Link>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-bold text-white">Bitcoin &amp; Solana</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              BTC and SOL are watch-only in NovaWallet. To withdraw them, open the wallet app that holds those keys and
              send to the recipient from there.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-accent-400">
              🔔 Withdrawal submitted and confirmed updates appear in the notification bell and are also sent to your email.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Bitcoin &amp; Solana balances</h2>
        <p className="mt-1 text-xs text-slate-500">
          These balances are read from the addresses saved to your account. Withdrawals happen in the wallet that holds
          the keys.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <BtcCard />
          <SolCard />
        </div>
      </div>
    </div>
  )
}
