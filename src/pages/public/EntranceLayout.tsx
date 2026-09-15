import type { ReactNode } from 'react'
import type { Portal } from '@/lib/auth/roles'

/** Copy on the left, the sign-in card on the right. Mirrors the prototype staff and centre landings. */
export function EntranceLayout({ portal, children, card }: { portal: Portal; children: ReactNode; card: ReactNode }) {
  const wash =
    portal === 'core'
      ? 'bg-[linear-gradient(160deg,#f6f9fb_0%,#e6eef4_100%)]'
      : portal === 'centre'
        ? 'bg-[linear-gradient(160deg,#fbf8f2_0%,#f3eadb_100%)]'
        : 'bg-[linear-gradient(160deg,#f7faf8_0%,#e9f2ee_100%)]'
  return (
    <div data-portal={portal} className={wash}>
      <div className="mx-auto grid max-w-[1320px] items-start gap-10 px-5 py-12 lg:grid-cols-[1.1fr_0.8fr] lg:gap-20 lg:py-20">
        <div className="lg:pt-6">{children}</div>
        <div className="card relative order-first overflow-hidden p-6 shadow-[var(--shadow-lift)] sm:p-8 lg:order-none lg:sticky lg:top-28">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-accent" />
          {card}
        </div>
      </div>
    </div>
  )
}
