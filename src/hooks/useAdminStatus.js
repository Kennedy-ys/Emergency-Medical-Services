import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';

export function useAdminStatus() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const tokenResult = await currentUser.getIdTokenResult();
        setIsAdmin(!!tokenResult.claims.admin);
      } else {
        setIsAdmin(false);
      }
      setChecking(false);
    });

    return () => unsubscribe();
  }, []);

  return { isAdmin, checking, user };
}
