import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '../src/contexts/LanguageContext';
import { useAuth } from '../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const genders = ['male', 'female', 'other'] as const;

export default function EditProfileScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { profile, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [height, setHeight] = useState(profile?.height?.toString() || '');
  const [weight, setWeight] = useState(profile?.weight?.toString() || '');
  const [gender, setGender] = useState<typeof genders[number] | null>(
    (profile?.gender as typeof genders[number]) || null
  );
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!height || !weight || !gender) {
      Alert.alert(
        language === 'en' ? 'Required' : 'Gerekli',
        language === 'en' ? 'Please fill all fields' : 'Lütfen tüm alanları doldurun'
      );
      return;
    }

    setLoading(true);
    const { error } = await updateProfile({
      height: parseFloat(height),
      weight: parseFloat(weight),
      gender: gender,
      full_name: fullName || undefined,
    });
    setLoading(false);

    if (error) {
      Alert.alert(
        language === 'en' ? 'Error' : 'Hata',
        language === 'en' ? 'Failed to save' : 'Kaydetme başarısız'
      );
    } else {
      Alert.alert(
        language === 'en' ? 'Saved' : 'Kaydedildi',
        language === 'en' ? 'Profile updated successfully' : 'Profil başarıyla güncellendi'
      );
      router.back();
    }
  };

  const getGenderLabel = (g: typeof genders[number]) => {
    if (g === 'male') return language === 'en' ? 'Male' : 'Erkek';
    if (g === 'female') return language === 'en' ? 'Female' : 'Kadın';
    return language === 'en' ? 'Other' : 'Diğer';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {language === 'en' ? 'Edit Profile' : 'Profil Düzenle'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Full Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {language === 'en' ? 'Full Name' : 'Ad Soyad'}
          </Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder={language === 'en' ? 'Enter your name' : 'Adınızı girin'}
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Height */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {language === 'en' ? 'Height (cm)' : 'Boy (cm)'}
          </Text>
          <TextInput
            style={styles.input}
            value={height}
            onChangeText={setHeight}
            placeholder="175"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
          />
        </View>

        {/* Weight */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {language === 'en' ? 'Weight (kg)' : 'Kilo (kg)'}
          </Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="70"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
          />
        </View>

        {/* Gender */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {language === 'en' ? 'Gender' : 'Cinsiyet'}
          </Text>
          <View style={styles.genderButtons}>
            {genders.map((g) => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.genderButton,
                  gender === g && styles.genderButtonSelected,
                ]}
                onPress={() => setGender(g)}
              >
                <Ionicons
                  name={g === 'male' ? 'male' : g === 'female' ? 'female' : 'male-female'}
                  size={20}
                  color={gender === g ? '#fff' : '#6b7280'}
                />
                <Text
                  style={[
                    styles.genderButtonText,
                    gender === g && styles.genderButtonTextSelected,
                  ]}
                >
                  {getGenderLabel(g)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {language === 'en' ? 'Save Changes' : 'Değişiklikleri Kaydet'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  inputGroup: {
    marginBottom: 24,
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
  genderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a1a2e',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  genderButtonSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  genderButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  genderButtonTextSelected: {
    color: '#fff',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
  },
  saveButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
