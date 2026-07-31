import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, setToken, getToken } from './api';
import { useRouter } from 'expo-router';
import { registerForPushNotificationsAsync, scheduleMedicationReminders, scheduleAppointmentReminders } from './notifications';

export type User = {
  id: string;
  email: string;
  name: string;
  cpf?: string;
  photo_base64?: string;
  blood_type?: string;
  allergies?: string[];
  emergency_contact?: string;
  emergency_phone?: string;
  phone?: string;
  address?: string;
  mother_name?: string;
  father_name?: string;
  birth_certificate?: string;
  marriage_certificate?: string;
  birthdate?: string;
  gender?: string;
  medication_photo_required?: boolean;
  accessibility_enabled?: boolean;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  loggingOut: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  resetSession: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const HARD_TIMEOUT_MS = 6000; // absolute failsafe: after 6s, loading resolves no matter what

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const settled = useRef(false);
  const router = useRouter();

  const safeSetLoadingFalse = () => {
    if (!settled.current) {
      settled.current = true;
      setLoading(false);
    }
  };

  const refresh = useCallback(async () => {
    try {
      const tok = await getToken();
      if (!tok) { setUser(null); return; }
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
      await setToken(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Absolute failsafe: don't leave user stuck on spinner
    const failsafe = setTimeout(() => {
      if (!cancelled) safeSetLoadingFalse();
    }, HARD_TIMEOUT_MS);

    (async () => {
      await refresh();
      // after refresh, try to register for push notifications if logged in
      try {
        const tok = await registerForPushNotificationsAsync();
      } catch {}
      if (!cancelled) safeSetLoadingFalse();
    })();

    return () => { cancelled = true; clearTimeout(failsafe); };
  }, [refresh]);

  const signIn = async (email: string, password: string) => {
    try {
      const r = await api.login({ email, password });
      await setToken(r.access_token);
      setUser(r.user);
      try { await registerForPushNotificationsAsync(); } catch {}
    } catch (e: any) {
      if (e?.code === 'MUST_CHANGE_PASSWORD' || (e?.status === 403 && String(e?.message).includes('Troque a senha temporária'))) {
        const error = new Error('MUST_CHANGE_PASSWORD');
        (error as any).code = 'MUST_CHANGE_PASSWORD';
        throw error;
      }
      throw e;
    }
  };

  const signOut = async () => {
    try {
      setLoggingOut(true);
      // Try to notify backend (optional - doesn't fail if backend is unreachable)
      try {
        await api.logout();
      } catch (e) {
        console.warn('Logout call to backend failed (non-critical):', e);
      }
      // Clear local auth state
      await setToken(null);
      setUser(null);
      settled.current = true;
      setLoading(false);
      // Redirect to login
      router.replace('/(auth)/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const resetSession = async () => {
    await setToken(null);
    setUser(null);
    settled.current = true;
    setLoading(false);
  };

  return (
    <Ctx.Provider value={{ user, loading, loggingOut, signIn, signOut, refresh, resetSession }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
