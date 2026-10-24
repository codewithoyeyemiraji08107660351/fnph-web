import { Browser } from '@capacitor/browser'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileOpener } from '@capacitor-community/file-opener'
import { Share } from '@capacitor/share'
import type { Platform } from '@/lib/platform'

/*
  The Android app's versions of the platform calls (see src/lib/platform.ts).
*/

// ---------------------------------------------------------------- payment

/*
  Remita opens in a browser tab over the app instead of replacing the app.
  The patient comes back by closing the tab, by Android's back button, or
  through Remita's return link when Android hands it to the app (App Links).
  Every one of those ends in paymentReturned(), which re-checks the status.
  The check is harmless to repeat, so it runs on each return.
*/
let onPaymentReturn: (() => void) | null = null

export function paymentReturned(): boolean {
  if (!onPaymentReturn) return false
  onPaymentReturn()
  return true
}

async function openPayment(url: string, onReturn: () => void) {
  onPaymentReturn = onReturn
  const finished = await Browser.addListener('browserFinished', () => {
    void finished.remove()
    paymentReturned()
  })
  await Browser.open({ url, toolbarColor: '#075b45' })
}

// ---------------------------------------------------------------- documents

/*
  Each prescription or request can be downloaded once. A download link does
  nothing inside an app, so the file is written to the app's private storage
  and opened in the phone's PDF viewer. The copy stays, and "Open saved copy"
  reopens it without using another download.
*/
const DOCS = 'documents'
const safe = (s: string) => s.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'document.pdf'

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'))
    reader.readAsDataURL(blob)
  })
}

async function show(path: string, directory: Directory, contentType: string) {
  const { uri } = await Filesystem.getUri({ path, directory })
  try {
    await FileOpener.open({ filePath: uri, contentType, openWithDefault: true })
  } catch {
    // No PDF viewer installed: the share sheet still lets the patient save,
    // print or send it.
    await Share.share({ title: path.split('/').pop(), files: [uri] }).catch(() => undefined)
  }
}

async function saveFile(blob: Blob, filename: string, key: string) {
  const path = `${DOCS}/${safe(key)}/${safe(filename)}`
  const data = await toBase64(blob)
  let directory = Directory.Data
  try {
    await Filesystem.writeFile({ path, data, directory, recursive: true })
  } catch {
    // Private storage refused (full or locked): keep it for this session at least.
    directory = Directory.Cache
    try {
      await Filesystem.writeFile({ path, data, directory, recursive: true })
    } catch {
      throw new Error(
        'The document was downloaded but this phone could not store it. Free some space, then contact the hospital so they can allow another download.',
      )
    }
  }
  await show(path, directory, blob.type || 'application/pdf')
  return 'Saved in the app. Use Open saved copy to see it again.'
}

async function openSaved(key: string) {
  for (const directory of [Directory.Data, Directory.Cache]) {
    try {
      const { files } = await Filesystem.readdir({ path: `${DOCS}/${safe(key)}`, directory })
      const file = files.find((f) => f.type === 'file')
      if (file) {
        await show(`${DOCS}/${safe(key)}/${file.name}`, directory, 'application/pdf')
        return true
      }
    } catch {
      // Not in this directory.
    }
  }
  return false
}

// ---------------------------------------------------------------- video

/*
  Asking here makes Android show its camera and microphone prompt before the
  room loads, in the app's name. The video room in its frame then has them.
*/
async function prepareCall() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return { ok: true } as const
  } catch {
    return {
      ok: false,
      message:
        'The doctor may not see or hear you. To fix it: open Settings, Apps, FNPH Telepsychiatry, Permissions, and allow Camera and Microphone, then rejoin. If you cannot, stay on this screen: the doctor can continue by phone.',
    } as const
  }
}

export const nativePlatform: Partial<Platform> = {
  openPayment,
  saveFile,
  keepsFiles: true,
  openSaved,
  prepareCall,
}
