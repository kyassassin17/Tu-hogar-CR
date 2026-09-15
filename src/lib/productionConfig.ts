export function validateProductionConfig(environment: Record<string, string | undefined>) {
  const url = environment.VITE_SUPABASE_URL || ''
  const key = environment.VITE_SUPABASE_ANON_KEY || ''
  if (environment.VITE_DEMO_MODE === 'true') throw new Error('Production builds cannot enable VITE_DEMO_MODE.')
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('Set VITE_SUPABASE_URL to the HTTPS URL of your Supabase project.')
  }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password || parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash || parsedUrl.hostname === 'your-project.supabase.co') {
    throw new Error('VITE_SUPABASE_URL must be a real HTTPS Supabase project URL without credentials, a path, or query parameters.')
  }
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)) return
  try {
    const segments = key.split('.')
    const payload = JSON.parse(atob(segments[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (segments.length === 3 && segments[2] && payload.role === 'anon' && (!payload.exp || payload.exp * 1000 > Date.now())) return
  } catch {
    throw new Error('Set VITE_SUPABASE_ANON_KEY to a public publishable or anon key. Never use a secret or service-role key.')
  }
  throw new Error('VITE_SUPABASE_ANON_KEY must be a non-expired public anon or publishable key, never a service-role key.')
}