import type { ReactNode } from 'react'
import type { Portal } from '@/lib/auth/roles'

export function AuthCard({ portal = 'core', children }: { portal?: Portal; children: ReactNode }) {
  return (
    <div data-portal={portal} className="px-4 py-12 sm:py-20">
      <div className="card relative mx-auto max-w-md overflow-hidden p-6 shadow-[var(--shadow-lift)] sm:p-8">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-accent" />
        {children}
      </div>
    </div>
  )
}
