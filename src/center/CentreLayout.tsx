import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { centreApi, type CentreProfile } from './centreApi'

export default function CentreLayout() {
  const { principal, signOut } = useAuth()
  const [centre, setCentre] = useState<CentreProfile | null>(null)

  useEffect(() => {
    centreApi.me().then(setCentre)
  }, [])

  /*
    Capability, not role.
    A centre pharmacy user holds CENTRE_PHARMACY wherever they work, but
    whether their centre runs a pharmacy is a per-centre flag an administrator
    sets. Two users with the same role at different centres legitimately see
    different navigation, which is why this reads the capability list from
    /centres/me rather than the principal's roles.
  */
  const has = (capability: string) =>
    centre?.capabilities.includes(capability) ?? false

  return (
    <div>
      <header>
        <strong>{centre?.name ?? 'Centre'}</strong>
        {centre && (
          <span>
            {' '}
            {centre.code} · {centre.lga}
          </span>
        )}
        {centre?.status === 'SUSPENDED' && (
          <p role="alert">
            This centre is suspended. New referrals cannot be submitted.
          </p>
        )}

        <nav>
          <Link to="/centre/patients">Patients</Link>
          <Link to="/centre/incoming">Incoming</Link>
          <Link to="/centre/utilisation">Activity</Link>
          {has('PHARMACY') && <Link to="/centre/pharmacy">Pharmacy</Link>}
          {has('LABORATORY') && <Link to="/centre/laboratory">Laboratory</Link>}
          {has('HIM') && <Link to="/centre/him">Records</Link>}
        </nav>

        <span>{principal?.displayName}</span>
        <button onClick={() => void signOut()}>Sign out</button>
      </header>

      <main>
        <Outlet context={centre} />
      </main>
    </div>
  )
}