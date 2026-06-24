import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  role: UserRole;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyOtp: (token: string, type: 'email' | 'phone') => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [emailForOtp, setEmailForOtp] = useState('');
  const [phoneForOtp, setPhoneForOtp] = useState('');

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      }
      setIsLoading(false);
    }).catch(() => {
      // Supabase not configured — continue as guest
      setIsLoading(false);
    });

    // Listen for auth changes
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const { data } = supabase.auth.onAuthStateChange(
        async (_event, s) => {
          setSession(s);
          setUser(s?.user ?? null);
          if (s?.user) {
            await fetchProfile(s.user.id);
          } else {
            setProfile(null);
          }
          setIsLoading(false);
        }
      );
      subscription = data.subscription;
    } catch {
      // Supabase not configured
    }

    return () => subscription?.unsubscribe();
  }, [fetchProfile]);

  const signInWithEmail = async (email: string) => {
    setEmailForOtp(email);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  };

  const signInWithPhone = async (phone: string) => {
    setPhoneForOtp(phone);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
  };

  const verifyOtp = async (token: string, type: 'email' | 'phone') => {
    if (type === 'email') {
      const { error } = await supabase.auth.verifyOtp({
        email: emailForOtp,
        token,
        type: 'email',
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.auth.verifyOtp({
        phone: phoneForOtp,
        token,
        type: 'sms',
      });
      if (error) throw error;
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);
    if (error) throw error;
    await fetchProfile(user.id);
  };

  const role: UserRole = profile?.role ?? 'guest';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        role,
        isLoading,
        isAuthenticated: !!user,
        signInWithEmail,
        signInWithPhone,
        verifyOtp,
        signInWithGoogle,
        signOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
