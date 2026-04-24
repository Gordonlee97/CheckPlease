'use client'

import { useRef, useState, useEffect, useImperativeHandle, type Ref } from 'react'
import type { ScanResult } from '@/lib/types'
import { resizeImage, dataUrlToBase64 } from '@/lib/imageUtils'

interface Props {
  initialFile?: File
  onFileSelect?: (file: File) => void
  onDone: (result: ScanResult) => void
  ref?: Ref<{ submit: () => void }>
  onReadyChange?: (ready: boolean) => void
}

export function Scan({ initialFile, onFileSelect, onDone, ref, onReadyChange }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile ?? null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Hold the scan result until the animation has finished its full sweep
  const [pendingResult, setPendingResult] = useState<ScanResult | null>(null)
  const [animDone, setAnimDone] = useState(false)

  // Navigate only once both the API result AND the animation are ready
  useEffect(() => {
    if (pendingResult && animDone) {
      onDoneRef.current(pendingResult)
    }
  }, [pendingResult, animDone])

  const submitFnRef = useRef<() => void>(() => {})
  submitFnRef.current = () => { if (selectedFile && (status === 'idle' || status === 'error')) handleScan(selectedFile) }
  useImperativeHandle(ref, () => ({ submit: () => submitFnRef.current() }), [])

  useEffect(() => {
    onReadyChange?.(!!selectedFile && status !== 'scanning')
  }, [selectedFile, status, onReadyChange])

  // Create/revoke object URL whenever selectedFile changes
  useEffect(() => {
    if (!selectedFile) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  function handleFileSelect(file: File) {
    setSelectedFile(file)
    onFileSelect?.(file)
    setStatus('idle')
  }

  async function handleScan(file: File) {
    setStatus('scanning')
    setErrorMsg('')
    setPendingResult(null)
    setAnimDone(false)
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
      setPendingResult(result)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-1">Scan Receipt</h2>
      <p className="text-text-secondary text-sm mb-6">Take a photo or upload from your gallery.</p>

      {/* Two separate inputs — capture forces camera; no capture goes to gallery */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }} />

      {/* No file selected yet */}
      {status === 'idle' && !selectedFile && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => cameraRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-border bg-surface flex flex-col items-center justify-center py-12 gap-3 active:border-gold transition-colors"
          >
            <span className="text-4xl">📷</span>
            <span className="text-text-secondary text-sm">Take a photo</span>
          </button>
          <button
            onClick={() => galleryRef.current?.click()}
            className="w-full rounded-2xl border border-dashed border-border bg-surface flex items-center justify-center py-3 gap-2 text-text-secondary text-sm active:border-gold transition-colors"
          >
            🖼 Choose from gallery
          </button>
        </div>
      )}

      {/* File selected — show preview */}
      {status === 'idle' && selectedFile && (
        <div className="flex flex-col gap-3">
          {previewUrl && (
            <div className="rounded-2xl overflow-hidden border border-border">
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="w-full object-contain max-h-72"
              />
            </div>
          )}
          <p className="text-text-secondary text-xs text-center truncate px-2">{selectedFile.name}</p>
          <div className="flex gap-2">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex-1 rounded-2xl border border-dashed border-border bg-surface flex items-center justify-center py-3 gap-2 text-text-secondary text-sm active:border-gold transition-colors"
            >
              📷 Retake
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="flex-1 rounded-2xl border border-dashed border-border bg-surface flex items-center justify-center py-3 gap-2 text-text-secondary text-sm active:border-gold transition-colors"
            >
              🖼 Gallery
            </button>
          </div>
        </div>
      )}

      {/* Scanning — receipt dims, single slow scan line sweeps top→bottom */}
      {status === 'scanning' && (
        <div className="flex flex-col gap-3">
          {previewUrl && (
            <div className="rounded-2xl overflow-hidden border border-gold/20 relative" style={{ minHeight: 120 }}>
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="w-full object-contain max-h-72 opacity-40"
              />
              {/* Thin white scan line — linear, single pass, navigates only after this fires */}
              <div
                className="animate-scan-line-once absolute left-0 right-0 h-px pointer-events-none"
                onAnimationEnd={() => setAnimDone(true)}
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  boxShadow: '0 0 6px 3px rgba(255,255,255,0.28), 0 0 1px 0px rgba(255,255,255,0.85)',
                }}
              />
            </div>
          )}
          {/* Indeterminate progress bar */}
          <div className="relative h-0.5 bg-border rounded-full overflow-hidden">
            <div className="animate-progress-bar absolute top-0 bottom-0 left-0 w-1/3 bg-gold/70 rounded-full" />
          </div>
          <p className="text-text-secondary text-sm text-center">
            {pendingResult ? 'Almost done…' : 'Reading receipt…'}
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-4">
          {previewUrl && (
            <div className="rounded-2xl overflow-hidden border border-red-900 opacity-60">
              <img src={previewUrl} alt="Receipt preview" className="w-full object-contain max-h-48" />
            </div>
          )}
          <div className="rounded-2xl border border-red-900 bg-surface p-6 text-center">
            <p className="text-red-400 text-sm mb-1">Could not read receipt</p>
            <p className="text-text-secondary text-xs">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex-1 rounded-2xl border border-dashed border-border bg-surface flex items-center justify-center py-3 gap-2 text-text-secondary text-sm active:border-gold transition-colors"
            >
              📷 Retake
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="flex-1 rounded-2xl border border-dashed border-border bg-surface flex items-center justify-center py-3 gap-2 text-text-secondary text-sm active:border-gold transition-colors"
            >
              🖼 Gallery
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
