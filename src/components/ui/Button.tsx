import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'ghost'
  fullWidth?: boolean
}

export function Button({ variant = 'gold', fullWidth, className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-xl px-5 py-3 font-semibold text-sm transition-opacity active:opacity-70 disabled:opacity-40',
        variant === 'gold' && 'bg-gradient-to-r from-gold to-gold-dark text-bg',
        variant === 'ghost' && 'border border-border text-text-primary bg-surface',
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
