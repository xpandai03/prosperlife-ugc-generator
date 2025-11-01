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

/**
 * Mobile-safe session verification with retry logic
 *
 * Mobile browsers (especially Safari) have delayed localStorage writes.
 * This helper ensures the session is fully persisted before making API calls.
 *
 * @param maxRetries - Number of retry attempts (default: 3)
 * @param delayMs - Delay between retries in ms (default: 300ms)
 * @returns Session if found, null otherwise
 */
export async function ensureSessionReady(maxRetries = 3, delayMs = 300) {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  if (isMobile) {
    console.log('[Mobile Debug] Session check initiated', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent.substring(0, 100),
    });
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (session) {
      if (isMobile) {
        console.log('[Mobile Debug] Session confirmed', {
          attempt: attempt + 1,
          userId: session.user.id,
          hasAccessToken: !!session.access_token,
          timestamp: new Date().toISOString(),
        });
      }
      return session;
    }

    // If no session and we have retries left, wait and try again
    if (attempt < maxRetries) {
      if (isMobile) {
        console.log('[Mobile Debug] Session not ready, retrying...', {
          attempt: attempt + 1,
          maxRetries,
          delayMs,
        });
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  if (isMobile) {
    console.error('[Mobile Debug] Session not found after retries', {
      maxRetries,
      totalWait: maxRetries * delayMs,
    });
  }

  return null;
}
