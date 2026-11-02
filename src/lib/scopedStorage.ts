function keyFor(base: string, userId?: string | null) {
  return userId ? `${base}:${userId}` : base
}

export function scopedGet(base: string, userId?: string | null): string | null {
  try {
    const key = keyFor(base, userId)
    const current = localStorage.getItem(key)
    if (current !== null) return current
    if (userId) {
      const legacy = localStorage.getItem(base)
      if (legacy !== null) {
        localStorage.setItem(key, legacy)
        localStorage.removeItem(base)
        return legacy
      }
    }
    return null
  } catch {
    return null
  }
}

export function scopedSet(base: string, userId: string | null | undefined, value: string) {
  try {
    localStorage.setItem(keyFor(base, userId), value)
  } catch {
    /* storage unavailable */
  }
}

export function scopedRemove(base: string, userId?: string | null) {
  try {
    localStorage.removeItem(keyFor(base, userId))
  } catch {
    /* storage unavailable */
  }
}
