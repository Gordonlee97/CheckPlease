import { buildQrImage, QR_MAX_CHARS } from '../src/lib/qr'

describe('buildQrImage', () => {
  it('produces a PNG data URL for a share link', async () => {
    const qr = await buildQrImage('https://checkplease.vercel.app/share#N4Igl')
    expect(qr?.dataUrl).toMatch(/^data:image\/png;base64,/)
  })

  // Rendering anywhere other than 1:1 smooths module edges and breaks scanning
  it('reports a natural size that fits the display box', async () => {
    const qr = await buildQrImage('https://checkplease.vercel.app/share#N4Igl')
    expect(qr!.size).toBeLessThanOrEqual(288)
    expect(qr!.size).toBeGreaterThan(100)
  })

  it('keeps a usable scale even for a long link', async () => {
    const qr = await buildQrImage('https://checkplease.vercel.app/share#' + 'N4IglgJiBcIC4gDQgMYCcCmBDO'.repeat(40))
    expect(qr).not.toBeNull()
    expect(qr!.size).toBeGreaterThan(100)
  }, 20000)

  it('refuses a link too long to scan reliably', async () => {
    expect(await buildQrImage('x'.repeat(QR_MAX_CHARS + 1))).toBeNull()
  })

  // Encoding a maximum-size code is genuinely slow, hence the longer timeout
  it('still handles a link right at the limit', async () => {
    expect((await buildQrImage('x'.repeat(QR_MAX_CHARS)))?.dataUrl).toMatch(/^data:image\/png;base64,/)
  }, 20000)

  it('returns null rather than throwing on empty input', async () => {
    expect(await buildQrImage('')).toBeNull()
  })
})
