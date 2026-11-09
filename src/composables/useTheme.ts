import { ref, watch } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'
export const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark']

const STORAGE_KEY = 'composemapview.theme'

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Tema aktif. "system" mengikuti prefers-color-scheme (token di main.css). */
export const theme = ref<ThemeMode>(readStored())

watch(
  theme,
  (mode) => {
    if (typeof document !== 'undefined') {
      if (mode === 'system') delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = mode
    }
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // Penyimpanan diblokir: tema tetap berlaku untuk sesi ini.
    }
  },
  { immediate: true },
)

export function cycleTheme() {
  theme.value = THEME_MODES[(THEME_MODES.indexOf(theme.value) + 1) % THEME_MODES.length]!
}

/** Boolean kecil yang diingat per browser (mis. panel yang diciutkan). */
export function usePersistentFlag(key: string, initial = false) {
  const full = `composemapview.${key}`
  let start = initial
  try {
    const v = localStorage.getItem(full)
    if (v !== null) start = v === '1'
  } catch {
    // abaikan
  }
  const flag = ref(start)
  watch(flag, (v) => {
    try {
      localStorage.setItem(full, v ? '1' : '0')
    } catch {
      // abaikan
    }
  })
  return flag
}
