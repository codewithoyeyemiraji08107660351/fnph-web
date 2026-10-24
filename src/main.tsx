import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/manrope'
import 'bootstrap-icons/font/bootstrap-icons.min.css'
import './styles/index.css'
import { AppProviders } from './app/AppProviders'
import { router } from './app/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
