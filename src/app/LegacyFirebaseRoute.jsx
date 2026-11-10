import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { LoadingState } from '../components/ui/States';

/**
 * Guard for the old Firebase admin screens. It only checks that someone is
 * signed in to Firebase, not that they are an admin. It goes away when those
 * screens move to Supabase behind RequireRole (implementation plan, Phase 3).
 */
export default function LegacyFirebaseRoute({ children }) {
  const [state, setState] = useState({ loading: true, signedIn: false });

  useEffect(
    () => onAuthStateChanged(getAuth(), (user) => setState({ loading: false, signedIn: !!user })),
    []
  );

  if (state.loading) return <LoadingState className="p-6" />;
  return state.signedIn ? children : <Navigate to="/admin-login" replace />;
}
