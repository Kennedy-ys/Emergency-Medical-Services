import { useContext } from 'react';
import { SessionContext } from '../lib/sessionContext';

/**
 * The signed-in user, as provided by SessionProvider.
 *
 * @returns {{
 *   loading: boolean,
 *   user: import('@supabase/supabase-js').User | null,
 *   isAnonymous: boolean,
 *   profile: { id: string, role: 'patient'|'driver'|'technician'|'admin',
 *              full_name: string|null, phone: string|null, avatar_url: string|null } | null,
 *   role: 'patient'|'driver'|'technician'|'admin' | null,
 *   driver: { approval_status: 'pending'|'approved'|'suspended', availability: string } | null,
 *   ensureSession: () => Promise<import('@supabase/supabase-js').User>,
 *   refreshProfile: () => Promise<void>,
 *   signOut: () => Promise<void>,
 * }}
 */
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return value;
}
