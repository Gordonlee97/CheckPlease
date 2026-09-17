import type { HTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>
}

export function Card({ className, children, ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      className={cn('rounded-2xl border border-border bg-surface p-4', className)}
      {...props}
    >
      {children}
    </div>
  )
}
