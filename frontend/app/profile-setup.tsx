import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '../src/contexts/LanguageContext';
import { useAuth } from '../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToStorage } from '../src/lib/storage';

const styleThemes = [
  { id: 'casual', icon: 'shirt-outline', color: '#22c55e' },
  { id: 'glam', icon: 'sparkles-outline', color: '#ec4899' },
  { id: 'work', icon: 'briefcase-outline', color: '#3b82f6' },
] as const;

const genders = ['male', 'female', 'other'] as const;

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();  // ✅ language'ı da burada al
  const { updateProfile, user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [step, setStep] = useState(1);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState<typeof genders[number] | null>(null);
  const [stylePreference, setStylePreference] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    // ✅ language artık yukarıdaki hook'tan geliyor
    
    try {
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        const permissionType = useCamera 
          ? (language === 'en' ? 'Camera' : 'Kamera')
          : (language === 'en' ? 'Photo Library' : 'Fotoğraf Galerisi');
        
        Alert.alert(
          `🖼️ ${permissionType} ${language === 'en' ? 'Access Needed' : 'Erişimi Gerekli'}`,
          language === 'en' 
            ? `To upload your profile photo, Modli needs permission to access your ${permissionType.toLowerCase()}. This helps us provide better virtual try-on results.\n\nYou can enable this permission in your device settings.`
            : `Profil fotoğrafınızı yüklemek için Modli ${permissionType.toLowerCase()} erişimine ihtiyaç duyuyor. Bu, daha iyi sanal deneme sonuçları sağlamamıza yardımcı olur.\n\nBu izni cihaz ayarlarınızdan etkinleştirebilirsiniz.`,
          [
            {
              text: language === 'en' ? 'Not Now' : 'Şimdi Değil',
              style: 'cancel'
            },
            {
              text: language === 'en' ? '⚙️ Open Settings' : '⚙️ Ayarları Aç',
              onPress: () => Linking.openSettings()
            }
          ]
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.6,
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.6,
            exif: false,
          });

      if (!result.canceled && result.assets[0].uri) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(
        language === 'en' ? '❌ Oops!' : '❌ Hay aksi!',
        language === 'en' 
          ? 'We couldn\'t access your photo. Please try again or check your permissions.' 
          : 'Fotoğrafınıza erişemedik. Lütfen tekrar deneyin veya izinlerinizi kontrol edin.'
      );
    }
  };

  const handleNext = () => {
    if (step === 1 && !avatarUri) {
      Alert.alert('Required', 'Please upload your photo');
      return;
    }
    if (step === 2 && (!height || !weight || !gender)) {
      Alert.alert('Required', 'Please fill all fields');
      return;
    }
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!stylePreference) {
      Alert.alert('Required', 'Please select your style preference');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setLoading(true);
    try {
      let avatarUrl: string | undefined = undefined;

      if (avatarUri) {
        const uploadResult = await uploadImageToStorage(
          avatarUri,
          user.id,
          'profiles',
          `avatar_${Date.now()}`
        );

        if (!uploadResult.success || !uploadResult.fullUrl) {
          throw new Error(uploadResult.error || 'Avatar upload failed');
        }

        avatarUrl = uploadResult.fullUrl;
      }

      const { error } = await updateProfile({
        avatar_url: avatarUrl,
        height: parseFloat(height),
        weight: parseFloat(weight),
        gender: gender || undefined,
        style_preference: stylePreference,
        onboarding_completed: true,
      });

      if (error) {
        Alert.alert('Error', 'Failed to save profile');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('Profile completion error', err);
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => {
    const { language } = useLanguage();
    
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{t.profile.uploadPhoto}</Text>
        
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => {
            Alert.alert(
              t.profile.uploadPhoto,
              '',
              [
                { text: t.profile.takePhoto, onPress: () => pickImage(true) },
                { text: t.profile.chooseFromGallery, onPress: () => pickImage(false) },
                { text: t.common.cancel, style: 'cancel' },
              ]
            );
          }}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="camera" size={50} color="#6366f1" />
              <Text style={styles.avatarText}>{t.profile.uploadPhoto}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        {/* Photo Tips */}
        <View style={styles.photoTip}>
          <Ionicons name="information-circle-outline" size={18} color="#fbbf24" />
          <Text style={styles.photoTipText}>
            {language === 'en'
              ? 'A full-body photo in front of a plain background is recommended for best results'
              : 'Düz bir arka plan önünde boydan resim olması önerilir'}
          </Text>
        </View>
      </View>
    );
  };

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t.profile.setupTitle}</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t.profile.gender}</Text>
        <View style={styles.genderButtons}>
          {genders.map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.genderButton,
                gender === g && styles.genderButtonActive,
              ]}
              onPress={() => setGender(g)}
            >
              <Text style={[
                styles.genderButtonText,
                gender === g && styles.genderButtonTextActive,
              ]}>
                {t.profile[g]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>{t.profile.height}</Text>
          <TextInput
            style={styles.input}
            value={height}
            onChangeText={setHeight}
            keyboardType="numeric"
            placeholder="175"
            placeholderTextColor="#6b7280"
          />
        </View>
        <View style={{ width: 16 }} />
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>{t.profile.weight}</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            placeholder="70"
            placeholderTextColor="#6b7280"
          />
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t.profile.selectTheme}</Text>
      
      <View style={styles.themeContainer}>
        {styleThemes.map((theme) => (
          <TouchableOpacity
            key={theme.id}
            style={[
              styles.themeCard,
              stylePreference === theme.id && { borderColor: theme.color },
            ]}
            onPress={() => setStylePreference(theme.id)}
          >
            <View style={[styles.themeIcon, { backgroundColor: theme.color + '20' }]}>
              <Ionicons name={theme.icon} size={40} color={theme.color} />
            </View>
            <Text style={styles.themeName}>
              {t.profile[theme.id as keyof typeof t.profile]}
            </Text>
            {stylePreference === theme.id && (
              <View style={[styles.checkmark, { backgroundColor: theme.color }]}>
                <Ionicons name="checkmark" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
      ]}
    >
      {/* Progress */}
      <View style={styles.progressContainer}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              s <= step && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      {/* Step Content */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}

      {/* Navigation */}
      <View style={styles.navigation}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(step - 1)}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, step === 1 && { flex: 1 }]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {step === 3 ? t.common.done : t.profile.continue}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 40,
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2d2d44',
  },
  progressDotActive: {
    backgroundColor: '#6366f1',
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 200,
    height: 260,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 200,
    height: 260,
    borderRadius: 16,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#6366f1',
    marginTop: 12,
    fontSize: 14,
  },
  photoTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#fbbf24',
  },
  photoTipText: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 20,
  },
  hint: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  inputRow: {
    flexDirection: 'row',
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2d2d44',
    alignItems: 'center',
  },
  genderButtonActive: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f1' + '20',
  },
  genderButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  genderButtonTextActive: {
    color: '#6366f1',
  },
  themeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  themeCard: {
    width: '45%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2d2d44',
  },
  themeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  themeName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigation: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 40,
  },
  backButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
