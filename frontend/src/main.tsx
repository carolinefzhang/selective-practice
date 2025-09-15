import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app.tsx'
import { BrowserRouter } from 'react-router-dom'
import { Auth0ProviderWithNavigate } from './auth/auth0-provider-with-navigate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Auth0ProviderWithNavigate>
        <App />
      </Auth0ProviderWithNavigate>
    </BrowserRouter>
  </StrictMode>,
)
