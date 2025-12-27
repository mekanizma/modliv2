import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase, isInvalidTokenError } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { registerPushToken, requestNotificationPermission } from '../lib/notifications';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

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
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<{ error: any }>;
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
  const [pushRegistered, setPushRegistered] = useState(false);
  const oauthInProgressRef = useRef(false);

  useEffect(() => {
    // Timeout mekanizması - 3 saniye sonra loading'i false yap (hızlı yükleme için)
    const timeoutId = setTimeout(() => {
      console.warn('⏰ getSession timeout after 3 seconds');
      setLoading(false);
    }, 3000);

    // İlk session'ı yükle - SecureStore'dan okur
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      clearTimeout(timeoutId);
      
      if (error) {
        console.error('❌ Session error:', error);
        // Invalid refresh token hatası durumunda oturumu temizle
        if (isInvalidTokenError(error)) {
          console.log('🔄 Invalid refresh token detected, clearing session...');
          // Sessizce oturumu temizle - kullanıcı zaten giriş yapmamış
          supabase.auth.signOut().catch((err) => {
            console.error('Error during signOut:', err);
          });
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
      // Loading'i hemen false yap - profile arka planda yüklenecek
      setLoading(false);
      if (session?.user) {
        console.log('👤 User found, fetching profile in background...');
        // Profile'ı arka planda yükle, navigation'ı bloklamasın
        fetchProfile(session.user.id).catch(console.error);
        setPushRegistered(false);
      } else {
        console.log('👤 No user found, setting loading to false');
      }
    }).catch((error: any) => {
      clearTimeout(timeoutId);
      console.error('❌ getSession error:', error);
      // Invalid refresh token hatası durumunda oturumu temizle
      if (isInvalidTokenError(error)) {
        console.log('🔄 Invalid refresh token in catch block, clearing session...');
        // Sessizce oturumu temizle
        supabase.auth.signOut().catch((err) => {
          console.error('Error during signOut:', err);
        });
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        console.log('🔄 Auth state changed:', event, session ? 'Session exists' : 'No session');
        
        // YENİ: SIGNED_IN event'inde OAuth callback'i kontrol et
        // Deep link handler'dan setSession çağrıldığında bu event tetiklenir
        if (event === 'SIGNED_IN') {
          console.log('✅ SIGNED_IN event detected');
          console.log('✅ OAuth in progress:', oauthInProgressRef.current);
          console.log('✅ Session user ID:', session?.user?.id);
          console.log('✅ Session user email:', session?.user?.email);
          
          // OAuth işlemi devam ediyorsa özel handling yap
          if (oauthInProgressRef.current) {
            console.log('✅ OAuth SIGNED_IN detected, clearing loading state');
            oauthInProgressRef.current = false;
            setLoading(false);
          }
          
          // Session'ı her zaman güncelle (OAuth olsun ya da olmasın)
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            console.log('✅ Fetching profile for user:', session.user.id);
            fetchProfile(session.user.id).catch((error) => {
              console.error('❌ Error fetching profile:', error);
            });
            requestNotificationPermission().catch((error) => {
              console.error('❌ Error requesting notification permission:', error);
            });
          } else {
            console.warn('⚠️ SIGNED_IN event but no user in session');
          }
          
          // OAuth işlemi devam ediyorsa return et (diğer event handling'i atla)
          if (oauthInProgressRef.current) {
            return;
          }
        }
        
        // INITIAL_SESSION event'i - session'ın ilk yüklendiği zaman
        // Bu durumda session zaten getSession() ile yüklenmiş olabilir
        if (event === 'INITIAL_SESSION') {
          console.log('🔄 Initial session event');
          if (session) {
            setSession(session);
            setUser(session.user ?? null);
            setLoading(false); // Hemen loading'i false yap
            if (session.user) {
              // Profile'ı arka planda yükle
              fetchProfile(session.user.id).catch(console.error);
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
        setLoading(false); // Hemen loading'i false yap
        if (session?.user) {
          // OAuth callback'ten sonra session set edildiğinde oauthInProgress'i false yap
          if (oauthInProgressRef.current) {
            console.log('✅ OAuth callback completed, session set');
            oauthInProgressRef.current = false;
          }
          // Profile ve notification'ı arka planda yükle
          fetchProfile(session.user.id).catch(console.error);
          requestNotificationPermission().catch(console.error);
        } else {
          setProfile(null);
        }
      } catch (error: any) {
        console.error('❌ Error in onAuthStateChange:', error);
        if (isInvalidTokenError(error)) {
          console.log('🔄 Invalid refresh token in onAuthStateChange, clearing session...');
          // Sessizce oturumu temizle
          await supabase.auth.signOut().catch((err) => {
            console.error('Error during signOut:', err);
          });
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
      console.warn('⏰ fetchProfile timeout after 3 seconds');
      setLoading(false);
    }, 3000);

    try {
      // Get current session to access user email
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      // Invalid refresh token hatası durumunda oturumu temizle
      if (sessionError && isInvalidTokenError(sessionError)) {
        console.log('🔄 Invalid refresh token in fetchProfile, clearing session...');
        await supabase.auth.signOut().catch((err) => {
          console.error('Error during signOut:', err);
        });
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
      if (error && isInvalidTokenError(error)) {
        console.log('🔄 Invalid token in profile fetch, clearing session...');
        await supabase.auth.signOut().catch((err) => {
          console.error('Error during signOut:', err);
        });
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
      if (isInvalidTokenError(error)) {
        console.log('🔄 Invalid token exception, clearing session...');
        await supabase.auth.signOut().catch((err) => {
          console.error('Error during signOut:', err);
        });
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    } finally {
      clearTimeout(timeoutId);
      // Loading'i burada false yapma - zaten yukarıda false yapıldı
      // Profile yüklenmesi navigation'ı bloklamamalı
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
        const permission = await requestNotificationPermission();
        if (permission) {
          await registerPushToken(data.user.id);
          setPushRegistered(true);
        }
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

  useEffect(() => {
    if (user?.id && !pushRegistered) {
      (async () => {
        const permission = await requestNotificationPermission();
        if (permission) {
          await registerPushToken(user.id);
          setPushRegistered(true);
        }
      })();
    }
  }, [user?.id, pushRegistered]);

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

  const signInWithOAuth = async (provider: 'google' | 'apple') => {
    setLoading(true);
    oauthInProgressRef.current = true;

    // 60 saniyelik timeout - deep link handler'a güveniyoruz
    const oauthTimeout = setTimeout(() => {
      if (oauthInProgressRef.current) {
        console.warn('⏰ OAuth timeout after 60 seconds');
        oauthInProgressRef.current = false;
        setLoading(false);
      }
    }, 60000); // 60 saniye - kullanıcının OAuth'u tamamlaması için yeterli zaman

    try {
      // Backend HTTPS callback kullan - backend deep link'e yönlendirecek
      const redirectUrl = 'https://modli.mekanizma.com/auth/callback';

      console.log('🔐 OAuth redirect URL:', redirectUrl, 'Provider:', provider);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // ← Önemli: Browser'ı biz açacağız
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            scope: 'openid email profile',
          },
        },
      });

      if (error) {
        console.error('❌ OAuth error:', error);
        clearTimeout(oauthTimeout);
        oauthInProgressRef.current = false;
        setLoading(false);
        return { error };
      }

      // OAuth URL kontrolü
      if (!data || !data.url) {
        console.error('❌ OAuth URL not received');
        clearTimeout(oauthTimeout);
        oauthInProgressRef.current = false;
        setLoading(false);
        return {
          error: {
            message: 'OAuth URL alınamadı. Lütfen tekrar deneyin.',
            code: 'OAUTH_URL_MISSING'
          }
        };
      }

      // System browser'da aç - daha güvenilir!
      console.log('🌐 Opening OAuth URL in system browser:', data.url);
      console.log('📱 Platform:', Platform.OS);

      try {
        // System browser ile aç (Custom Tabs değil!)
        // Bu daha basit ve güvenilir - deep link kesinlikle çalışır
        await Linking.openURL(data.url);

        console.log('✅ Browser opened successfully');
        console.log('⏳ Waiting for deep link callback...');
        console.log('📲 Deep link handler will catch: modli://auth/callback?...');

        // Deep link handler'a güveniyoruz
        // Kullanıcı OAuth'u tamamladığında:
        // 1. Backend modli:// deep link'e yönlendirir
        // 2. _layout.tsx handleDeepLink() çalışır
        // 3. Token'lar parse edilir ve session set edilir
        // 4. oauthInProgressRef.current = false olur
        // 5. Loading durur

        // Hata döndürmüyoruz - deep link handler halledecek
        return { error: null };

      } catch (browserError: any) {
        console.error('❌ Failed to open browser:', browserError);
        clearTimeout(oauthTimeout);
        oauthInProgressRef.current = false;
        setLoading(false);

        return {
          error: {
            message: 'Tarayıcı açılamadı. Lütfen tekrar deneyin.',
            code: 'BROWSER_OPEN_FAILED'
          }
        };
      }
    } catch (err: any) {
      console.error('❌ OAuth exception:', err);
      clearTimeout(oauthTimeout);
      oauthInProgressRef.current = false;
      setLoading(false);
      return { error: { message: err.message || 'Beklenmeyen bir hata oluştu' } };
    }
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
      signInWithOAuth,
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
