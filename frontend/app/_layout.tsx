import React, { useEffect, useState } from 'react';
import { Slot, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LanguageProvider } from '../src/contexts/LanguageContext';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, LogBox, Image, Animated, Dimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useLanguage } from '../src/contexts/LanguageContext';
import { ensureDailyOutfitReminderScheduled } from '../src/lib/notifications';
import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../src/lib/supabase';

// Splash screen'i manuel olarak kontrol et
// Sadece native platformlarda preventAutoHideAsync çağır
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch((error) => {
    // Hata durumunda yok say (custom splash zaten var)
    console.log('Splash screen preventAutoHide error (ignored):', error.message);
  });
}

// Reanimated shared value inline style uyarısını gizle
LogBox.ignoreLogs([
  "It looks like you might be using shared value's .value inside reanimated inline style",
]);

function CustomSplashScreen({ visible }: { visible: boolean }) {
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const [shouldRender, setShouldRender] = useState(true);
  const { width, height } = Dimensions.get('window');
  
  // Logo boyutunu ekran boyutuna göre ayarla (ekran genişliğinin %35'i)
  const logoSize = Math.min(width * 0.35, height * 0.35, 280);

  useEffect(() => {
    if (!visible) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible, fadeAnim]);

  if (!shouldRender) return null;

  return (
    <Animated.View
      style={[
        styles.splashContainer,
        {
          opacity: fadeAnim,
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.splashContent}>
        <View style={[styles.logoContainer, { width: logoSize, height: logoSize }]}>
          <Image
            source={require('../assets/images/modli-logo.png')}
            style={[styles.splashLogo, { width: logoSize, height: logoSize }]}
            resizeMode="contain"
          />
        </View>
      </View>
    </Animated.View>
  );
}

function AppBootstrap({ onReady }: { onReady: () => void }) {
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    // Deep link listener - OAuth callback'i yakala
    const handleDeepLink = async (event: { url: string }) => {
      console.log('='.repeat(60));
      console.log('🔗 DEEP LINK RECEIVED');
      console.log('='.repeat(60));
      console.log('🔗 URL:', event.url);
      console.log('🔗 URL length:', event.url.length);
      console.log('🔗 Timestamp:', new Date().toISOString());

      // Expo dev URL'lerini yok say (exp://...)
      if (event.url.startsWith('exp://') || event.url.startsWith('exps://')) {
        console.log('🔗 Expo dev URL detected, ignoring');
        console.log('='.repeat(60));
        return;
      }

      // OAuth callback deep link'lerini kontrol et - bunlar route değil, sadece callback
      const isOAuthCallback = event.url.includes('modli://auth/callback') ||
                              event.url.includes('intent://auth/callback') ||
                              (event.url.includes('modli://') && event.url.includes('access_token'));

      console.log('🔍 Is OAuth callback?', isOAuthCallback);
      console.log('🔍 Contains modli://auth/callback?', event.url.includes('modli://auth/callback'));
      console.log('🔍 Contains access_token?', event.url.includes('access_token'));

      if (isOAuthCallback) {
        console.log('✅ OAuth callback deep link detected - handling OAuth callback');
        // Expo Router'ın bu URL'i route olarak yorumlamasını engellemek için
        // Deep link'i handle ediyoruz ve return ediyoruz
        // Bu sayede Expo Router bu URL'i route olarak yorumlamayacak
      }
      
      try {
        let accessToken: string | null = null;
        let refreshToken: string | null = null;
        let type: string | null = null;
        
        // Intent URL kontrolü (Android) - EN ÖNCE KONTROL ET
        // Format: intent://auth/callback?access_token=XXX&refresh_token=YYY#Intent;scheme=modli;package=...;end
        if (event.url.includes('intent://')) {
          console.log('🔗 Detected Android Intent URL');
          console.log('🔗 Full Intent URL:', event.url);
          
          // Intent URL'den query string'i parse et
          // intent://auth/callback?access_token=XXX&refresh_token=YYY#Intent;...
          const intentMatch = event.url.match(/intent:\/\/[^?]*\?([^#]*)/);
          if (intentMatch) {
            console.log('🔗 Found query string in intent:', intentMatch[1]);
            const params = new URLSearchParams(intentMatch[1]);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
            type = params.get('type');
            // URL decode
            if (accessToken) accessToken = decodeURIComponent(accessToken);
            if (refreshToken) refreshToken = decodeURIComponent(refreshToken);
            console.log('🔗 Parsed tokens from intent - access_token:', accessToken ? 'found' : 'missing', 'refresh_token:', refreshToken ? 'found' : 'missing');
          } else {
            console.warn('⚠️ No query string found in intent URL');
            // Fallback: Tüm URL'den regex ile parse et
            const accessTokenMatch = event.url.match(/access_token=([^&]*)/);
            const refreshTokenMatch = event.url.match(/refresh_token=([^&]*)/);
            if (accessTokenMatch && refreshTokenMatch) {
              accessToken = decodeURIComponent(accessTokenMatch[1]);
              refreshToken = decodeURIComponent(refreshTokenMatch[1]);
              console.log('🔗 Parsed tokens from intent (fallback regex)');
            }
          }
        }
        // Deep link formatını parse et (modli://auth/callback?access_token=...&refresh_token=...)
        else if (event.url.includes('modli://')) {
          console.log('🔗 Detected modli:// deep link');
          
          // modli://auth/callback?access_token=...&refresh_token=... formatı
          const urlMatch = event.url.match(/modli:\/\/[^?]+\?(.*)/);
          if (urlMatch) {
            console.log('🔗 Found query string:', urlMatch[1]);
            const params = new URLSearchParams(urlMatch[1]);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
            type = params.get('type');
            // URL decode
            if (accessToken) accessToken = decodeURIComponent(accessToken);
            if (refreshToken) refreshToken = decodeURIComponent(refreshToken);
            console.log('🔗 Parsed tokens - access_token:', accessToken ? 'found' : 'missing', 'refresh_token:', refreshToken ? 'found' : 'missing');
          } else {
            // modli://auth/callback#access_token=...&refresh_token=... formatı (hash)
            const hashMatch = event.url.match(/modli:\/\/[^#]+#(.*)/);
            if (hashMatch) {
              console.log('🔗 Found hash:', hashMatch[1]);
              const params = new URLSearchParams(hashMatch[1]);
              accessToken = params.get('access_token');
              refreshToken = params.get('refresh_token');
              type = params.get('type');
              // URL decode
              if (accessToken) accessToken = decodeURIComponent(accessToken);
              if (refreshToken) refreshToken = decodeURIComponent(refreshToken);
              console.log('🔗 Parsed tokens from hash - access_token:', accessToken ? 'found' : 'missing', 'refresh_token:', refreshToken ? 'found' : 'missing');
            } else {
              console.warn('⚠️ No query string or hash found in modli:// URL');
            }
          }
        } else if (event.url.includes('auth/callback')) {
          // HTTPS URL formatı (https://modli.mekanizma.com/auth/callback?...)
          console.log('🔗 Detected HTTPS callback URL');
          try {
            const url = new URL(event.url);
            const hash = url.hash.substring(1);
            const params = new URLSearchParams(hash || url.search);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
            type = params.get('type');
            // URL decode
            if (accessToken) accessToken = decodeURIComponent(accessToken);
            if (refreshToken) refreshToken = decodeURIComponent(refreshToken);
            console.log('🔗 Parsed tokens from HTTPS - access_token:', accessToken ? 'found' : 'missing', 'refresh_token:', refreshToken ? 'found' : 'missing');
          } catch (parseError) {
            console.error('❌ URL parse error:', parseError);
            // Alternatif: regex ile parse et
            const accessTokenMatch = event.url.match(/access_token=([^&]*)/);
            const refreshTokenMatch = event.url.match(/refresh_token=([^&]*)/);
            accessToken = accessTokenMatch ? decodeURIComponent(accessTokenMatch[1]) : null;
            refreshToken = refreshTokenMatch ? decodeURIComponent(refreshTokenMatch[1]) : null;
            console.log('🔗 Parsed tokens from regex - access_token:', accessToken ? 'found' : 'missing', 'refresh_token:', refreshToken ? 'found' : 'missing');
          }
        } else {
          console.warn('⚠️ URL does not contain modli://, intent:// or auth/callback:', event.url);
        }
        
        // OAuth callback kontrolü
        if (accessToken && refreshToken) {
          console.log('🔐 OAuth callback detected, setting session...');
          console.log('🔐 Access token length:', accessToken.length);
          console.log('🔐 Refresh token length:', refreshToken.length);
          console.log('🔐 Access token preview:', accessToken.substring(0, 20) + '...');
          console.log('🔐 Refresh token preview:', refreshToken.substring(0, 20) + '...');
          
          try {
            console.log('🔐 Calling supabase.auth.setSession...');
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            console.log('🔐 setSession response received');
            console.log('🔐 Session data:', sessionData ? 'exists' : 'null');
            console.log('🔐 Session error:', sessionError ? 'exists' : 'null');
            
            if (sessionError) {
              console.error('❌ Session set error:', sessionError);
              console.error('❌ Error message:', sessionError.message);
              console.error('❌ Error code:', sessionError.status);
              console.error('❌ Full error:', JSON.stringify(sessionError, null, 2));
              // Hata durumunda auth sayfasına yönlendir
              setTimeout(() => {
                router.replace('/(auth)');
              }, 500);
            } else if (sessionData?.session) {
              console.log('✅ Session set successfully');
              console.log('✅ User ID:', sessionData.session.user?.id);
              console.log('✅ User email:', sessionData.session.user?.email);
              console.log('✅ Session expires at:', sessionData.session.expires_at);
              console.log('✅ Access token valid:', sessionData.session.access_token ? 'yes' : 'no');
              
              // onAuthStateChange event'i otomatik tetiklenecek ve AuthContext güncellenecek
              // Bu sayede loading state'i de otomatik olarak false olacak
              // Biraz bekle ki onAuthStateChange event'i işlensin
              // SIGNED_IN event'i tetiklenmesi için zaman ver
              console.log('🔄 Waiting for onAuthStateChange SIGNED_IN event...');
              setTimeout(() => {
                console.log('🔄 Redirecting after OAuth success...');
                console.log('🔄 onAuthStateChange should have updated AuthContext by now');
                router.replace('/');
              }, 1000); // 500ms'den 1000ms'ye çıkardık - onAuthStateChange için daha fazla zaman
              
              return; // Deep link handling tamamlandı, return et
            } else {
              console.warn('⚠️ Session set returned no session data');
              console.warn('⚠️ Session data:', JSON.stringify(sessionData, null, 2));
              setTimeout(() => {
                router.replace('/(auth)');
              }, 500);
            }
          } catch (sessionError: any) {
            console.error('❌ Exception setting session:', sessionError);
            console.error('❌ Error details:', JSON.stringify(sessionError, null, 2));
            console.error('❌ Error stack:', sessionError.stack);
            setTimeout(() => {
              router.replace('/(auth)');
            }, 500);
          }
          return; // OAuth callback handle edildi, return et
        } else if (type === 'recovery') {
          // Password recovery callback
          console.log('🔐 Password recovery callback detected');
          return; // Recovery callback handle edildi
        } else if (isOAuthCallback) {
          // OAuth callback ama token'lar bulunamadı
          console.warn('⚠️ OAuth callback detected but no tokens found');
          console.warn('⚠️ URL:', event.url);
          setTimeout(() => {
            router.replace('/(auth)');
          }, 500);
          return; // OAuth callback handle edildi (hata ile)
        } else {
          console.warn('⚠️ Deep link received but no tokens found');
          console.warn('⚠️ URL:', event.url);
          console.warn('⚠️ accessToken:', accessToken ? 'exists' : 'missing');
          console.warn('⚠️ refreshToken:', refreshToken ? 'exists' : 'missing');
          // OAuth callback değilse, normal deep link olarak işle
        }
      } catch (error) {
        console.error('❌ Deep link parse error:', error);
        console.error('❌ Error details:', JSON.stringify(error));
      }
    };

    // İlk açılışta URL'i kontrol et
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 Initial URL:', url);
        handleDeepLink({ url });
      }
    }).catch((error) => {
      console.error('❌ Error getting initial URL:', error);
    });

    // Deep link listener'ı ekle
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // Uygulama hazır olduğunda splash screen'i kapat
    if (!loading) {
      // Native splash screen'i güvenli şekilde kapat
      SplashScreen.hideAsync().catch((error) => {
        // Native splash screen hatası varsa yok say (custom splash zaten var)
        console.log('Splash screen hide error (ignored):', error.message);
      });
      // Custom splash'i hemen kapat (delay kaldırıldı)
      onReady();
    }
  }, [loading, onReady]);

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        // Giriş yapan kullanıcı için her gün 07:30'da günlük kombin bildirimi planla
        // Geliştirme ortamında (DEV) anında test bildirimi de göster
        await ensureDailyOutfitReminderScheduled(language, { debugImmediate: __DEV__ });
      } catch (error) {
        console.warn('Failed to init daily outfit notifications', error);
      }
    })();
  }, [user, language]);

  return <Slot />;
}

export default function RootLayout() {
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  // Native splash screen'i hemen kapat
  useEffect(() => {
    if (Platform.OS !== 'web') {
      SplashScreen.hideAsync().catch((error) => {
        console.log('Splash screen hide error (ignored):', error.message);
      });
    }
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <LanguageProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <View style={styles.container}>
              <AppBootstrap onReady={() => setShowCustomSplash(false)} />
            </View>
            <CustomSplashScreen visible={showCustomSplash} />
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splashContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  splashContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    resizeMode: 'contain',
  },
});
