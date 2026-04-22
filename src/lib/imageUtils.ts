// Resizes an image file client-side and returns a base64 data URL.
// Caps the long edge at maxDimension to stay under Vercel's 4.5MB body limit.
export function resizeImage(file: File, maxDimension = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const scale = Math.min(1, maxDimension / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = url
  })
}

// Strips the data:image/...;base64, prefix to get raw base64
export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1]
}
