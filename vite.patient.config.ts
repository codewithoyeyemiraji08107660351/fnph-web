import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { renameSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

/*
  Build for the Android patient app (Capacitor).

    npm run dev:patient     http://localhost:5174, API through the dev proxy
    npm run build:patient   dist-patient/, the folder Capacitor packages

  The website build (vite.config.ts, dist/) is untouched by this file.
*/

const OUT_DIR = 'dist-patient'

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = (env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

  // Inside the app the page is served from the phone, so a relative /api
  // would point at the phone. Refuse to build an app that cannot reach the API.
  // Plain http is allowed only for a backend on this machine (localhost) or,
  // from the Android emulator, the host machine (10.0.2.2).
  const reachable = /^https:\/\/[^/]+$/.test(apiBase) || /^http:\/\/(localhost|10\.0\.2\.2)(:\d+)?$/.test(apiBase)
  if (command === 'build' && !reachable) {
    throw new Error(
      'build:patient needs VITE_API_BASE_URL set to the API origin over HTTPS, ' +
        'for example VITE_API_BASE_URL=https://app.fnphkaduna.cloud (no path, no trailing slash).',
    )
  }

  return {
    plugins: [react(), tailwindcss(), patientEntry(apiBase)],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5174,
      proxy: {
        '/api': { target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080', changeOrigin: true },
      },
    },
    build: {
      outDir: OUT_DIR,
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: { input: fileURLToPath(new URL('./patient.html', import.meta.url)) },
    },
  }
})

/**
  Serves patient.html as the app's single page and ships it as index.html,
  which is the file Capacitor opens. Also writes the API origin into the
  page's Content-Security-Policy.
*/
function patientEntry(apiBase: string): Plugin {
  return {
    name: 'fnph-patient-entry',
    // The API origin goes into the CSP. A browser preview build is marked so
    // the Android release check (android/app/build.gradle) refuses it.
    transformIndexHtml: (html) => {
      const page = html.replace('__API_ORIGIN__', apiBase)
      return process.env.VITE_NATIVE_PREVIEW === '1'
        ? page.replace('<head>', '<head>\n    <meta name="fnph-build" content="preview" />')
        : page
    },
    configureServer(server) {
      // Every page address in dev loads the patient app, as it does on the phone.
      server.middlewares.use((req, _res, next) => {
        const path = (req.url ?? '/').split('?')[0]
        const isPage = req.method === 'GET' && !path.includes('.') && !path.startsWith('/api') && !path.startsWith('/@') && !path.startsWith('/src') && !path.startsWith('/node_modules')
        if (isPage) req.url = '/patient.html'
        next()
      })
    },
    closeBundle() {
      renameSync(`${OUT_DIR}/patient.html`, `${OUT_DIR}/index.html`)
    },
  }
}
