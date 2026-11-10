import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Supabase is not configured. Copy .env.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(url, anonKey);

/** Returns the current user, creating an anonymous session if there is none. */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user;
  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return created.user;
}

/**
 * Sorts a failed call into what the screen should do about it.
 *   business: the server refused; `code` is a stable name such as 'booking_already_taken'
 *   network:  the call never arrived, or failed for a reason worth retrying
 */
export function classifyError(error) {
  if (error?.code === 'P0001' && error.message) return { kind: 'business', code: error.message };
  return { kind: 'network', code: null };
}
