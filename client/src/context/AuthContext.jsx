import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { formatAuthError } from '../lib/authErrors';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (token) => {
    try {
      const data = await api.getMe(token);
      setProfile(data.profile);
      setPermissions(data.permissions || []);
    } catch {
      setProfile(null);
      setPermissions([]);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadProfile(s.access_token);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) loadProfile(s.access_token);
      else {
        setProfile(null);
        setPermissions([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      const friendly = new Error(formatAuthError(error));
      friendly.code = error.code;
      throw friendly;
    }
  };

  const signUp = async (email, password, fullName) => {
    await api.register({
      email: email.trim().toLowerCase(),
      password,
      full_name: fullName?.trim(),
    });
    await signIn(email, password);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.access_token);
  }, [session, loadProfile]);

  const isAdmin = profile?.role?.name === 'admin' && profile?.is_approved;
  const roleName = profile?.role?.name || 'viewer';
  const isManager = profile?.is_approved && (roleName === 'admin' || roleName === 'manager');
  const isCustomer = profile?.is_approved && roleName === 'customer';
  const isRider = profile?.is_approved && roleName === 'motor_rider';
  const isApproved = profile?.is_approved === true;
  const hasPermission = (perm) => permissions.includes(perm) || isManager;

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        permissions,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        isAdmin,
        isManager,
        isCustomer,
        isRider,
        roleName,
        isApproved,
        hasPermission,
        token: session?.access_token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
