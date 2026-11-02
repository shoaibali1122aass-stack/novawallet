import { useEffect, useState } from 'react'
import { toDataURL } from 'qrcode'

export function AddressQr({ value, size = 168 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setSrc(null)
    setFailed(false)
    toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size * 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setSrc(url)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [value, size])

  if (failed) return null

  return (
    <div className="w-fit rounded-2xl border border-white/10 bg-white p-2.5 shadow-lg">
      {src ? (
        <img
          src={src}
          width={size}
          height={size}
          alt={`QR code for ${value}`}
          className="block rounded-lg"
        />
      ) : (
        <div
          className="grid place-items-center rounded-lg bg-white text-[10px] text-slate-400"
          style={{ width: size, height: size }}
        >
          Generating QR…
        </div>
      )}
    </div>
  )
}
