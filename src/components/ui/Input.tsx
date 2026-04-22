import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-border bg-surface px-4 py-3 text-text-primary placeholder:text-text-secondary outline-none focus:border-gold text-sm',
        className
      )}
      {...props}
    />
  )
}
