export const DATA_CHANGED_EVENT = 'sigma:data-changed'

export function notifyDataChanged(detail?: { source?: string }) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail }))
}
