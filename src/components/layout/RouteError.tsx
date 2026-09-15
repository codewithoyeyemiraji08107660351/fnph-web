import { useRouteError } from 'react-router-dom'

export function RouteError() {
  const error = useRouteError()
  console.error(error)
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-5 text-center">
      <div>
        <img src="/fnph-logo.png" alt="" className="mx-auto size-16" />
        <h1 className="mt-4 text-2xl font-extrabold">This screen failed to load</h1>
        <p className="mt-2 text-muted">Reload the page. If it keeps happening, contact the helpdesk and mention what you were doing.</p>
        <button className="btn btn-primary mt-6" onClick={() => window.location.reload()}>Reload</button>
      </div>
    </div>
  )
}
