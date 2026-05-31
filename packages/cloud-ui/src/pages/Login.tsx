export function Login() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <h2>Login</h2>
      <a href="/auth/google" style={{ marginTop: '1rem', padding: '0.75rem 2rem', background: '#4285f4', color: '#fff', borderRadius: '4px', textDecoration: 'none' }}>
        Sign in with Google
      </a>
    </div>
  )
}
