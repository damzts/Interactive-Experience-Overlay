/**
 * LoginModal — a modal overlay for sign-in, avoiding full-page redirect.
 *
 * Replaces the previous full-page login approach. Users can:
 * - Click "Sign in with Google" to start OAuth
 * - Press Escape or click the backdrop to cancel and return to the dashboard
 * - See the dashboard content behind the modal (no context lost)
 *
 * In desktop mode, `login()` opens the in-app OAuth BrowserWindow.
 * In web mode, `login()` navigates to the backend OAuth endpoint.
 * Both modes keep the original dashboard state intact if cancelled.
 */

import { useAuth } from './AuthContext'
import { Modal } from '../components/organisms/Modal'
import { Button } from '../components/atoms'

export interface LoginModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Login modal that appears as an overlay above the dashboard.
 * Shows a brief explanation, the Google OAuth button, and a cancel action.
 */
export function LoginModal({ open, onClose }: LoginModalProps) {
  const { login } = useAuth()

  return (
    <Modal open={open} onClose={onClose} title="Sign in to IEOM">
      <div className="flex flex-col items-center gap-5 py-4">
        <p className="text-sm text-[var(--color-text-muted)] text-center leading-relaxed max-w-sm">
          Sign in to access all features including overlay management,
          widgets, scene editing, and system configuration.
        </p>

        <div className="flex flex-col w-full gap-2.5">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              login()
              onClose()
            }}
          >
            Sign in with Google
          </Button>

          <Button
            variant="ghost"
            size="md"
            fullWidth
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
