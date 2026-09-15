import { useAuth } from '@/lib/auth/AuthProvider'
import { PageHeader, Panel } from '@/components/ui/Page'
import { Alert } from '@/components/ui/Alert'
import { ChangePasswordForm } from './ChangePasswordForm'

export function ForcedPasswordChange() {
  const { principal } = useAuth()
  return (
    <>
      <PageHeader kicker="Account security" title="Change your password" />
      {principal?.mustChangePassword && (
        <Alert tone="warning" title="A new password is required" className="mb-5 max-w-2xl">
          Your password was reset by an administrator. Choose your own before you continue.
        </Alert>
      )}
      <Panel>
        <ChangePasswordForm />
      </Panel>
    </>
  )
}
