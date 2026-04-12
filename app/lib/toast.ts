export function showToast(msg: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('filmo-toast', { detail: msg }))
  }
}
