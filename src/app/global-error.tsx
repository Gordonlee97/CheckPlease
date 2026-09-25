'use client' // Next requires error boundaries to be Client Components

import { useEffect } from 'react'
import './globals.css' // this file replaces the root layout, so it owns its styles

/**
 * Last resort: only renders when the root layout itself fails, which means the
 * normal error page (src/app/error.tsx) never mounted. Deliberately plain —
 * no fonts, no shared components — so it cannot fail for the same reason.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[global error boundary]', error)
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text-primary font-sans">
        <title>CheckPlease — something went wrong</title>
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <h1 className="text-3xl text-gold mb-3">Something went wrong</h1>
            <p className="text-text-secondary text-sm mb-8">
              CheckPlease couldn&apos;t start. Your saved splits are stored in this browser and
              are still there.
            </p>
            <button
              onClick={() => unstable_retry()}
              className="rounded-xl px-5 py-3 font-semibold text-sm bg-gold text-bg w-full"
            >
              Reload the app
            </button>
            {error.digest && (
              <p className="text-text-secondary text-xs mt-6">Error ref: {error.digest}</p>
            )}
          </div>
        </main>
      </body>
    </html>
  )
}
