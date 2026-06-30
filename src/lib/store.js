const KEY = 'raffle_config'

export function saveConfig(config) {
  localStorage.setItem(KEY, JSON.stringify(config))
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearConfig() {
  localStorage.removeItem(KEY)
}
