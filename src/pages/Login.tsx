import { useState } from 'react'
import { useAuthActions } from '@convex-dev/auth/react'

type Mode = 'signIn' | 'signUp' | 'reset' | 'reset-verification'

export default function Login() {
  const { signIn } = useAuthActions()
  const [mode, setMode] = useState<Mode>('signIn')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signUp') {
        await signIn('password', { email, password, name, flow: 'signUp' })
      } else if (mode === 'signIn') {
        await signIn('password', { email, password, flow: 'signIn' })
      } else if (mode === 'reset') {
        await signIn('password', { email, flow: 'reset' })
        setMode('reset-verification')
      } else if (mode === 'reset-verification') {
        await signIn('password', { email, code, newPassword, flow: 'reset-verification' })
        setMode('signIn')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(
        mode === 'signUp'
          ? `Registration failed: ${msg}`
          : mode === 'reset' 
            ? `Reset failed: ${msg}` 
            : mode === 'reset-verification'
              ? `Verification failed: ${msg}`
              : 'Invalid email or password. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    setMode(m => m === 'signIn' ? 'signUp' : 'signIn')
    setError('')
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-logo">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            location_city
          </span>
        </div>
        <h1 className="login-title">Municipal<br />Authority</h1>
        <p className="login-subtitle">Field Operations Platform</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit} id="login-form">
        {/* Mode toggle */}
        {(mode === 'signIn' || mode === 'signUp') && (
          <div style={{ display: 'flex', background: 'var(--surface-container)', borderRadius: 'var(--radius-md)', padding: '0.25rem', marginBottom: '0.5rem' }}>
            {(['signIn', 'signUp'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                id={`mode-${m}`}
                onClick={() => toggle()}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: 'none',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  fontFamily: 'var(--font-label)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: mode === m ? 'var(--surface-container-lowest)' : 'transparent',
                  color: mode === m ? 'var(--on-surface)' : 'var(--on-surface-variant)',
                  boxShadow: mode === m ? 'var(--shadow-ambient)' : 'none',
                }}
              >
                {m === 'signIn' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>
        )}

        {error && <div className="login-error" role="alert">{error}</div>}

        {mode === 'signUp' && (
          <div className="field-group">
            <label className="field-label" htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              className="field-input"
              placeholder="e.g. Jane Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
        )}

        <div className="field-group">
          <label className="field-label" htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            className="field-input"
            placeholder="officer@municipality.gov"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={mode === 'reset-verification'}
            autoComplete="email"
            required
          />
        </div>

        {(mode === 'signIn' || mode === 'signUp') && (
          <div className="field-group">
            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="field-input"
              placeholder={mode === 'signUp' ? 'Min. 8 characters' : 'Enter your password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'signUp' ? 8 : undefined}
            />
          </div>
        )}

        {mode === 'reset-verification' && (
          <>
            <div className="field-group">
              <label className="field-label" htmlFor="code">Verification Code</label>
              <input
                id="code"
                type="text"
                className="field-input"
                placeholder="Check your emails (or development console)"
                value={code}
                onChange={e => setCode(e.target.value)}
                required
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                className="field-input"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </>
        )}

        <button
          id="login-submit"
          type="submit"
          className="btn btn-primary btn-full"
          disabled={loading}
          style={{ marginTop: '0.5rem' }}
        >
          {loading ? (
            <><span className="material-symbols-outlined icon-sm">hourglass_empty</span> {mode === 'signUp' ? 'Creating account…' : 'Processing…'}</>
          ) : mode === 'signUp' ? (
            <><span className="material-symbols-outlined icon-sm">person_add</span> Create Account</>
          ) : mode === 'reset' ? (
            <><span className="material-symbols-outlined icon-sm">mail</span> Send Reset Code</>
          ) : mode === 'reset-verification' ? (
            <><span className="material-symbols-outlined icon-sm">lock_reset</span> Reset Password</>
          ) : (
            <><span className="material-symbols-outlined icon-sm">lock_open</span> Sign In</>
          )}
        </button>

        {(mode === 'reset' || mode === 'reset-verification') && (
          <button
            type="button"
            className="btn btn-ghost btn-full"
            onClick={() => { setMode('signIn'); setError(''); }}
            disabled={loading}
          >
            Cancel
          </button>
        )}

        <p style={{ textAlign: 'center', fontFamily: 'var(--font-label)', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '1rem' }}>
          Authorised personnel only. All access is logged and monitored.
        </p>
      </form>
    </div>
  )
}
