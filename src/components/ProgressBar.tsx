'use client'

import { Fragment } from 'react'
import { cn } from '@/lib/cn'
import type { Step } from '@/lib/types'

const STEPS: { key: Step; label: string }[] = [
  { key: 'people', label: 'People' },
  { key: 'scan',   label: 'Scan'   },
  { key: 'review', label: 'Review' },
  { key: 'assign', label: 'Assign' },
  { key: 'summary', label: 'Totals' },
]

const STEP_ORDER: Step[] = ['people', 'scan', 'review', 'assign', 'summary']

interface Props {
  current: Step
  completed: Set<Step>
  onNavigate: (step: Step) => void
}

export function ProgressBar({ current, completed, onNavigate }: Props) {
  const currentIdx = STEP_ORDER.indexOf(current)

  return (
    <div className="flex items-center mb-6">
      {STEPS.map((step, idx) => {
        const isDone = completed.has(step.key)
        const isCurrent = step.key === current

        return (
          <Fragment key={step.key}>
            {/* Dot + label button — natural width so labels drive spacing */}
            <button
              onClick={() => isDone && onNavigate(step.key)}
              disabled={!isDone}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div className="w-3.5 h-3.5 flex items-center justify-center">
                <div className={cn(
                  'rounded-full transition-all duration-300',
                  isCurrent ? 'w-3.5 h-3.5 bg-gold' :
                  isDone    ? 'w-2 h-2 bg-gold/50'   :
                              'w-2 h-2 bg-border'
                )} />
              </div>
              <span className={cn(
                'text-[11px] uppercase tracking-wider leading-none select-none whitespace-nowrap',
                isCurrent ? 'text-gold' :
                isDone    ? 'text-text-secondary' :
                            'text-border'
              )}>
                {step.label}
              </span>
            </button>

            {/* Connector line — flex-1 so all lines share remaining space equally */}
            {idx < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-px mb-[18px] min-w-2 transition-colors duration-500',
                idx < currentIdx ? 'bg-gold/40' : 'bg-border'
              )} />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
