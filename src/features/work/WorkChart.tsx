import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { WorkSummary } from '@/lib/api/types'
import { formatCount, formatShortDay } from '@/pages/hub/dashboard/dashboard'

const HEIGHT = 200
const PAD = { top: 12, right: 8, bottom: 26, left: 32 }
const MAX_BAR = 24

/**
 * Smallest "nice" ceiling (1, 2, 5 x 10^n) at or above the data, kept even so
 * the midline is a whole number: these are counts of people.
 */
function niceMax(value: number): number {
  if (value <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 5, 10]) {
    const ceiling = step * power
    if (ceiling >= value) return ceiling % 2 === 0 ? ceiling : ceiling + 1
  }
  return 10 * power
}

/** A column rounded only at its data end: 4px top corners, square at the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(el)
    setWidth(Math.floor(el.getBoundingClientRect().width))
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * Daily counts for one measure at a time. One series, so no legend: the
 * measure buttons name what is plotted. Every value is also in the table view.
 * The same chart as the Hub dashboard's, fed by whichever measures the role has.
 */
export function WorkChart({ days, measures }: { days: WorkSummary['daily']; measures: WorkSummary['measures'] }) {
  const [picked, setMeasure] = useState<string | null>(null)
  const measure = picked && measures.some((m) => m.key === picked) ? picked : measures[0]?.key ?? ''
  const [showTable, setShowTable] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const [ref, width] = useWidth<HTMLDivElement>()

  const current = measures.find((m) => m.key === measure) ?? { key: '', label: '', noun: '' }
  const values = days.map((d) => d.values[measure] ?? 0)
  const total = values.reduce((a, b) => a + b, 0)
  const top = niceMax(Math.max(0, ...values))

  const geometry = useMemo(() => {
    const plotW = Math.max(0, width - PAD.left - PAD.right)
    const plotH = HEIGHT - PAD.top - PAD.bottom
    const slot = days.length ? plotW / days.length : 0
    const bar = Math.max(2, Math.min(MAX_BAR, slot - 2))
    const y = (v: number) => PAD.top + plotH - (v / top) * plotH
    const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(plotW / 56))))
    return { plotW, plotH, slot, bar, y, labelEvery }
  }, [width, days.length, top])

  const ticks = [0, top / 2, top]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Measure">
          {measures.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={measure === m.key}
              onClick={() => setMeasure(m.key)}
              className={`btn btn-sm ${measure === m.key ? 'btn-secondary' : 'btn-quiet'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-quiet btn-sm" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>
          <i aria-hidden className={`bi ${showTable ? 'bi-bar-chart' : 'bi-table'}`} /> {showTable ? 'Chart' : 'Table'}
        </button>
      </div>

      <p className="mb-2 text-sm text-muted">
        <span className="font-bold text-ink">{formatCount(total)}</span> {current.noun} in this period
      </p>

      {showTable ? (
        <div className="max-h-72 overflow-auto rounded-lg border border-line">
          <table className="table-base">
            <thead>
              <tr>
                <th>Day</th>
                {measures.map((m) => (
                  <th key={m.key} className="text-right">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="whitespace-nowrap">{formatShortDay(d.date)}</td>
                  {measures.map((m) => (
                    <td key={m.key} className="text-right tabular-nums">{d.values[m.key] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative w-full overflow-hidden" onPointerLeave={() => setActive(null)}>
          {width > 0 && (
            <svg width={width} height={HEIGHT} role="img" aria-label={`${current.label} per day`} className="block">
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={geometry.y(t)} y2={geometry.y(t)} className="stroke-line" strokeWidth={1} />
                  <text x={PAD.left - 6} y={geometry.y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                    {Number.isInteger(t) ? t : ''}
                  </text>
                </g>
              ))}

              {days.map((d, i) => {
                const v = d.values[measure] ?? 0
                const cx = PAD.left + geometry.slot * i + geometry.slot / 2
                const x = cx - geometry.bar / 2
                const y = geometry.y(v)
                const h = PAD.top + geometry.plotH - y
                return (
                  <g key={d.date}>
                    <path d={columnPath(x, y, geometry.bar, h)} className={active === i ? 'fill-accent-strong' : 'fill-accent'} />
                    {i % geometry.labelEvery === 0 && (
                      <text x={cx} y={HEIGHT - 8} textAnchor="middle" className="fill-muted text-[11px]">
                        {formatShortDay(d.date)}
                      </text>
                    )}
                    {/* The whole column is the hit target, not just the bar. */}
                    <rect
                      x={PAD.left + geometry.slot * i}
                      y={PAD.top}
                      width={geometry.slot}
                      height={geometry.plotH}
                      fill="transparent"
                      tabIndex={0}
                      aria-label={`${formatShortDay(d.date)}: ${v} ${current.noun}`}
                      onPointerEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                      className="cursor-default outline-none focus-visible:stroke-accent focus-visible:stroke-2"
                    />
                  </g>
                )
              })}
            </svg>
          )}

          {active != null && days[active] && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-[var(--shadow-card)]"
              style={{ left: Math.min(Math.max(PAD.left + geometry.slot * active + geometry.slot / 2, 60), width - 60) }}
            >
              <p className="text-base font-bold tabular-nums text-ink">{days[active].values[measure] ?? 0}</p>
              <p className="text-muted">
                {current.label} · {formatShortDay(days[active].date)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}