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
        if (event === 'SIGNED_IN' && oauthInProgressRef.current) {
          console.log('✅ OAuth SIGNED_IN detected, clearing loading state');
          oauthInProgressRef.current = false;
          setLoading(false);
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            fetchProfile(session.user.id).catch(console.error);
            requestNotificationPermission().catch(console.error);
          }
          return;
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
    
    const oauthTimeout = setTimeout(() => {
      if (oauthInProgressRef.current) {
        console.warn('⏰ OAuth timeout after 10 seconds');
        oauthInProgressRef.current = false;
        setLoading(false);
      }
    }, 10000); // 60000'den 10000'e düşür
    
    try {
      // Backend HTTPS callback kullan - Google OAuth modli:// native deep link'i desteklemiyor
      // Backend callback sayfası token'ları alıp modli:// deep link'e yönlendirecek
      const redirectUrl = 'https://modli.mekanizma.com/auth/callback';

      console.log('🔐 OAuth redirect URL:', redirectUrl, 'Provider:', provider);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        console.error('❌ OAuth error:', error);
        clearTimeout(oauthTimeout);
        oauthInProgressRef.current = false;
        setLoading(false);
        return { error };
      }

      // OAuth URL kontrolü - eğer URL yoksa hata döndür
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

      // OAuth URL'i tarayıcıda aç
      console.log('🌐 Opening OAuth URL:', data.url);
      
      try {
        // Tüm platformlarda openAuthSessionAsync kullan
        // Backend callback token'ları alıp modli:// deep link'e yönlendirecek
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        // Type guard ile url property'sine güvenli erişim
        const resultUrl = 'url' in result ? result.url : null;
        console.log(`📱 OAuth result (${Platform.OS}):`, result.type, resultUrl);

        if (result.type === 'success' && resultUrl) {
          // URL'den token'ları parse et
          let accessToken: string | null = null;
          let refreshToken: string | null = null;

          try {
            // modli:// deep link formatını kontrol et
            if (resultUrl.includes('modli://')) {
              const urlMatch = resultUrl.match(/modli:\/\/[^?]+\?(.*)/);
              if (urlMatch) {
                const params = new URLSearchParams(urlMatch[1]);
                accessToken = params.get('access_token');
                refreshToken = params.get('refresh_token');
                // URL decode (URLSearchParams otomatik decode yapar ama emin olmak için)
                if (accessToken) accessToken = decodeURIComponent(accessToken);
                if (refreshToken) refreshToken = decodeURIComponent(refreshToken);
              } else {
                // Hash formatı
                const hashMatch = resultUrl.match(/modli:\/\/[^#]+#(.*)/);
                if (hashMatch) {
                  const params = new URLSearchParams(hashMatch[1]);
                  accessToken = params.get('access_token');
                  refreshToken = params.get('refresh_token');
                  if (accessToken) accessToken = decodeURIComponent(accessToken);
                  if (refreshToken) refreshToken = decodeURIComponent(refreshToken);
                }
              }
            } else {
              // Normal URL formatı
              const url = new URL(resultUrl);
              // Hash veya query params'tan token'ları al
              const hash = url.hash.substring(1);
              const params = new URLSearchParams(hash || url.search);
              
              accessToken = params.get('access_token');
              refreshToken = params.get('refresh_token');
              // URL decode (URLSearchParams otomatik decode yapar ama emin olmak için)
              if (accessToken) accessToken = decodeURIComponent(accessToken);
              if (refreshToken) refreshToken = decodeURIComponent(refreshToken);
            }
          } catch (parseError) {
            console.error('URL parse error:', parseError);
            // Alternatif: regex ile parse et
            const accessTokenMatch = resultUrl.match(/access_token=([^&]*)/);
            const refreshTokenMatch = resultUrl.match(/refresh_token=([^&]*)/);
            accessToken = accessTokenMatch ? decodeURIComponent(accessTokenMatch[1]) : null;
            refreshToken = refreshTokenMatch ? decodeURIComponent(refreshTokenMatch[1]) : null;
          }

          if (accessToken && refreshToken) {
            // Session'ı set et
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              clearTimeout(oauthTimeout);
              oauthInProgressRef.current = false;
              setLoading(false);
              return { error: sessionError };
            }

            // Profile'i yükle
            if (sessionData.session?.user) {
              await fetchProfile(sessionData.session.user.id);
              await requestNotificationPermission();
            }
            clearTimeout(oauthTimeout);
            oauthInProgressRef.current = false;
            setLoading(false);
            return { error: null };
          } else {
            clearTimeout(oauthTimeout);
            oauthInProgressRef.current = false;
            setLoading(false);
            return { error: { message: 'Token\'lar alınamadı. Lütfen tekrar deneyin.' } };
          }
        } else if (result.type === 'cancel') {
          clearTimeout(oauthTimeout);
          oauthInProgressRef.current = false;
          setLoading(false);
          return { error: { message: 'OAuth işlemi iptal edildi.' } };
        } else if (result.type === 'dismiss') {
          // Android'de dismiss durumunda deep link çalışmış olabilir
          // Session kontrolü yap - eğer session varsa başarılı demektir
          console.log('📱 OAuth dismissed - checking session (Android workaround)...');
          
          // Android'de dismiss durumunda session kontrolü yap
          if (Platform.OS === 'android') {
            // İlk kontrol: 2 saniye sonra (deep link işlenmesi için yeterli zaman)
            setTimeout(async () => {
              if (oauthInProgressRef.current) {
                console.log('📱 Android: Checking session after dismiss (2s)...');
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (currentSession) {
                  console.log('✅ Android: Session found after dismiss (2s), OAuth succeeded!');
                  clearTimeout(oauthTimeout);
                  oauthInProgressRef.current = false;
                  
                  setSession(currentSession);
                  setUser(currentSession.user);
                  await fetchProfile(currentSession.user.id);
                  await requestNotificationPermission().catch(console.error);
                  setLoading(false);
                } else {
                  console.log('⚠️ Android: No session found after 2s, waiting...');
                }
              }
            }, 2000); // 1s → 2s (daha güvenilir)
            
            // İkinci kontrol: 5 saniye sonra
            setTimeout(async () => {
              if (oauthInProgressRef.current) {
                console.log('📱 Android: Session check after dismiss (5s)...');
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (currentSession) {
                  console.log('✅ Android: Session found on 5s check!');
                  clearTimeout(oauthTimeout);
                  oauthInProgressRef.current = false;
                  
                  setSession(currentSession);
                  setUser(currentSession.user);
                  await fetchProfile(currentSession.user.id);
                  await requestNotificationPermission().catch(console.error);
                  setLoading(false);
                } else {
                  console.log('⚠️ Android: No session found after 5s, waiting...');
                }
              }
            }, 5000);
            
            // Üçüncü kontrol: 8 saniye sonra (bazı yavaş cihazlar için)
            setTimeout(async () => {
              if (oauthInProgressRef.current) {
                console.log('📱 Android: Final session check after dismiss (8s)...');
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (currentSession) {
                  console.log('✅ Android: Session found on final 8s check!');
                  clearTimeout(oauthTimeout);
                  oauthInProgressRef.current = false;
                  
                  setSession(currentSession);
                  setUser(currentSession.user);
                  await fetchProfile(currentSession.user.id);
                  await requestNotificationPermission().catch(console.error);
                  setLoading(false);
                } else {
                  console.log('❌ Android: No session found after 8s, OAuth was cancelled or failed');
                  clearTimeout(oauthTimeout);
                  oauthInProgressRef.current = false;
                  setLoading(false);
                }
              }
            }, 8000); // YENİ: 8 saniye final check
            
            // Hemen hata döndürme - session kontrolü yapılıyor
            return { error: null };
          } else {
            // iOS'ta dismiss gerçekten iptal demektir
            console.log('📱 OAuth dismissed by user (iOS)');
            clearTimeout(oauthTimeout);
            oauthInProgressRef.current = false;
            setLoading(false);
            return { error: { message: 'OAuth işlemi iptal edildi.' } };
          }
        } else {
          // Başka durum - deep link bekleniyor
          console.log('📱 OAuth result type:', result.type);
          console.log('📱 OAuth: waiting for deep link callback...');
          console.log('📱 Deep link should be: modli://auth/callback?access_token=...&refresh_token=...');

          // 5 saniye sonra session kontrol et (Android deep link için)
          setTimeout(async () => {
            if (oauthInProgressRef.current) {
              console.log('📱 Checking session after OAuth (5s)...');
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (currentSession) {
                console.log('✅ Session found after OAuth, updating all UI states...');
                oauthInProgressRef.current = false;
                
                // ÇÖZÜM: State'leri manuel olarak güncelle
                setSession(currentSession);
                setUser(currentSession.user);
                
                // Profile'i fetch et
                await fetchProfile(currentSession.user.id);
                await requestNotificationPermission().catch(console.error);
                
                // Loading'i en son false yap
                setLoading(false);
              } else {
                console.log('⚠️ No session found after 5s, waiting longer...');
              }
            }
          }, 5000);

          // 10 saniye timeout ekle (fallback)
          setTimeout(async () => {
            if (oauthInProgressRef.current) {
              console.warn('⚠️ Deep link timeout after 10 seconds, final session check...');
              
              // Son bir kez daha session kontrol et
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (currentSession) {
                console.log('✅ Session found on final timeout check, updating UI...');
                
                setSession(currentSession);
                setUser(currentSession.user);
                await fetchProfile(currentSession.user.id);
                await requestNotificationPermission().catch(console.error);
              } else {
                console.error('❌ No session found after 10 seconds - OAuth likely failed');
              }
              
              oauthInProgressRef.current = false;
              setLoading(false);
            }
          }, 10000);

          return { error: null };
        }
      } catch (browserError: any) {
        // WebBrowser açma hatası
        console.error('❌ WebBrowser error:', browserError);
        clearTimeout(oauthTimeout);
        oauthInProgressRef.current = false;
        setLoading(false);
        
        // Daha açıklayıcı hata mesajı
        let errorMessage = 'Tarayıcı açılamadı. Lütfen tekrar deneyin.';
        if (browserError.message) {
          errorMessage = browserError.message;
        } else if (browserError.toString && browserError.toString().includes('expo-web-browser')) {
          errorMessage = 'OAuth tarayıcısı başlatılamadı. Lütfen uygulamayı yeniden başlatıp tekrar deneyin.';
        }
        
        return { 
          error: { 
            message: errorMessage,
            code: 'BROWSER_ERROR'
          }
        };
      }
    } catch (err: any) {
      console.error('❌ OAuth sign in error:', err);
      clearTimeout(oauthTimeout);
      oauthInProgressRef.current = false;
      setLoading(false);
      return { 
        error: { 
          message: err.message || 'OAuth girişi sırasında bir hata oluştu.',
          code: 'OAUTH_ERROR'
        }
      };
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
