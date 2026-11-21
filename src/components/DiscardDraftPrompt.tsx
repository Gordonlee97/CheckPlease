import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface Props {
  // Where "Start fresh" goes: /new, or /new?group=… for a saved group
  href: string
  onCancel: () => void
}

// /new without ?resume discards the saved draft, so every way into it from a
// screen that shows "Resume split" has to pass through this first.
export function DiscardDraftPrompt({ href, onCancel }: Props) {
  return (
    <div className="flex flex-col gap-2 animate-fade-in">
      <p className="text-center text-text-secondary text-xs">
        Starting fresh discards your unfinished split.
      </p>
      <div className="flex gap-3">
        <Link href={href} className="flex-1" onClick={onCancel}>
          <Button fullWidth>Start fresh</Button>
        </Link>
        <Button fullWidth variant="ghost" onClick={onCancel}>Keep it</Button>
      </div>
    </div>
  )
}
