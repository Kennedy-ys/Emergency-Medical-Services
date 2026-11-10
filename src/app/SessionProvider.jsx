import { useCallback, useEffect, useMemo, useState } from 'react';
import { ensureSession, supabase } from '../lib/supabase';
import { SessionContext } from '../lib/sessionContext';
import { getPushSubscription } from '../lib/pushDevice';

async function loadAccount(userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, phone, avatar_url')
    .eq('id', userId)
    .single();
  if (error) throw error;

  let driver = null;
  if (profile.role === 'driver') {
    const { data, error: driverError } = await supabase
      .from('drivers')
      .select('approval_status, availability, ambulance_number, license_plate')
      .eq('id', userId)
      .single();
    if (driverError) throw driverError;
    driver = data;
  }
  return { profile, driver };
}

export default function SessionProvider({ children }) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  // The account is tagged with the user it was loaded for, so a stale one is
  // never shown while the next user's is still loading.
  const [account, setAccount] = useState({ userId: null, profile: null, driver: null });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    // Keep this callback synchronous: calling Supabase from inside it can deadlock.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = user?.id ?? null;

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const loaded = await loadAccount(userId);
    setAccount({ userId, ...loaded });
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    loadAccount(userId)
      .then((loaded) => {
        if (!cancelled) setAccount({ userId, ...loaded });
      })
      .catch(() => {
        if (!cancelled) setAccount({ userId, profile: null, driver: null });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = useMemo(() => {
    const accountLoaded = account.userId === userId;
    const profile = userId && accountLoaded ? account.profile : null;
    const driver = userId && accountLoaded ? account.driver : null;

    return {
      loading: !authReady || (Boolean(userId) && !accountLoaded),
      user,
      isAnonymous: Boolean(user?.is_anonymous),
      profile,
      role: profile?.role ?? null,
      driver,
      refreshProfile,
      /** Returns the current user, creating an anonymous session if there is none. */
      ensureSession,
      signOut: async () => {
        // Stop this device receiving alerts meant for the account being left.
        // Best effort: signing out must work even when this cannot be done.
        try {
          const subscription = await getPushSubscription();
          if (subscription) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', subscription.endpoint);
          }
        } catch {
          // Carry on with the sign-out.
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    };
  }, [authReady, user, userId, account, refreshProfile]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
