import React, { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LanguageProvider } from '../src/contexts/LanguageContext';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, LogBox, Image, Animated } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useLanguage } from '../src/contexts/LanguageContext';
import { ensureDailyOutfitReminderScheduled } from '../src/lib/notifications';
import * as SplashScreen from 'expo-splash-screen';

// Splash screen'i manuel olarak kontrol et
SplashScreen.preventAutoHideAsync();

// Reanimated shared value inline style uyarısını gizle
LogBox.ignoreLogs([
  "It looks like you might be using shared value's .value inside reanimated inline style",
]);

function CustomSplashScreen({ visible }: { visible: boolean }) {
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const [shouldRender, setShouldRender] = useState(true);

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
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/modli-logo.png')}
            style={styles.splashLogo}
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

  useEffect(() => {
    // Uygulama hazır olduğunda splash screen'i kapat
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {});
      // Custom splash'i de kapat
      setTimeout(() => {
        onReady();
      }, 500);
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
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  splashLogo: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
});
