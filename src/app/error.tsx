'use client' // Next requires error boundaries to be Client Components

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

/**
 * Catches render errors anywhere under the root layout — a corrupt share link,
 * a storage read that throws — and shows a way out instead of a blank screen.
 * Event-handler and async failures are NOT caught here; those are handled where
 * they happen (see the scan flow and the share actions hook).
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  // Next 16 renamed `reset`; retry re-fetches and re-renders the segment
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[error boundary]', error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <h1 className="font-display text-4xl tracking-wide text-gold mb-3">
          Something went wrong
        </h1>
        <p className="text-text-secondary text-sm mb-2">
          CheckPlease hit an error it didn&apos;t expect. Your saved splits are still saved —
          nothing was lost.
        </p>
        <p className="text-text-secondary text-sm mb-8">
          Try again, or head home and start over.
        </p>

        <div className="flex gap-3">
          <Button fullWidth onClick={() => unstable_retry()}>Try again</Button>
          <Link href="/" className="flex-1">
            <Button fullWidth variant="ghost">Back to home</Button>
          </Link>
        </div>

        {/* Matches the client report to the server log without exposing the message */}
        {error.digest && (
          <p className="text-text-secondary text-xs mt-6">Error ref: {error.digest}</p>
        )}
      </div>
    </main>
  )
}
