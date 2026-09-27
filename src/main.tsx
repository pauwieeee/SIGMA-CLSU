import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// A page that remains open while Vercel publishes a new deployment can still
// reference a lazy-loaded chunk from the previous build. Vite emits this event
// when that chunk can no longer be fetched. Reload once for that exact failed
// asset so the browser receives the current index and asset manifest.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()

  const payload = event.payload
  const failedAsset = payload instanceof Error ? payload.message : String(payload ?? 'unknown-chunk')
  const recoveryKey = `sigma:chunk-recovery:${failedAsset}`

  if (sessionStorage.getItem(recoveryKey)) return

  sessionStorage.setItem(recoveryKey, 'attempted')
  const url = new URL(window.location.href)
  url.searchParams.set('_app_refresh', Date.now().toString())
  window.location.replace(url)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
