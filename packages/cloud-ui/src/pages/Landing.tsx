export function Landing() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <h1>IEOM Cloud</h1>
      <p>Multi-camera POV switching for collaborative streams</p>
      <a href="/auth/google" style={{ marginTop: '2rem', padding: '0.75rem 2rem', background: '#4285f4', color: '#fff', borderRadius: '4px', textDecoration: 'none' }}>
        Sign in with Google
      </a>
    </div>
  )
}
