import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/lib/supabase';

export default function SignInScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { signIn, signInWithOAuth, profile, user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null);

  // Load saved credentials
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  // Navigate after successful login - works for both email/password AND OAuth
  useEffect(() => {
    // AuthContext loading tamamlandı, user ve profile var
    if (!authLoading && user && profile) {
      console.log('🚀 User and profile loaded, navigating...');
      console.log('🚀 Profile onboarding status:', profile.onboarding_completed);
      
      // Local loading state'lerini temizle
      setLoading(false);
      setOauthLoading(null);
      
      // Navigate based on onboarding status
      if (profile.onboarding_completed === false) {
        console.log('👤 Profile incomplete → Going to profile setup');
        router.replace('/profile-setup');
      } else {
        console.log('✅ Profile complete → Going to main app');
        router.replace('/(tabs)');
      }
    }
  }, [user, profile, authLoading]);

  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('savedEmail');
      const savedRememberMe = await AsyncStorage.getItem('rememberMe');
      
      if (savedRememberMe === 'true' && savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(
        language === 'en' ? 'Email Required' : 'E-posta Gerekli',
        language === 'en' 
          ? 'Please enter your email address to reset your password' 
          : 'Şifrenizi sıfırlamak için e-posta adresinizi girin'
      );
      return;
    }

    setResetLoading(true);
    try {
      // Şifre sıfırlama e-postası her zaman web reset sayfasına yönlendirilsin
      const resetLink = 'https://modli.mekanizma.com/reset-password';
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetLink,
      });

      if (error) {
        Alert.alert(
          language === 'en' ? 'Error' : 'Hata',
          error.message
        );
      } else {
        Alert.alert(
          language === 'en' ? 'Check Your Email' : 'E-postanızı Kontrol Edin',
          language === 'en' 
            ? 'We have sent you a password reset link. Please check your email.' 
            : 'Size bir şifre sıfırlama bağlantısı gönderdik. Lütfen e-postanızı kontrol edin.'
        );
      }
    } catch (err: any) {
      Alert.alert(
        language === 'en' ? 'Error' : 'Hata',
        err.message || (language === 'en' ? 'Failed to send reset email' : 'Sıfırlama e-postası gönderilemedi')
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert(
        language === 'en' ? 'Error' : 'Hata',
        language === 'en' ? 'Please fill in all fields' : 'Lütfen tüm alanları doldurun'
      );
      return;
    }

    setLoading(true);
    try {
      // Save email if remember me is checked
      if (rememberMe) {
        await AsyncStorage.setItem('savedEmail', email);
        await AsyncStorage.setItem('rememberMe', 'true');
        // Session zaten Supabase tarafından otomatik olarak SecureStore'da saklanıyor
        // persistSession: true ayarı sayesinde
      } else {
        await AsyncStorage.removeItem('savedEmail');
        await AsyncStorage.setItem('rememberMe', 'false');
        // Eğer "Beni Hatırla" kapalıysa, çıkış yapıldığında session'ı temizle
        // Ancak şu anki giriş için session'ı sakla (kullanıcı deneyimi için)
        // Çıkış yapıldığında session zaten temizlenecek
      }

      console.log('🔑 Attempting sign in...');
      const { error } = await signIn(email, password);
      
      if (error) {
        Alert.alert(
          language === 'en' ? 'Error' : 'Hata',
          error.message
        );
        setLoading(false);
      } else {
        console.log('✅ Sign in successful, waiting for profile to load...');
        // Keep loading state true, wait for profile to load
        // AuthContext will trigger onAuthStateChange and load profile
        // We'll navigate once profile is ready
      }
    } catch (err: any) {
      Alert.alert(
        language === 'en' ? 'Error' : 'Hata',
        err.message || (language === 'en' ? 'Sign in failed' : 'Giriş başarısız')
      );
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google') => {
    setOauthLoading(provider);
    try {
      console.log(`🔐 Starting ${provider} OAuth sign in...`);
      const { error } = await signInWithOAuth(provider);
      
      if (error) {
        console.error(`❌ ${provider} OAuth error:`, error);
        Alert.alert(
          language === 'en' ? 'Error' : 'Hata',
          error.message || (language === 'en' 
            ? `${provider} sign in failed` 
            : `${provider} girişi başarısız`)
        );
        setOauthLoading(null); // Hata durumunda loading'i temizle
      }
      // Başarılı olursa AuthContext profile fetch edecek ve yukarıdaki useEffect navigation yapacak
      // setOauthLoading(null) useEffect içinde yapılacak
    } catch (err: any) {
      console.error(`❌ ${provider} OAuth exception:`, err);
      Alert.alert(
        language === 'en' ? 'Error' : 'Hata',
        err.message || (language === 'en' 
          ? 'OAuth sign in failed' 
          : 'OAuth girişi başarısız')
      );
      setOauthLoading(null); // Hata durumunda loading'i temizle
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Language Toggle */}
        <TouchableOpacity
          style={styles.langButton}
          onPress={() => setLanguage(language === 'en' ? 'tr' : 'en')}
        >
          <Text style={styles.langText}>{language === 'en' ? 'TR' : 'EN'}</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Image 
            source={require('../../assets/images/modli-logo.png')} 
            style={styles.logo}
          />
          <Text style={styles.title}>Modli</Text>
          <Text style={styles.subtitle}>{t.auth.signIn}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t.auth.email}
              placeholderTextColor="#6b7280"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t.auth.password}
              placeholderTextColor="#6b7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>

          {/* Remember Me & Forgot Password Row */}
          <View style={styles.optionsRow}>
            <TouchableOpacity 
              style={styles.rememberMeContainer}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.rememberMeText}>
                {language === 'en' ? 'Remember me' : 'Beni hatırla'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.forgotPassword} 
              onPress={handleForgotPassword}
              disabled={resetLoading}
            >
              {resetLoading ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <Text style={styles.forgotPasswordText}>{t.auth.forgotPassword}</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signInButtonText}>{t.auth.signIn}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t.auth.orContinueWith}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Buttons */}
        <View style={styles.socialButtons}>
          <TouchableOpacity 
            style={[styles.socialButton, oauthLoading === 'google' && styles.socialButtonDisabled]}
            onPress={() => handleOAuthSignIn('google')}
            disabled={oauthLoading !== null}
          >
            {oauthLoading === 'google' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-google" size={24} color="#fff" />
                <Text style={styles.socialButtonText}>{t.auth.google}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Up Link */}
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>{t.auth.dontHaveAccount} </Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Text style={styles.signUpLink}>{t.auth.signUp}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  langButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  langText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#9ca3af',
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366f1',
  },
  rememberMeText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  forgotPassword: {},
  forgotPasswordText: {
    color: '#6366f1',
    fontSize: 14,
  },
  signInButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2d2d44',
  },
  dividerText: {
    color: '#6b7280',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  socialButtonDisabled: {
    opacity: 0.6,
  },
  socialButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  signUpText: {
    color: '#6b7280',
    fontSize: 14,
  },
  signUpLink: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
});
