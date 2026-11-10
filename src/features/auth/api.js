import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

async function signInStaff({ email, password }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Email and password sign-in for drivers, technicians and dispatchers. */
export function useStaffSignIn() {
  return useMutation({ mutationFn: signInStaff });
}

/** Turns a sign-in failure into words a person can act on. */
export function signInErrorMessage(error) {
  if (error?.code === 'invalid_credentials') return 'Email or password is incorrect.';
  if (error?.code === 'email_not_confirmed') {
    return 'This email has not been confirmed yet. Open the link we sent you, then sign in.';
  }
  if (error?.status === 429) return 'Too many attempts. Wait a minute and try again.';
  return 'Could not sign in. Check your connection and try again.';
}
