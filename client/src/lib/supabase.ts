import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use cookie-based storage for better mobile compatibility
    // Falls back to localStorage if cookies unavailable
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'streamline-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Mobile-specific: Increase token refresh buffer for slow networks
    flowType: 'pkce',
  },
})
