import QRCode from 'qrcode'

// A share link carries the whole split, so it can get long. QR byte mode tops
// out at 2953 characters, but a code that dense is slow and unreliable to scan
// off a phone screen across a table, so we stop short of the hard limit.
export const QR_MAX_CHARS = 2000

const MARGIN = 2 // quiet zone, in modules
const TARGET_PX = 288 // display box; the code is rendered 1:1 inside it
const MIN_SCALE = 2 // pixels per module below which scanning gets unreliable

export interface QrImage {
  dataUrl: string
  /** Natural width in pixels. Render at exactly this size: scaling a QR in CSS
   * smooths module edges and breaks scanning (verified by decoding screenshots). */
  size: number
}

// Draws on a canvas, so this only produces an image in a browser; anywhere
// else (jsdom, SSR) it returns null and the UI shows its fallback.
export async function buildQrImage(text: string): Promise<QrImage | null> {
  if (!text || text.length > QR_MAX_CHARS) return null
  try {
    // Pick whole pixels per module so the image needs no resizing to fit
    const modules = QRCode.create(text, { errorCorrectionLevel: 'L' }).modules.size + MARGIN * 2
    const scale = Math.max(MIN_SCALE, Math.floor(TARGET_PX / modules))

    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'L', // least redundancy — the link is long, the screen is clean
      margin: MARGIN,
      scale,
      color: { dark: '#0f0e0a', light: '#f5f0e8' },
    })
    return { dataUrl, size: modules * scale }
  } catch {
    return null
  }
}
