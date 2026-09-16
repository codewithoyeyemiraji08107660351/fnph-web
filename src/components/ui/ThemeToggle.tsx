import { useTheme } from '@/lib/hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="btn btn-secondary no-underline"
    >
      <i aria-hidden className={`bi ${isDark ? 'bi-sun' : 'bi-moon-stars'}`} />
      <span className="sr-only">{isDark ? 'Light theme' : 'Dark theme'}</span>
    </button>
  )
}