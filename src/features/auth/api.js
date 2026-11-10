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

async function signUpStaff({ email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/driver/register` },
  });
  if (error) throw error;
  // No session means the project wants the email address confirmed first.
  return { needsConfirmation: !data.session };
}

/** Creates an email and password account. It has no staff access until an application is approved. */
export function useStaffSignUp() {
  return useMutation({ mutationFn: signUpStaff });
}

/** Sets the password of the signed-in account, used after following an invitation link. */
export function useSetPassword() {
  return useMutation({
    mutationFn: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
  });
}

export function signUpErrorMessage(error) {
  if (error?.code === 'user_already_exists' || error?.code === 'email_exists') {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (error?.code === 'weak_password') return 'Choose a longer password.';
  if (error?.status === 429) return 'Too many attempts. Wait a minute and try again.';
  return 'Could not create the account. Check your connection and try again.';
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
