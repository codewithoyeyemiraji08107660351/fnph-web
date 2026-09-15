import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'

export function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <p className="font-display text-6xl font-extrabold text-line">404</p>
      <h1 className="mt-3 text-2xl font-extrabold">That page does not exist</h1>
      <p className="mt-2 text-muted">Check the address, or start again from the home page.</p>
      <Link to="/" className="btn btn-primary mt-6 no-underline">
        Go to the home page
      </Link>
    </div>
  )
}
