import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [hasNavigated, setHasNavigated] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [timeoutReached, setTimeoutReached] = useState(false);

  // Timeout mekanizması - 5 saniye sonra zorla kontrol (hızlı yükleme için)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (hasNavigated) return;
      console.log('⏰ Timeout reached (failsafe), forcing navigation check...');
      setTimeoutReached(true);
      checkNavigation();
    }, 5000);

    return () => clearTimeout(timeout);
  }, [hasNavigated, loading]);

  // Timeout tetiklendikten sonra (veya state güncellendikten sonra) yeniden dene
  useEffect(() => {
    if (!timeoutReached) return;
    if (hasNavigated) return;
    checkNavigation();
  }, [timeoutReached, hasNavigated, session, profile, loading]);

  // Reset hasNavigated only when user ID actually changes (login/logout)
  useEffect(() => {
    const currentSessionId = session?.user?.id || null;
    
    if (currentSessionId !== lastSessionId) {
      console.log('🔄 User changed, resetting navigation flag', {
        from: lastSessionId,
        to: currentSessionId
      });
      setLastSessionId(currentSessionId);
      setHasNavigated(false);
      setTimeoutReached(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    // Don't navigate if already navigated
    if (hasNavigated) {
      return;
    }
    
    // Session yüklenene kadar bekle (loading false olana kadar)
    // Sadece loading false olduğunda ve session kontrolü yapıldığında yönlendir
    if (!loading) {
      checkNavigation();
    }
  }, [loading, session, profile, hasNavigated]);

  const checkNavigation = async () => {
    console.log('🔄 Checking navigation...', {
      loading,
      hasSession: !!session,
      hasProfile: !!profile,
      profileOnboardingCompleted: profile?.onboarding_completed,
      hasNavigated
    });

    try {
      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
      
      // First time user - show app onboarding
      if (!hasSeenOnboarding) {
        console.log('📱 First time user → Showing app onboarding');
        setHasNavigated(true);
        setTimeout(() => router.replace('/(onboarding)'), 50);
        return;
      }

      // Not logged in - show auth
      if (!session) {
        console.log('🔒 No session → Showing auth screen');
        setHasNavigated(true);
        setTimeout(() => router.replace('/(auth)'), 50);
        return;
      }

      // Profile yüklenmesini bekleme - session varsa hemen navigate et
      // Profile arka planda yüklenecek ve gerektiğinde güncellenecek
      if (!profile) {
        console.log('⏳ Profile not loaded yet, but navigating anyway (will load in background)');
        // Profile yüklenene kadar beklemek yerine hemen navigate et
        setHasNavigated(true);
        setTimeout(() => router.replace('/(tabs)'), 50);
        return;
      }

      // Logged in but profile not complete - show profile setup
      if (profile?.onboarding_completed === false) {
        console.log('👤 Profile incomplete → Showing profile setup');
        console.log('Profile data:', { 
          id: profile?.id, 
          email: profile?.email,
          onboarding_completed: profile?.onboarding_completed 
        });
        setHasNavigated(true);
        setTimeout(() => router.replace('/profile-setup'), 50);
        return;
      }

      // All good - go to app
      console.log('✅ All checks passed → Navigating to main app');
      setHasNavigated(true);
      setTimeout(() => router.replace('/(tabs)'), 50);
    } catch (error) {
      console.error('❌ Navigation error:', error);
      setHasNavigated(true);
      setTimeout(() => router.replace('/(onboarding)'), 50);
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
