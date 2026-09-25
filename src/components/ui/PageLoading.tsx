// Fades in after 120ms, so a load that resolves quickly never flashes this —
// but a slow one shows something instead of an empty screen.
export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <p role="status" className="text-text-secondary text-sm animate-fade-in-delayed">
        {label}
      </p>
    </main>
  )
}
