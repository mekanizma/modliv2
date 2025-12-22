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
import { ClothingCategory, Season, CLOTHING_COLORS } from '../src/types';
import axios from 'axios';
import { uploadImageToStorage } from '../src/lib/storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const categories: { key: ClothingCategory; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'tops', icon: 'shirt' },
  { key: 'bottoms', icon: 'walk-outline' },
  { key: 'dresses', icon: 'woman-outline' },
  { key: 'outerwear', icon: 'body-outline' },
  { key: 'shoes', icon: 'footsteps' },
  { key: 'accessories', icon: 'bag' },
];

const seasons: Season[] = ['summer', 'winter', 'spring', 'autumn', 'all'];

export default function AddItemScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClothingCategory | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [loading, setSaving] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    try {
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        const permissionType = useCamera 
          ? (language === 'en' ? 'Camera' : 'Kamera')
          : (language === 'en' ? 'Gallery' : 'Galeri');
        
        Alert.alert(
          `📸 ${permissionType} ${language === 'en' ? 'Permission Required' : 'İzni Gerekli'}`,
          language === 'en' 
            ? `Modli needs access to your ${permissionType.toLowerCase()} to add clothing items. Please enable ${permissionType.toLowerCase()} permission in your device settings.`
            : `Modli kıyafet eklemek için ${permissionType.toLowerCase()} erişimine ihtiyaç duyuyor. Lütfen cihaz ayarlarınızdan ${permissionType.toLowerCase()} iznini etkinleştirin.`,
          [
            {
              text: language === 'en' ? 'Cancel' : 'İptal',
              style: 'cancel'
            },
            {
              text: language === 'en' ? 'Open Settings' : 'Ayarları Aç',
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
            quality: 0.5,
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.5,
            exif: false,
          });

      if (!result.canceled && result.assets[0].uri) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(
        language === 'en' ? '❌ Error' : '❌ Hata',
        language === 'en' ? 'Failed to pick image. Please try again.' : 'Resim seçilemedi. Lütfen tekrar deneyin.'
      );
    }
  };

  const handleSave = async () => {
    // Only require image, name, and category (season and color are optional)
    if (!imageUri || !name || !category) {
      Alert.alert(
        language === 'en' ? 'Missing Fields' : 'Eksik Alanlar',
        language === 'en' ? 'Please add photo, name and category' : 'Lütfen fotoğraf, isim ve kategori ekleyin'
      );
      return;
    }

    if (!user) return;

    setSaving(true);
    try {
      console.log('📤 Uploading image to Supabase Storage...');
      const uploadResponse = await uploadImageToStorage(
        imageUri,
        user.id,
        'wardrobe',
        `${category}_${Date.now()}`
      );

      if (!uploadResponse.success || !uploadResponse.fullUrl || !uploadResponse.thumbnailUrl) {
        throw new Error(uploadResponse.error || 'Upload failed');
      }

      const { fullUrl, thumbnailUrl } = uploadResponse;
      console.log('✅ Image uploaded:', { fullUrl, thumbnailUrl });

      // Save to database via backend (service role kullanarak)
      await axios.post(`${BACKEND_URL}/api/wardrobe-items`, {
        user_id: user.id,
        name,
        image_url: fullUrl,
        thumbnail_url: thumbnailUrl,
        category,
        season: season || null,
        color: color || null,
      });

      console.log('✅ Item saved to database');
      router.back();
    } catch (error: any) {
      console.error('Error saving item:', error);
      Alert.alert(
        language === 'en' ? 'Error' : 'Hata', 
        error.response?.data?.error || error.message || (language === 'en' ? 'Failed to save item' : 'Parça kaydedilemedi')
      );
    } finally {
      setSaving(false);
    }
  };

  const getCategoryLabel = (key: string) => {
    const labels: Record<string, string> = {
      tops: t.wardrobe.tops,
      bottoms: t.wardrobe.bottoms,
      dresses: t.wardrobe.dresses,
      outerwear: t.wardrobe.outerwear,
      shoes: t.wardrobe.shoes,
      accessories: t.wardrobe.accessories,
    };
    return labels[key] || key;
  };

  const getSeasonLabel = (key: string) => {
    const labels: Record<string, string> = {
      summer: t.wardrobe.summer,
      winter: t.wardrobe.winter,
      spring: t.wardrobe.spring,
      autumn: t.wardrobe.autumn,
      all: t.wardrobe.allSeasons,
    };
    return labels[key] || key;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t.addItem.title}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Image Picker */}
        <TouchableOpacity
          style={styles.imagePicker}
          onPress={() => {
            Alert.alert(
              t.addItem.choosePhoto,
              '',
              [
                { text: t.addItem.takePhoto, onPress: () => pickImage(true) },
                { text: t.addItem.choosePhoto, onPress: () => pickImage(false) },
                { text: t.common.cancel, style: 'cancel' },
              ]
            );
          }}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.selectedImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="camera" size={40} color="#6366f1" />
              <Text style={styles.imagePlaceholderText}>{t.addItem.takePhoto}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Photo Tips */}
        <View style={styles.photoTip}>
          <Ionicons name="information-circle-outline" size={16} color="#fbbf24" />
          <Text style={styles.photoTipText}>
            {language === 'en' 
              ? 'Take a front photo of your clothing item on a plain surface'
              : 'Düz zemin üzerinde sadece kıyafetinizin karşıdan resmini çekin'}
          </Text>
        </View>

        {/* Name Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t.addItem.itemName}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={language === 'en' ? 'e.g., Blue Denim Jacket' : 'örn., Mavi Kot Ceket'}
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Category */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t.addItem.category}</Text>
          <View style={styles.optionsGrid}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.optionButton,
                  category === cat.key && styles.optionButtonActive,
                ]}
                onPress={() => setCategory(cat.key)}
              >
                <Ionicons
                  name={cat.icon}
                  size={20}
                  color={category === cat.key ? '#fff' : '#6b7280'}
                />
                <Text
                  style={[
                    styles.optionText,
                    category === cat.key && styles.optionTextActive,
                  ]}
                >
                  {getCategoryLabel(cat.key)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Season */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t.addItem.season}
            <Text style={styles.optionalLabel}> ({language === 'en' ? 'Optional' : 'İsteğe Bağlı'})</Text>
          </Text>
          <View style={styles.seasonButtons}>
            {seasons.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.seasonButton,
                  season === s && styles.seasonButtonActive,
                ]}
                onPress={() => setSeason(s)}
              >
                <Text
                  style={[
                    styles.seasonButtonText,
                    season === s && styles.seasonButtonTextActive,
                  ]}
                >
                  {getSeasonLabel(s)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t.addItem.color}
            <Text style={styles.optionalLabel}> ({language === 'en' ? 'Optional' : 'İsteğe Bağlı'})</Text>
          </Text>
          <View style={styles.colorsGrid}>
            {CLOTHING_COLORS.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[
                  styles.colorButton,
                  { backgroundColor: c.value },
                  color === c.value && styles.colorButtonActive,
                ]}
                onPress={() => setColor(c.value)}
              >
                {color === c.value && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={c.value === '#FFFFFF' || c.value === '#FFFF00' || c.value === '#F5F5DC' ? '#000' : '#fff'}
                  />
                )}
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
            <>
              <Ionicons name="checkmark" size={22} color="#fff" />
              <Text style={styles.saveButtonText}>{t.addItem.save}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Fullscreen loading overlay while saving */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>
              {language === 'en' ? 'Saving your item...' : 'Parçan kaydediliyor...'}
            </Text>
            <Text style={styles.loadingSubText}>
              {language === 'en'
                ? "Please don't close the app while we upload your photo."
                : 'Fotoğraf yüklenirken lütfen uygulamayı kapatma.'}
            </Text>
          </View>
        </View>
      )}
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
  closeButton: {
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
  },
  imagePicker: {
    marginTop: 20,
    marginBottom: 24,
  },
  selectedImage: {
    width: '100%',
    height: 300,
    borderRadius: 16,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: '#6366f1',
    marginTop: 8,
    fontSize: 14,
  },
  photoTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#fbbf24',
  },
  photoTipText: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 12,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 10,
    fontWeight: '500',
  },
  optionalLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '400',
    fontStyle: 'italic',
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
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  optionButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  optionText: {
    color: '#6b7280',
    fontSize: 13,
  },
  optionTextActive: {
    color: '#fff',
  },
  seasonButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seasonButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  seasonButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  seasonButtonText: {
    color: '#6b7280',
    fontSize: 13,
  },
  seasonButtonTextActive: {
    color: '#fff',
  },
  colorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonActive: {
    borderColor: '#6366f1',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 16,
    backgroundColor: '#020617',
    alignItems: 'center',
    maxWidth: '80%',
  },
  loadingText: {
    marginTop: 12,
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingSubText: {
    marginTop: 8,
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
  },
});
