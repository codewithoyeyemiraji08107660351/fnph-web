import type { HTMLAttributes, ReactNode } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  /** "lift" gives the Y-axis nudge; "slide" gives X; "still" disables motion. */
  motion?: 'lift' | 'slide' | 'still'
}

const BASE =
  'rounded-xl border border-line bg-white p-5 shadow-sm ' +
  'dark:bg-surface-2 ' +
  'transition-transform transition-shadow duration-300 ease-out ' +
  'motion-reduce:transition-none'

const MOTION: Record<NonNullable<CardProps['motion']>, string> = {
  lift: 'hover:-translate-y-1 hover:shadow-lg motion-reduce:hover:translate-y-0',
  slide: 'hover:translate-x-1 hover:shadow-lg motion-reduce:hover:translate-x-0',
  still: '',
}

export function Card({ children, motion = 'lift', className = '', ...rest }: CardProps) {
  return (
    <div className={`${BASE} ${MOTION[motion]} ${className}`} {...rest}>
      {children}
    </div>
  )
}