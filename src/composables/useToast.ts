import { ref } from 'vue'

export interface Toast {
  id: number
  kind: 'info' | 'error'
  text: string
}

const toasts = ref<Toast[]>([])
let nextId = 1

export function useToast() {
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  function show(text: string, kind: Toast['kind'] = 'info', ms = 6000) {
    const id = nextId++
    toasts.value = [...toasts.value, { id, kind, text }]
    if (ms > 0) setTimeout(() => dismiss(id), ms)
  }
  return { toasts, show, dismiss }
}
