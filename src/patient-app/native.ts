import { Capacitor } from '@capacitor/core'

/**
  True inside the Android app, false in a browser (including dev:patient).

  VITE_NATIVE_PREVIEW=1 turns the app's code paths on in a browser, where
  Capacitor's plugins fall back to browser versions (storage in
  localStorage, files in IndexedDB). For testing those paths only; never
  set it for a build that goes on a phone.
*/
export const isNativeApp = Capacitor.isNativePlatform() || import.meta.env.VITE_NATIVE_PREVIEW === '1'

/**
  Screens where Android's back button leaves the app rather than stepping
  back: going "back" from the dashboard or sign-in would land on a stale
  screen from before sign-in or sign-out.
*/
export const ROOT_PATHS = new Set(['/', '/sign-in', '/patients', '/portal'])
