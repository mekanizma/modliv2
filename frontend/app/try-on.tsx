import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLanguage } from '../src/contexts/LanguageContext';
import { useAuth } from '../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { WardrobeItem } from '../src/types';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function TryOnScreen() {
  const router = useRouter();
  const { itemId, useStoredBase } = useLocalSearchParams<{ itemId?: string; useStoredBase?: string }>();
  const { t, language } = useLanguage();
  const { profile, user, updateProfile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseImage, setBaseImage] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
    loadBaseImage();
  }, []);

  useEffect(() => {
    if (itemId && items.length > 0) {
      const item = items.find((i) => i.id === itemId);
      if (item) setSelectedItem(item);
    }
  }, [itemId, items]);

  const loadBaseImage = async () => {
    if (useStoredBase === 'true') {
      try {
        const storedImage = await AsyncStorage.getItem('tryOnBaseImage');
        if (storedImage) {
          setBaseImage(storedImage);
          // Clear after loading to free memory
          await AsyncStorage.removeItem('tryOnBaseImage');
        }
      } catch (error) {
        console.error('Error loading base image:', error);
      }
    }
  };

  const fetchItems = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('wardrobe_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setItems(data);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedItem || !profile) return;

    if ((profile.credits || 0) <= 0) {
      Alert.alert(
        t.tryOn.noCredits,
        language === 'en' ? 'Purchase credits to continue' : 'Devam etmek için kredi satın alın',
        [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.tryOn.buyCredits, onPress: () => router.push('/subscription') },
        ]
      );
      return;
    }

    // Use baseImage if provided (layering mode), otherwise use avatar
    const userImage = baseImage || profile.avatar_url;
    
    if (!userImage) {
      Alert.alert(
        language === 'en' ? 'No Photo' : 'Fotoğraf Yok',
        language === 'en' ? 'Please upload your photo first' : 'Lütfen önce fotoğrafınızı yükleyin'
      );
      return;
    }

    setGenerating(true);
    setResultImage(null);

    try {
      // Check if this is a free trial (credits === 1 means first free try)
      const isFreeTrial = (profile.credits || 0) === 1;
      
      console.log(baseImage ? '🔄 Layering mode: Adding clothing on top of existing result' : '✨ Normal mode: Using profile photo');
      
      const response = await axios.post(`${BACKEND_URL}/api/try-on`, {
        user_id: user?.id,
        user_image: userImage,
        clothing_image: selectedItem.image_base64,
        clothing_category: selectedItem.category,
        is_free_trial: isFreeTrial,
      });

      if (response.data.success) {
        setResultImage(response.data.result_image);
        // Deduct credit
        await updateProfile({ credits: (profile.credits || 0) - 1 });
        await refreshProfile();
      } else {
        throw new Error(response.data.error || 'Generation failed');
      }
    } catch (error: any) {
      console.error('Error generating try-on:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || error.message || 'Failed to generate try-on'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveResult = async () => {
    if (!resultImage || !user || !selectedItem) return;

    try {
      await supabase.from('try_on_results').insert({
        user_id: user.id,
        wardrobe_item_id: selectedItem.id,
        result_image_base64: resultImage,
      });

      Alert.alert(
        language === 'en' ? 'Saved!' : 'Kaydedildi!',
        language === 'en' ? 'Result saved to your gallery' : 'Sonuç galerinize kaydedildi'
      );
    } catch (error) {
      console.error('Error saving result:', error);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t.tryOn.title}</Text>
        <View style={styles.creditsChip}>
          <Ionicons name="sparkles" size={14} color="#fbbf24" />
          <Text style={styles.creditsText}>{profile?.credits || 0}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Layering Mode Info Banner */}
        {baseImage && (
          <View style={styles.layeringBanner}>
            <Ionicons name="layers-outline" size={20} color="#6366f1" />
            <Text style={styles.layeringBannerText}>
              {language === 'en' 
                ? 'Layering Mode: Adding clothing on top of your previous result'
                : 'Katmanlama Modu: Önceki sonucunuzun üzerine kıyafet ekleniyor'}
            </Text>
          </View>
        )}

        {/* Result or User Photo */}
        <View style={styles.previewContainer}>
          {generating ? (
            <View style={styles.generatingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.generatingText}>{t.tryOn.generating}</Text>
              {baseImage && (
                <Text style={styles.generatingSubtext}>
                  {language === 'en' ? 'Adding new layer...' : 'Yeni katman ekleniyor...'}
                </Text>
              )}
            </View>
          ) : resultImage ? (
            <Image source={{ uri: resultImage }} style={styles.resultImage} />
          ) : baseImage ? (
            <Image source={{ uri: baseImage }} style={styles.userImage} />
          ) : profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.userImage} />
          ) : (
            <View style={styles.noAvatarContainer}>
              <Ionicons name="person" size={60} color="#6b7280" />
              <Text style={styles.noAvatarText}>
                {language === 'en' ? 'No photo uploaded' : 'Fotoğraf yüklenmedi'}
              </Text>
            </View>
          )}
        </View>

        {/* Selected Item Preview */}
        {selectedItem && (
          <View style={styles.selectedItemContainer}>
            <Text style={styles.sectionTitle}>
              {language === 'en' ? 'Selected Item' : 'Seçilen Parça'}
            </Text>
            <View style={styles.selectedItemCard}>
              <Image source={{ uri: selectedItem.image_base64 }} style={styles.selectedItemImage} />
              <View style={styles.selectedItemInfo}>
                <Text style={styles.selectedItemName}>{selectedItem.name}</Text>
                <Text style={styles.selectedItemCategory}>
                  {t.wardrobe[selectedItem.category as keyof typeof t.wardrobe]}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedItem(null)}>
                <Ionicons name="close-circle" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Items Grid */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>{t.tryOn.selectItem}</Text>
          {loading ? (
            <ActivityIndicator color="#6366f1" />
          ) : items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {language === 'en' ? 'No items in wardrobe' : 'Gardropta parça yok'}
              </Text>
              <TouchableOpacity
                style={styles.addItemButton}
                onPress={() => router.push('/add-item')}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addItemText}>{t.wardrobe.addItem}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.itemCard,
                    selectedItem?.id === item.id && styles.itemCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedItem(item);
                    setResultImage(null);
                  }}
                >
                  <Image source={{ uri: item.image_base64 }} style={styles.itemImage} />
                  {selectedItem?.id === item.id && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {resultImage ? (
          <View style={styles.resultActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setResultImage(null);
              }}
            >
              <Ionicons name="refresh" size={20} color="#6366f1" />
              <Text style={styles.secondaryButtonText}>{t.tryOn.tryAnother}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveResult}>
              <Ionicons name="download" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>{t.tryOn.saveResult}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.generateButton,
              (!selectedItem || generating) && styles.generateButtonDisabled,
            ]}
            onPress={handleGenerate}
            disabled={!selectedItem || generating}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={22} color="#fff" />
                <Text style={styles.generateButtonText}>{t.tryOn.generate}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
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
  creditsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  creditsText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  layeringBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  layeringBannerText: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 18,
  },
  previewContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    height: 400,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  userImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  resultImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  generatingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatingText: {
    color: '#9ca3af',
    marginTop: 16,
    fontSize: 16,
  },
  generatingSubtext: {
    color: '#6b7280',
    marginTop: 8,
    fontSize: 13,
    fontStyle: 'italic',
  },
  noAvatarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noAvatarText: {
    color: '#6b7280',
    marginTop: 12,
    fontSize: 14,
  },
  selectedItemContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  selectedItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  selectedItemImage: {
    width: 50,
    height: 60,
    borderRadius: 8,
  },
  selectedItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  selectedItemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedItemCategory: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  itemsSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  itemCard: {
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemCardSelected: {
    borderColor: '#6366f1',
  },
  itemImage: {
    width: 80,
    height: 100,
    backgroundColor: '#1a1a2e',
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 16,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addItemText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
  },
  generateButtonDisabled: {
    backgroundColor: '#6366f1' + '60',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#6366f1' + '20',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  secondaryButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
