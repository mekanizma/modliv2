import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { requestNotificationPermission } from '../lib/notifications';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  height?: number;
  weight?: number;
  gender?: string;
  style_preference?: string;
  credits: number;
  subscription_tier?: string;
  onboarding_completed: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Timeout mekanizması - 10 saniye sonra loading'i false yap (session yüklenmesi için daha fazla zaman)
    const timeoutId = setTimeout(() => {
      console.warn('⏰ getSession timeout after 10 seconds');
      setLoading(false);
    }, 10000);

    // İlk session'ı yükle - SecureStore'dan okur
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      clearTimeout(timeoutId);
      
      if (error) {
        console.error('❌ Session error:', error);
        // Invalid refresh token hatası durumunda oturumu temizle
        const errorMessage = error.message || error.toString() || '';
        if (errorMessage.includes('Invalid Refresh Token') || 
            errorMessage.includes('Refresh Token Not Found') ||
            errorMessage.includes('JWT') ||
            error.code === 'invalid_refresh_token') {
          console.log('🔄 Invalid refresh token detected, clearing session...');
          supabase.auth.signOut().catch(console.error);
          setSession(null);
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
        return;
      }
      
      console.log('✅ Session loaded from storage:', session ? 'Session exists' : 'No session');
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        console.log('👤 User found, fetching profile...');
        fetchProfile(session.user.id);
      } else {
        console.log('👤 No user found, setting loading to false');
        setLoading(false);
      }
    }).catch((error: any) => {
      clearTimeout(timeoutId);
      console.error('❌ getSession error:', error);
      // Invalid refresh token hatası durumunda oturumu temizle
      const errorMessage = error?.message || error?.toString() || '';
      if (errorMessage.includes('Invalid Refresh Token') || 
          errorMessage.includes('Refresh Token Not Found') ||
          errorMessage.includes('JWT') ||
          error?.code === 'invalid_refresh_token') {
        console.log('🔄 Invalid refresh token in catch block, clearing session...');
        supabase.auth.signOut().catch(console.error);
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        console.log('🔄 Auth state changed:', event, session ? 'Session exists' : 'No session');
        
        // INITIAL_SESSION event'i - session'ın ilk yüklendiği zaman
        // Bu durumda session zaten getSession() ile yüklenmiş olabilir
        if (event === 'INITIAL_SESSION') {
          console.log('🔄 Initial session event');
          if (session) {
            setSession(session);
            setUser(session.user ?? null);
            if (session.user) {
              await fetchProfile(session.user.id);
            }
          }
          return;
        }
        
        // Token refresh hatası durumunda oturumu temizle
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.log('🔄 Token refresh failed, clearing session...');
          await supabase.auth.signOut().catch(console.error);
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      } catch (error: any) {
        console.error('❌ Error in onAuthStateChange:', error);
        const errorMessage = error?.message || error?.toString() || '';
        if (errorMessage.includes('Invalid Refresh Token') || 
            errorMessage.includes('Refresh Token Not Found') ||
            errorMessage.includes('JWT') ||
            error?.code === 'invalid_refresh_token') {
          console.log('🔄 Invalid refresh token in onAuthStateChange, clearing session...');
          await supabase.auth.signOut().catch(console.error);
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    const timeoutId = setTimeout(() => {
      console.warn('⏰ fetchProfile timeout after 10 seconds');
      setLoading(false);
    }, 10000);

    try {
      // Get current session to access user email
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      // Invalid refresh token hatası durumunda oturumu temizle
      if (sessionError && (sessionError.message?.includes('Invalid Refresh Token') || sessionError.message?.includes('Refresh Token Not Found'))) {
        console.log('🔄 Invalid refresh token in fetchProfile, clearing session...');
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        clearTimeout(timeoutId);
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Invalid token hatası durumunda oturumu temizle
      if (error && (error.message?.includes('Invalid Refresh Token') || error.message?.includes('Refresh Token Not Found') || error.message?.includes('JWT'))) {
        console.log('🔄 Invalid token in profile fetch, clearing session...');
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        clearTimeout(timeoutId);
        setLoading(false);
        return;
      }

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create one
        const newProfile: UserProfile = {
          id: userId,
          email: currentSession?.user?.email || '',
          full_name: currentSession?.user?.user_metadata?.full_name || '',
          credits: 1, // 1 free try
          onboarding_completed: false,
        };
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();
        
        if (!createError && created) {
          setProfile(created);
          console.log('Profile created successfully - needs onboarding:', created);
        } else {
          console.error('Error creating profile:', createError);
        }
      } else if (data) {
        setProfile(data);
        console.log('Profile loaded - onboarding status:', data.onboarding_completed);
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      // Invalid token hatası durumunda oturumu temizle
      if (error?.message?.includes('Invalid Refresh Token') || error?.message?.includes('Refresh Token Not Found')) {
        console.log('🔄 Invalid token exception, clearing session...');
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      // If sign in successful, fetch profile immediately
      if (!error && data.user) {
        console.log('🔄 Sign in successful, fetching profile...');
        await fetchProfile(data.user.id);

        // Giriş yapınca bildirim iznini sor
        await requestNotificationPermission();
      } else {
        setLoading(false);
      }
      
      return { error };
    } catch (err: any) {
      console.error('❌ Sign in error:', err);
      setLoading(false);
      // Network hatası için özel mesaj
      if (err.message?.includes('Network') || err.message?.includes('network') || err.message?.includes('fetch')) {
        return { 
          error: { 
            message: 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.',
            code: 'NETWORK_ERROR'
          } 
        };
      }
      return { 
        error: { 
          message: err.message || 'Giriş yapılırken bir hata oluştu.',
          code: 'UNKNOWN_ERROR'
        } 
      };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: 'https://mekanizma.com/modli/index.html',
      },
    });
    return { error };
  };

  const signOut = async () => {
    console.log('🚪 Signing out...');
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    console.log('✅ Signed out successfully');
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('No user') };
    
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);
    
    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }
    return { error };
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      updateProfile,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
