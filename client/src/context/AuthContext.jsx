import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, clearStaleAuthSession } from '../lib/supabase';
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
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error && /fetch|network|retryable/i.test(error.message || '')) {
        clearStaleAuthSession();
        setSession(null);
        setLoading(false);
        return;
      }
      setSession(s);
      if (s) loadProfile(s.access_token);
      setLoading(false);
    }).catch(() => {
      clearStaleAuthSession();
      setSession(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'TOKEN_REFRESHED' && !s) {
        clearStaleAuthSession();
      }
      setSession(s);
      if (s) loadProfile(s.access_token);
      else {
        setProfile(null);
        setPermissions([]);
      }
    });

    let handlingExpired = false;
    const onAuthExpired = async () => {
      if (handlingExpired) return;
      handlingExpired = true;
      try {
        // Prefer a silent refresh over an immediate logout when the access token
        // is stale but the refresh token is still valid.
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data?.session?.access_token) {
          setSession(data.session);
          await loadProfile(data.session.access_token);
          handlingExpired = false;
          if (typeof window !== 'undefined') window.__authExpiredAt = 0;
          return;
        }
      } catch {
        /* fall through to sign-out */
      }
      try {
        await supabase.auth.signOut();
      } catch {
        clearStaleAuthSession();
      }
      setSession(null);
      setProfile(null);
      setPermissions([]);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?reason=session');
      }
    };
    window.addEventListener('auth:expired', onAuthExpired);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('auth:expired', onAuthExpired);
    };
  }, [loadProfile]);

  const signIn = async (email, password) => {
    try {
      const data = await api.login({
        email: email.trim().toLowerCase(),
        password,
      });
      if (!data.session?.access_token) {
        throw new Error('Login failed — no session returned.');
      }
      const { error } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (error) throw error;
    } catch (err) {
      const friendly = new Error(formatAuthError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  const signUp = async (email, password, fullName, otp) => {
    await api.verifyRegister({
      email: email.trim().toLowerCase(),
      otp,
    });
    await signIn(email, password);
  };

  const sendRegisterOtp = async (email, password, fullName, phone) => {
    return api.sendRegisterOtp({
      email: email.trim().toLowerCase(),
      password,
      full_name: fullName?.trim(),
      phone: phone?.trim(),
    });
  };

  const requestPasswordReset = async (email) => {
    return api.forgotPassword(email.trim().toLowerCase());
  };

  const resetPasswordWithOtp = async (email, otp, password) => {
    return api.resetPasswordWithOtp({
      email: email.trim().toLowerCase(),
      otp,
      password,
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.access_token);
  }, [session, loadProfile]);

  const roleName = profile?.role?.name || 'viewer';
  const isAdmin = roleName === 'admin';
  const isManager = roleName === 'admin' || roleName === 'manager';
  const isCustomer = roleName === 'customer';
  const isRider = roleName === 'motor_rider';
  const isApproved = !!session;
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
        sendRegisterOtp,
        requestPasswordReset,
        resetPasswordWithOtp,
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
