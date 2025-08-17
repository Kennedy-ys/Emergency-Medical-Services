import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, db } from "../firebaseConfig";

export function useDriverAuth() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // Fetch the driver's role from Firebase Realtime Database
        try {
          const roleRef = ref(db, `drivers/${currentUser.uid}/role`);
          const snapshot = await get(roleRef);

          if (snapshot.exists()) {
            setRole(snapshot.val());
          } else {
            setRole(null);
          }
        } catch (err) {
          console.error("Error fetching role:", err);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, role, loading };
}
