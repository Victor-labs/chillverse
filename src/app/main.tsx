import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import ErrorBoundary from '../shared/components/ErrorBoundary'
import { AuthProvider } from '../features/auth/useAuth'
import { ThemeProvider } from '../context/ThemeContext'
import { reloadForStaleChunk } from '../shared/lib/staleChunkReload'
import './index.css'

// Vite fires this when a modulepreload link 404s — typically because a new
// deploy went out while this tab was already open. Auto-reload once to pick
// up the current build instead of leaving the user on a dead page.
window.addEventListener('vite:preloadError', () => {
  reloadForStaleChunk()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
