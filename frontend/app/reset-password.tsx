import React, { useEffect, useState, useMemo } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { supabase } from '../src/lib/supabase';
import { useLanguage } from '../src/contexts/LanguageContext';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage } = useLanguage();
  const params = useLocalSearchParams();
  const currentUrl = Linking.useURL();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const urlParams = useMemo(() => {
    const parsed = Linking.parse(currentUrl || '');
    return {
      access_token: (params.access_token as string) || (parsed.queryParams?.access_token as string),
      refresh_token: (params.refresh_token as string) || (parsed.queryParams?.refresh_token as string),
    };
  }, [params, currentUrl]);

  useEffect(() => {
    const ensureSession = async () => {
      try {
        // Eğer linkle gelindiyse token'ları setSession ile yükle
        if (urlParams.access_token && urlParams.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: urlParams.access_token,
            refresh_token: urlParams.refresh_token,
          });
          if (error) {
            console.error('Error setting session from reset link:', error);
            Alert.alert(
              language === 'en' ? 'Error' : 'Hata',
              language === 'en'
                ? 'Could not validate reset link. Please request a new email.'
                : 'Sıfırlama linki doğrulanamadı. Lütfen yeni bir e-posta isteyin.'
            );
          } else {
            setSessionReady(true);
          }
        } else {
          // Zaten oturum varsa kullan
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setSessionReady(true);
          }
        }
      } catch (error: any) {
        console.error('Session check error:', error);
      }
    };

    ensureSession();
  }, [urlParams.access_token, urlParams.refresh_token, language]);

  const handleUpdatePassword = async () => {
    if (!sessionReady) {
      Alert.alert(
        language === 'en' ? 'Link Needed' : 'Link Gerekli',
        language === 'en'
          ? 'Please open this page from the reset link in your email.'
          : 'Lütfen bu sayfayı e-postadaki sıfırlama bağlantısından açın.'
      );
      return;
    }

    if (!newPassword || !confirmPassword) {
      Alert.alert(
        language === 'en' ? 'Error' : 'Hata',
        language === 'en' ? 'Fill all fields' : 'Tüm alanları doldurun'
      );
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(
        language === 'en' ? 'Error' : 'Hata',
        language === 'en' ? 'Password must be at least 6 characters' : 'Şifre en az 6 karakter olmalı'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        language === 'en' ? 'Error' : 'Hata',
        language === 'en' ? 'Passwords do not match' : 'Şifreler aynı değil'
      );
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      Alert.alert(language === 'en' ? 'Error' : 'Hata', error.message);
      return;
    }

    Alert.alert(
      language === 'en' ? t.auth.passwordUpdated : t.auth.passwordUpdated,
      language === 'en'
        ? 'Your password has been updated. You can sign in with the new password.'
        : 'Şifren güncellendi. Yeni şifreyle giriş yapabilirsin.',
      [{ text: 'OK', onPress: () => router.replace('/(auth)') }]
    );
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
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.langButton}
            onPress={() => setLanguage(language === 'en' ? 'tr' : 'en')}
          >
            <Text style={styles.langText}>{language === 'en' ? 'TR' : 'EN'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Ionicons name="lock-open" size={32} color="#fbbf24" />
          <Text style={styles.title}>{t.auth.resetPasswordTitle}</Text>
          <Text style={styles.subtitle}>{t.auth.resetInstruction}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t.auth.newPassword}
              placeholderTextColor="#6b7280"
              value={newPassword}
              onChangeText={setNewPassword}
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

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t.auth.confirmPassword}
              placeholderTextColor="#6b7280"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.actionButton, !sessionReady && styles.buttonDisabled]}
            onPress={handleUpdatePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionText}>{t.auth.updatePassword}</Text>
            )}
          </TouchableOpacity>

          {!sessionReady && (
            <Text style={styles.helperText}>
              {language === 'en'
                ? 'Use the reset link in your email to open this page.'
                : 'Bu sayfayı e-postadaki sıfırlama bağlantısından açın.'}
            </Text>
          )}
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  langButton: {
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
    marginTop: 32,
    marginBottom: 32,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  form: {
    marginTop: 8,
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 16,
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
  actionButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});

