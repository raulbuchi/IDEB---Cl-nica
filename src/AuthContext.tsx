import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'professional';
  professionalId?: string;
  specialty?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isProfessional: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isProfessional: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = undefined;
      }
      
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Listen to profile changes
        unsubProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          // Only throw if we are still authenticated (prevents error on logout)
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) {
        unsubProfile();
      }
    };
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isProfessional = profile?.role === 'professional';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isProfessional }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
