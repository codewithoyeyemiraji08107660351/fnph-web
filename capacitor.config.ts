import type { CapacitorConfig } from '@capacitor/cli'

/*
  The Android patient app.

  It packages dist-patient/, the patient-only build (npm run build:patient).
  Pages are served from the phone at https://localhost, so the API must allow
  that origin (CORS_ALLOWED_ORIGINS on the backend) and the build must name
  the API's own address in VITE_API_BASE_URL.

  The app id is permanent once the app is on the Play Store.
*/
const config: CapacitorConfig = {
  appId: 'ng.fnphkaduna.patient',
  appName: 'FNPH Telepsychiatry',
  webDir: 'dist-patient',
  android: {
    // Never load http content inside an https page.
    allowMixedContent: false,
    // Debug builds only: lets Chrome's chrome://inspect attach to the app.
    webContentsDebuggingEnabled: process.env.CAP_DEBUG === '1',
  },
  server: {
    androidScheme: 'https',
    // A backend on the developer's machine, reached from the emulator as
    // http://10.0.2.2:8080, needs plain http. Off unless asked for.
    cleartext: process.env.CAP_CLEARTEXT === '1',
  },
  plugins: {
    SplashScreen: {
      // The app hides it as soon as its first screen has drawn. The 3 second
      // limit is only a safety net, so a page that fails to load shows its
      // error instead of an endless splash.
      launchAutoHide: true,
      launchShowDuration: 3000,
      backgroundColor: '#075b45',
      showSpinner: false,
    },
    // Built into Capacitor 8. The page is laid out between the status bar
    // and the navigation bar (patient.html does not ask for viewport-fit=cover),
    // so no screen needs safe-area padding. Dark icons on the white strip.
    SystemBars: {
      insetsHandling: 'native',
      style: 'LIGHT',
    },
  },
}

export default config
