const KEY = 'checkplease:user-settings'

interface UserSettings {
  venmoHandle?: string
}

function getSettings(): UserSettings {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch { return {} }
}

function saveSettings(settings: UserSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(settings))
}

export function getMyVenmoHandle(): string | undefined {
  return getSettings().venmoHandle || undefined
}

export function setMyVenmoHandle(handle: string): void {
  const trimmed = handle.replace(/^@/, '').trim()
  saveSettings({ ...getSettings(), venmoHandle: trimmed || undefined })
}
