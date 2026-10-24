import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { isNativeApp, ROOT_PATHS } from './native'
import { paymentReturned } from './nativePlatform'

/** Addresses on the website that the app also opens (Android App Links). */
const APP_LINK_HOST = 'app.fnphkaduna.cloud'

/**
  The app's behaviour as an Android app. Renders nothing of its own.

  - The splash screen stays until the first screen has drawn, so the patient
    never sees a blank white page while the app loads.
  - Android's back button closes an open dialog first, then steps back
    through the app, and from the dashboard or sign-in puts the app in the
    background instead of returning to a screen from another session.
  - Coming back to the app refreshes what is on screen: an appointment may
    have been approved, or a document released, while it was in the background.
    Coming back from the Remita tab also re-checks the payment.
  - Remita's return link (https://app.fnphkaduna.cloud/portal/payment/return)
    opens the app when Android verifies the app owns that address. If the
    app was waiting on the payment it just re-checks; if Android had closed
    the app meanwhile, the app opens on that page, which takes the patient
    back to booking.

  In a browser (npm run dev:patient) it does nothing.
*/
export function NativeShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const path = useRef(location.pathname)

  useEffect(() => {
    path.current = location.pathname
  }, [location.pathname])

  useEffect(() => {
    if (isNativeApp) void SplashScreen.hide()
  }, [])

  useEffect(() => {
    if (!isNativeApp) return
    const listeners = [
      App.addListener('backButton', ({ canGoBack }) => {
        const dialogs = document.querySelectorAll('dialog[open]')
        const top = dialogs[dialogs.length - 1]
        if (top) {
          // The same route as Escape: the dialog's own onCancel decides,
          // so a dialog that is saving stays open.
          top.dispatchEvent(new Event('cancel', { cancelable: true }))
          return
        }
        if (!canGoBack || ROOT_PATHS.has(path.current)) {
          void App.minimizeApp()
          return
        }
        navigate(-1)
      }),
      App.addListener('resume', () => {
        paymentReturned()
        void queryClient.invalidateQueries()
      }),
      App.addListener('appUrlOpen', ({ url }) => openAppLink(url)),
    ]
    // Started by a link while the app was closed.
    void App.getLaunchUrl().then((launch) => {
      if (launch?.url) openAppLink(launch.url)
    })
    function openAppLink(url: string) {
      let target: URL
      try {
        target = new URL(url)
      } catch {
        return
      }
      if (target.host !== APP_LINK_HOST) return
      if (paymentReturned()) return
      navigate(`${target.pathname}${target.search}`, { replace: true })
    }
    return () => {
      listeners.forEach((l) => void l.then((h) => h.remove()))
    }
  }, [navigate, queryClient])

  return <Outlet />
}
