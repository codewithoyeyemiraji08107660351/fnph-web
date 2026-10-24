# FNPH Telepsychiatry: Android patient app

The Android app is the patient portal only, packaged with Capacitor 8 from
the same code as the website. Staff and centre screens are not in it.

| | |
| --- | --- |
| App id | `ng.fnphkaduna.patient` (permanent once on the Play Store) |
| App name | FNPH Telepsychiatry |
| Android | 7.0 and later (API 24), targets API 36 |
| Web build | `dist-patient/`, from `patient.html` and `src/patient-app/` |
| API | `VITE_API_BASE_URL` in `.env.patient` (https://app.fnphkaduna.cloud) |

## One-time setup on your computer

1. Install Android Studio (latest stable). It brings the Android SDK and JDK 21.
2. Install Node 20 or later.
3. In this repo: `npm ci`

## Backend setting (once per environment)

The app's pages are served from the phone at `https://localhost`, so the API
must allow that origin. In Dokploy, backend service, environment:

```
CORS_ALLOWED_ORIGINS=https://app.fnphkaduna.cloud,https://localhost
```

Redeploy the backend. Without this every request from the app fails with a
CORS error and sign-in shows a network error.

## Build and run

```bash
npm run android:sync     # builds dist-patient/ and copies it into android/
npm run android:open     # opens the project in Android Studio
```

In Android Studio: wait for Gradle sync, pick a device or emulator, press Run.
For an APK file: Build > Build App Bundle(s) / APK(s) > Build APK(s).
The file lands in `android/app/build/outputs/apk/debug/`.

Run `npm run android:sync` after every web change. Android Studio shows the
last synced build, not your source files.

## Release build (Play Store)

The full Play Console walk-through is in the "FNPH Patient App: Play Store Release Guide" doc.

1. **Upload key, once.** Create it on a trusted computer and keep the file and passwords in FNPH's password manager.
   Losing it means asking Google to reset the upload key; publishing someone else's build needs it too.
   ```bash
   keytool -genkeypair -v -keystore fnph-upload-key.jks -alias fnph-upload -keyalg RSA -keysize 4096 -validity 10000
   ```
2. **Point the build at it.** Copy `android/keystore.properties.example` to `android/keystore.properties` and fill it in.
   Never commit it (it is in `.gitignore`). A build server can use the `FNPH_UPLOAD_*` environment variables instead.
3. **Raise the version** in `android/app/version.properties`: `VERSION_CODE` up by one, `VERSION_NAME` as patients see it.
4. **Build the bundle:**
   ```bash
   npm run android:bundle
   ```
   On Windows: `npm run android:sync`, then in Android Studio use Build > Generate Signed App Bundle / APK.
   The file is `android/app/build/outputs/bundle/release/app-release.aab`.

The release build refuses to run if the synced web app was built for testing (Chrome debugging,
plain http, a local API address, or `VITE_NATIVE_PREVIEW`) or if no upload key is set. Run
`npm run android:sync` with no test settings and try again.

Store graphics are in `store/`: `icon-512.png`, `feature-graphic-1024x500.png` and five phone
screenshots (1080 x 1920) taken from the app with a made-up patient.

## Against a backend on your own computer

```bash
VITE_API_BASE_URL=http://10.0.2.2:8080 CAP_CLEARTEXT=1 CAP_DEBUG=1 npm run android:sync
```

`10.0.2.2` is your computer as seen from the Android emulator. `CAP_CLEARTEXT`
allows plain http and `CAP_DEBUG` lets Chrome's `chrome://inspect` attach to
the app. Never ship a build made with either.

## Payment return link (Android App Links)

Remita sends the patient back to `https://app.fnphkaduna.cloud/portal/payment/return`.
The app claims that address, so Android opens the app instead of the browser
tab. Android only allows it once the website proves the app is FNPH's, with
`public/.well-known/assetlinks.json` (served by nginx with the website).

1. Get the SHA-256 fingerprint of the key that signs the app:
   - Play Store builds: Play Console > the app > Test and release > App integrity >
     App signing > "SHA-256 certificate fingerprint" (the app signing key, not the upload key).
   - Debug builds on your own phone:
     `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`
2. Put it in `public/.well-known/assetlinks.json` in place of
   `REPLACE_WITH_APP_SIGNING_KEY_SHA256` (several are allowed, comma-separated in the list).
3. Deploy the website. Check `https://app.fnphkaduna.cloud/.well-known/assetlinks.json`
   returns the file.
4. Reinstall the app, then check: `adb shell pm get-app-links ng.fnphkaduna.patient`
   should show `app.fnphkaduna.cloud: verified`.

Until then payment still works: the patient closes the Remita tab and the app
re-checks the payment on return.

## What the app does differently from the website

All of it is in `src/patient-app/nativePlatform.ts` and `session.ts`, plugged
into shared screens through `src/lib/platform.ts`. The website never loads it.

| Area | Website | App |
| --- | --- | --- |
| Payment | Page goes to Remita and back | Remita opens in a tab over the app; the app re-checks on return |
| Documents | Browser download | Saved in the app's private storage and opened in the PDF viewer; **Open saved copy** reopens it without using a download |
| Staying signed in | This tab only | Encrypted phone storage (Android Keystore), reused only within the inactivity limit (30 minutes) |
| Video room | The room asks for camera and microphone | Android asks before the room loads; if refused, the patient is told how to allow them and still joins |

## Test on a phone before release

1. Sign in, close the app from the recent-apps screen, reopen within 30 minutes: still signed in.
2. Leave it more than 30 minutes, reopen: asked to sign in.
3. Sign out from the navigation row: reopening asks to sign in.
4. Book up to payment, pay in the Remita tab, close the tab: "Payment confirmed" and the calendar.
5. Download a released prescription: it opens in the PDF viewer. Back in the app, **Open saved copy** opens it again.
6. Join a consultation: Android asks for camera and microphone; the doctor sees and hears you.
7. Deny camera, join again: the warning explains how to allow it.
8. Back button: closes a dialog, steps back, and from the dashboard sends the app to the background.

## Before release (server side)

- [ ] `REMITA_ACCEPT_CHARGE_SUCCESS_AS_PAID` is not set, or is `false`, on the backend.
      When it is true, Remita's "charge created" reply counts as paid and a
      patient can book without paying. The backend logs
      `REMITA TEST MODE IS ON IN PRODUCTION` at start-up while it is on.
- [ ] One real payment made end to end on the live Remita account, and
      confirmed by the server (Finance > Patient payments shows it verified).
- [ ] `CORS_ALLOWED_ORIGINS` includes `https://localhost`.
- [ ] `assetlinks.json` carries the Play app-signing SHA-256 and is live.
- [ ] Patient reset limits suit the hospital. Defaults, changeable through
      backend environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PATIENT_RESETS_PER_ACCOUNT_PER_DAY` | 3 | Self-service resets per patient account in 24 hours; then the helpdesk resets it |
| `PATIENT_RESETS_PER_IP_PER_HOUR` | 10 | Reset lookups from one connection in an hour, found or not |
| `PATIENT_RESET_TOKEN_MINUTES` | 10 | How long a reset stays usable |
| `APPLICATION_SECURITY_AUTH_MAX_FAILED_ATTEMPTS_PER_IP` | 30 | Failed sign-ins from one connection in 15 minutes before it is paused |

## Testing the app's code in a browser

`VITE_NATIVE_PREVIEW=1` turns the app code paths on in a browser, with
Capacitor's browser fallbacks (localStorage, IndexedDB). For local testing only:

```bash
VITE_NATIVE_PREVIEW=1 VITE_API_BASE_URL=http://localhost:8080 npm run build:patient
```

Never sync a build made with it into `android/`.

## Changing the icon or splash

Edit the sources in `assets/` (1024 px icon, 2732 px splash), then:

```bash
npx @capacitor/assets generate --android --iconBackgroundColor '#ffffff' --splashBackgroundColor '#075b45'
```

## What the app adds on top of the website

- `src/patient-app/router.tsx`: patient routes only, sign-in first.
- `src/patient-app/NativeShell.tsx`: splash, Android back button, refresh on return.
- `src/patient-app/app.css`: app-only layout tweaks, keyed off `html[data-shell=app]`.
- `android/app/src/main/AndroidManifest.xml`: camera and microphone for the
  video room, no cloud backup of app data.
