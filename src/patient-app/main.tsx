import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/manrope'
import 'bootstrap-icons/font/bootstrap-icons.min.css'
import '../styles/index.css'
import './app.css'
import { AppProviders } from '@/app/AppProviders'
import { patientAppRouter } from './router'
import { installPlatform } from '@/lib/platform'
import { isNativeApp } from './native'
import { nativePlatform } from './nativePlatform'
import { restoreSession } from './session'

// App-only styles key off this; see app.css.
document.documentElement.dataset.shell = 'app'

async function start() {
  if (isNativeApp) {
    installPlatform(nativePlatform)
    // Before rendering: the sign-in state is decided on the first render.
    await restoreSession()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={patientAppRouter} />
      </AppProviders>
    </StrictMode>,
  )
}

void start()
