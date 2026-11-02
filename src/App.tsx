import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Deposit from './pages/Deposit'
import Withdraw from './pages/Withdraw'
import Swap from './pages/Swap'
import Security from './pages/Security'
import Support from './pages/Support'
import Admin from './pages/Admin'
import Setup from './pages/Setup'
import { Layout } from './components/Layout'
import { AdminGate, ProtectedRoute } from './components/Guards'
import { APP_VERSION } from './lib/version'

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/deposit" element={<Deposit />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/swap" element={<Swap />} />
          <Route path="/security" element={<Security />} />
          <Route path="/support" element={<Support />} />
          <Route
            path="/admin"
            element={
              <AdminGate>
                <Admin />
              </AdminGate>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <div className="pointer-events-none fixed bottom-2 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 bg-ink-950/85 px-2.5 py-0.5 font-mono text-[10px] text-slate-500 backdrop-blur">
      v{APP_VERSION}
    </div>
    </>
  )
}
