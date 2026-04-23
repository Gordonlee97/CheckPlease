'use client'

import { useRef, useState } from 'react'
import type { ScanResult } from '@/lib/types'
import { resizeImage, dataUrlToBase64 } from '@/lib/imageUtils'
import { Button } from '@/components/ui/Button'

interface Props {
  initialFile?: File
  onFileSelect?: (file: File) => void
  onDone: (result: ScanResult) => void
}

export function Scan({ initialFile, onFileSelect, onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile ?? null)
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleFile(file: File) {
    setSelectedFile(file)
    onFileSelect?.(file)
    setStatus('scanning')
    setErrorMsg('')
    try {
      const dataUrl = await resizeImage(file)
      const base64 = dataUrlToBase64(dataUrl)

      const form = new FormData()
      form.append('image', base64)

      const res = await fetch('/api/scan', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Scan failed')
      }
      const result: ScanResult = await res.json()
      onDone(result)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-1">Scan Receipt</h2>
      <p className="text-text-secondary text-sm mb-6">Take a photo or upload from your gallery.</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />

      {status === 'idle' && !selectedFile && (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-2xl border-2 border-dashed border-border bg-surface flex flex-col items-center justify-center py-16 gap-3 active:border-gold transition-colors"
        >
          <span className="text-4xl">📷</span>
          <span className="text-text-secondary text-sm">Tap to take photo</span>
          <span className="text-text-secondary text-xs">or choose from gallery</span>
        </button>
      )}

      {status === 'idle' && selectedFile && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-border bg-surface p-4 flex items-center gap-3">
            <span className="text-2xl">🧾</span>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-text-secondary text-xs mt-0.5">Ready to scan</p>
            </div>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-2xl border border-dashed border-border bg-surface flex items-center justify-center py-4 gap-2 text-text-secondary text-sm active:border-gold transition-colors"
          >
            📷 Use a different photo
          </button>
          <Button fullWidth onClick={() => handleFile(selectedFile)}>
            Scan Receipt →
          </Button>
        </div>
      )}

      {status === 'scanning' && (
        <div className="w-full rounded-2xl border border-border bg-surface flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-4xl animate-pulse">🧾</span>
          <span className="text-text-secondary text-sm">Reading receipt…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-red-900 bg-surface p-6 text-center">
            <p className="text-red-400 text-sm mb-1">Could not read receipt</p>
            <p className="text-text-secondary text-xs">{errorMsg}</p>
          </div>
          <Button fullWidth onClick={() => { setStatus('idle'); inputRef.current?.click() }}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}
