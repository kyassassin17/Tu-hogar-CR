import { describe, expect, it } from 'vitest'
import { validateProductionConfig } from './productionConfig'

const environment = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnopqrstuv' }
const token = (role: string, exp?: number) => `header.${btoa(JSON.stringify({ role, exp }))}.signature`

describe('production build configuration', () => {
  it('accepts a public publishable key or anon JWT', () => {
    expect(() => validateProductionConfig(environment)).not.toThrow()
    expect(() => validateProductionConfig({ ...environment, VITE_SUPABASE_ANON_KEY: token('anon') })).not.toThrow()
  })
  it.each(['', 'your-supabase-anon-key', 'sb_secret_abcdefghijklmnopqrstuv', token('service_role'), token('anon', 1)])('rejects missing, placeholder, privileged, or expired keys', (key) => {
    expect(() => validateProductionConfig({ ...environment, VITE_SUPABASE_ANON_KEY: key })).toThrow()
  })
  it.each(['', 'http://example.supabase.co', 'https://your-project.supabase.co', 'https://user:pass@example.supabase.co', 'https://example.supabase.co/path'])('rejects invalid project URL %s', (url) => {
    expect(() => validateProductionConfig({ ...environment, VITE_SUPABASE_URL: url })).toThrow()
  })
  it('rejects demo mode in a production build', () => {
    expect(() => validateProductionConfig({ ...environment, VITE_DEMO_MODE: 'true' })).toThrow()
  })
})