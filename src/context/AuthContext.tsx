import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile } from '../types';
import { dataStore } from '../lib/dataStore';

interface AuthContextType {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  isLoading: boolean;
  login: (email: string, pass: string) => { success: boolean; error?: string };
  register: (email: string, pass: string, fullName: string) => { success: boolean; error?: string };
  loginWithGoogle: (email: string, fullName?: string) => { success: boolean; error?: string };
  loginDirectly: (email: string, fullName?: string) => { success: boolean; error?: string };
  resetPassword: (email: string, newPass: string) => { success: boolean; error?: string };
  signOut: () => void;
  createOrganization: (name: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  login: () => ({ success: false }),
  register: () => ({ success: false }),
  loginWithGoogle: () => ({ success: false }),
  loginDirectly: () => ({ success: false }),
  resetPassword: () => ({ success: false }),
  signOut: () => {},
  createOrganization: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshState = () => {
    const currUserId = dataStore.getCurrentUserId();
    if (!currUserId) {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }
    const currProf = dataStore.getCurrentProfile();
    if (currProf && currProf.email) {
      setUser({ id: currProf.id, email: currProf.email });
      setProfile(currProf);
    } else {
      setUser(null);
      setProfile(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refreshState();
    const unsubscribe = dataStore.subscribe(refreshState);
    return unsubscribe;
  }, []);

  const login = (email: string, pass: string) => {
    const res = dataStore.login(email, pass);
    if (res.success) {
      refreshState();
    }
    return res;
  };

  const register = (email: string, pass: string, fullName: string) => {
    const res = dataStore.register(email, pass, fullName);
    if (res.success) {
      refreshState();
    }
    return res;
  };

  const loginWithGoogle = (email: string, fullName?: string) => {
    const res = dataStore.loginWithGoogle(email, fullName);
    if (res.success) {
      refreshState();
    }
    return res;
  };

  const loginDirectly = (email: string, fullName?: string) => {
    const res = dataStore.loginDirectly(email, fullName);
    if (res.success) {
      refreshState();
    }
    return res;
  };

  const resetPassword = (email: string, newPass: string) => {
    const res = dataStore.resetPassword(email, newPass);
    if (res.success) {
      refreshState();
    }
    return res;
  };

  const signOut = () => {
    dataStore.logout();
    setUser(null);
    setProfile(null);
  };

  const createOrganization = (name: string) => {
    dataStore.createOrganization(name);
    refreshState();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        login,
        register,
        loginWithGoogle,
        loginDirectly,
        resetPassword,
        signOut,
        createOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
