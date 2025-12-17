import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const imageSize = (width - 48) / 2;
const ITEMS_PER_PAGE = 20;

interface TryOnResult {
  id: string;
  user_id: string;
  wardrobe_item_id: string;
  result_image_base64: string;
  created_at: string;
}

export default function GalleryScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [results, setResults] = useState<TryOnResult[]>([]);
  const [loading, setLoading] = useState(false);  // Changed to false for instant open
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<TryOnResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  useFocusEffect(
    useCallback(() => {
      // Load from cache first for instant display
      loadFromCache();
      // Then fetch fresh data
      setPage(0);
      setHasMore(true);
      setInitialLoad(true);
      fetchResults(0, true);
    }, [user])
  );

  const loadFromCache = async () => {
    try {
      const cacheKey = `gallery_cache_${user?.id}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        console.log(`⚡ Loaded ${cachedData.length} items from cache`);
        setResults(cachedData);
        setInitialLoad(false);
      }
    } catch (error) {
      console.error('Error loading from cache:', error);
    }
  };

  const fetchResults = async (pageNum: number = 0, reset: boolean = false) => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    if (!reset && !hasMore) return;
    
    try {
      const from = pageNum * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      console.log(`📥 Fetching gallery page ${pageNum}: items ${from}-${to}`);
      
      const { data, error } = await supabase
        .from('try_on_results')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Fetch error:', error);
      } else if (data) {
        const newResults = reset ? data : [...results, ...data];
        
        if (reset) {
          setResults(data);
          // Save first page to cache for instant loading
          saveToCache(data);
        } else {
          setResults(newResults);
        }
        
        // Check if we have more items
        setHasMore(data.length === ITEMS_PER_PAGE);
        console.log(`✅ Loaded ${data.length} items, hasMore: ${data.length === ITEMS_PER_PAGE}`);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setInitialLoad(false);
    }
  };

  const saveToCache = async (data: TryOnResult[]) => {
    try {
      const cacheKey = `gallery_cache_${user?.id}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      console.log(`💾 Saved ${data.length} items to cache`);
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      const nextPage = page + 1;
      setPage(nextPage);
      fetchResults(nextPage, false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    await fetchResults(0, true);
    setRefreshing(false);
  };

  const handleImagePress = (item: TryOnResult) => {
    setSelectedImage(item);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedImage(null);
  };

  const handleDownload = async () => {
    if (!selectedImage || !selectedImage.result_image_base64) {
      Alert.alert(language === 'en' ? 'Error' : 'Hata', language === 'en' ? 'Image not found' : 'Resim bulunamadı');
      return;
    }
    
    setActionLoading(true);
    try {
      let base64Data = selectedImage.result_image_base64;
      if (base64Data.includes('base64,')) {
        base64Data = base64Data.split('base64,')[1];
      }
      
      const filename = `modli_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: 'base64' });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'image/jpeg' });
      } else {
        Alert.alert(language === 'en' ? 'Error' : 'Hata', language === 'en' ? 'Sharing not available' : 'Paylaşım kullanılamıyor');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert(language === 'en' ? 'Error' : 'Hata', language === 'en' ? 'Failed to save' : 'Kaydetme başarısız');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedImage || !selectedImage.result_image_base64) {
      Alert.alert(language === 'en' ? 'Error' : 'Hata', language === 'en' ? 'Image not found' : 'Resim bulunamadı');
      return;
    }
    
    setActionLoading(true);
    try {
      let base64Data = selectedImage.result_image_base64;
      if (base64Data.includes('base64,')) {
        base64Data = base64Data.split('base64,')[1];
      }
      
      const filename = `modli_share_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: 'base64' });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'image/jpeg' });
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert(language === 'en' ? 'Error' : 'Hata', language === 'en' ? 'Share failed' : 'Paylaşım başarısız');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTryAnother = () => {
    if (!selectedImage) return;
    
    Alert.alert(
      language === 'en' ? 'Try Another Clothing' : 'Başka Kıyafet Dene',
      language === 'en' 
        ? 'This will use this image as base and add another clothing item on top. 1 credit will be used.' 
        : 'Bu görsel temel alınarak üzerine başka bir kıyafet eklenecek. 1 kredi harcanacak.',
      [
        { text: language === 'en' ? 'Cancel' : 'İptal', style: 'cancel' },
        {
          text: language === 'en' ? 'Continue' : 'Devam Et',
          onPress: async () => {
            closeModal();
            // Store base image in AsyncStorage for faster navigation
            try {
              await AsyncStorage.setItem('tryOnBaseImage', selectedImage.result_image_base64);
              // Navigate with just a flag instead of huge base64 string
              router.push({
                pathname: '/try-on',
                params: { useStoredBase: 'true' }
              });
            } catch (error) {
              console.error('Error storing base image:', error);
              Alert.alert(
                language === 'en' ? 'Error' : 'Hata',
                language === 'en' ? 'Failed to prepare layering mode' : 'Katmanlama modu hazırlanamadı'
              );
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!selectedImage) return;
    
    Alert.alert(
      language === 'en' ? 'Delete' : 'Sil',
      language === 'en' ? 'Delete this image?' : 'Bu görseli silmek istiyor musunuz?',
      [
        { text: language === 'en' ? 'Cancel' : 'İptal', style: 'cancel' },
        {
          text: language === 'en' ? 'Delete' : 'Sil',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              console.log('Deleting image:', selectedImage.id);
              const { error, count } = await supabase
                .from('try_on_results')
                .delete()
                .eq('id', selectedImage.id)
                .select();
              
              console.log('Delete result - error:', error, 'count:', count);
              
              if (error) {
                console.error('Delete error from Supabase:', error);
                Alert.alert(language === 'en' ? 'Error' : 'Hata', error.message);
              } else {
                // Remove from local state
                const newResults = results.filter(r => r.id !== selectedImage.id);
                setResults(newResults);
                // Update cache
                saveToCache(newResults);
                closeModal();
                Alert.alert(language === 'en' ? 'Deleted' : 'Silindi', language === 'en' ? 'Image deleted successfully' : 'Görsel başarıyla silindi');
              }
            } catch (err: any) {
              console.error('Delete exception:', err);
              Alert.alert(language === 'en' ? 'Error' : 'Hata', err.message || 'Unknown error');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: TryOnResult }) => (
    <TouchableOpacity 
      style={styles.imageCard} 
      onPress={() => handleImagePress(item)} 
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: item.result_image_base64 }} 
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.imageDate}>
        <Ionicons name="time-outline" size={12} color="#9ca3af" />
        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons name="images-outline" size={60} color="#2d2d44" />
      <Text style={styles.emptyTitle}>{language === 'en' ? 'No images yet' : 'Henüz görsel yok'}</Text>
      <Text style={styles.emptySubtitle}>{language === 'en' ? 'Your try-on results will appear here' : 'Deneme sonuçlarınız burada görünecek'}</Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#6366f1" />
        <Text style={styles.footerText}>
          {language === 'en' ? 'Loading more...' : 'Daha fazla yükleniyor...'}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{language === 'en' ? 'My Gallery' : 'Galerim'}</Text>
          <Text style={styles.subtitle}>
            {results.length > 0 ? `${results.length}+ ` : ''}{language === 'en' ? 'images' : 'görsel'}
          </Text>
        </View>
        {initialLoad && (
          <ActivityIndicator size="small" color="#6366f1" />
        )}
      </View>

      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        ListEmptyComponent={initialLoad ? null : renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={5}
      />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={[styles.modalCloseButton, { top: insets.top + 10 }]} onPress={closeModal}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {selectedImage && (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: selectedImage.result_image_base64 }} style={styles.fullImage} resizeMode="contain" />
            </View>
          )}

          <View style={[styles.modalActions, { paddingBottom: insets.bottom + 20 }]}>
            {actionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <TouchableOpacity style={styles.modalButton} onPress={handleTryAnother}>
                  <Ionicons name="add-circle-outline" size={24} color="#6366f1" />
                  <Text style={[styles.modalButtonText, { color: '#6366f1' }]}>
                    {language === 'en' ? 'Add More' : 'Ekle'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.modalButton} onPress={handleDownload}>
                  <Ionicons name="download-outline" size={24} color="#fff" />
                  <Text style={styles.modalButtonText}>{language === 'en' ? 'Save' : 'Kaydet'}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.modalButton} onPress={handleShare}>
                  <Ionicons name="share-outline" size={24} color="#fff" />
                  <Text style={styles.modalButtonText}>{language === 'en' ? 'Share' : 'Paylaş'}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.modalButton} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={24} color="#ef4444" />
                  <Text style={[styles.modalButtonText, { color: '#ef4444' }]}>{language === 'en' ? 'Delete' : 'Sil'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingVertical: 16 
  },
  headerLeft: { flex: 1 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  content: { flex: 1 },
  grid: { paddingHorizontal: 16 },
  row: { gap: 12, marginBottom: 12 },
  imageCard: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1a1a2e', maxWidth: imageSize },
  image: { width: '100%', height: imageSize * 1.3 },
  imageDate: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  dateText: { color: '#9ca3af', fontSize: 11 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, width: '100%' },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { color: '#6b7280', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  footerLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 10 },
  footerText: { color: '#9ca3af', fontSize: 13 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalCloseButton: { position: 'absolute', right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  imageWrapper: { flex: 1, width: width, justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: width, height: height * 0.7 },
  modalActions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 20, paddingTop: 20, backgroundColor: 'rgba(0,0,0,0.8)' },
  modalButton: { alignItems: 'center', gap: 4 },
  modalButtonText: { color: '#fff', fontSize: 12 },
});
