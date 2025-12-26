import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../src/contexts/AuthContext';

/**
 * Catch-all route for unmatched routes
 * Handles OAuth callback deep links that Expo Router tries to route
 */
export default function UnmatchedRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useAuth();

  useEffect(() => {
    // Check if this is an OAuth callback
    const url = params.pathname || '';
    const isOAuthCallback = url.includes('auth/callback') || 
                           Object.keys(params).some(key => key.includes('access_token') || key.includes('refresh_token'));

    if (isOAuthCallback) {
      console.log('🔐 OAuth callback detected in unmatched route');
      console.log('🔐 Params:', params);
      
      // OAuth callback is handled by deep link listener in _layout.tsx
      // Just redirect to home page - the deep link listener will handle the session
      setTimeout(() => {
        router.replace('/');
      }, 100);
      return;
    }

    // Not an OAuth callback - show error or redirect
    console.warn('⚠️ Unmatched route:', url);
    setTimeout(() => {
      // Redirect to home or auth based on session
      if (session) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)');
      }
    }, 1000);
  }, [params, router, session]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Yönlendiriliyor...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
  },
});

