import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  Modal,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { ClothingCategory } from '../../src/types';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const imageSize = (width - 48) / 2;
const ITEMS_PER_PAGE = 20;

interface TryOnResult {
  id: string;
  user_id: string;
  wardrobe_item_id: string;
  result_image_url: string;  // Supabase Storage URL
  created_at: string;
  wardrobe_item?: {
    id: string;
    name: string;
    category: ClothingCategory;
    season?: string;
  };
}

export default function GalleryScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ fromTryOn?: string; resultUrl?: string; wardrobeItemId?: string }>();
  
  const [results, setResults] = useState<TryOnResult[]>([]);
  const [loading, setLoading] = useState(true);  // İlk yükleme için true
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<TryOnResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [bootstrappedFromTryOn, setBootstrappedFromTryOn] = useState(false);
  
  // Filtreleme state'leri
  const [filteredResults, setFilteredResults] = useState<TryOnResult[]>([]);
  const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const loadFromCache = async () => {
    // Cache removed to prevent SQLITE_FULL error
    // Gallery now loads directly from Supabase with thumbnails for fast loading
    return;
  };

  const fetchResults = useCallback(async (pageNum: number = 0, reset: boolean = false) => {
    if (!user) {
      setLoading(false);
      setInitialLoad(false);
      return;
    }
    
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const from = pageNum * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      console.log(`📥 Fetching gallery page ${pageNum}: items ${from}-${to}`);
      
      // Önce try_on_results'ı çek
      const { data: resultsData, error: resultsError } = await supabase
        .from('try_on_results')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (resultsError) {
        console.error('Fetch error:', resultsError);
        throw resultsError;
      }

      if (!resultsData || resultsData.length === 0) {
        setResults((prevResults) => {
          if (reset) {
            if (bootstrappedFromTryOn && params.fromTryOn === 'true' && params.resultUrl) {
              const optimistic = prevResults.filter((r) => r.id.startsWith('temp-'));
              return optimistic;
            } else {
              return [];
            }
          } else {
            return prevResults;
          }
        });
        setHasMore(false);
        return;
      }

      // Wardrobe item ID'lerini topla
      const wardrobeItemIds = resultsData
        .map((r) => r.wardrobe_item_id)
        .filter((id): id is string => Boolean(id));

      // Wardrobe items'ı çek
      let wardrobeItemsMap: Record<string, { id: string; name: string; category: ClothingCategory; season?: string }> = {};
      
      if (wardrobeItemIds.length > 0) {
        try {
          const { data: itemsData, error: itemsError } = await supabase
            .from('wardrobe_items')
            .select('id, name, category, season')
            .in('id', wardrobeItemIds);

          if (itemsError) {
            console.error('Error fetching wardrobe items:', itemsError);
          } else if (itemsData) {
            itemsData.forEach((item) => {
              wardrobeItemsMap[item.id] = {
                id: item.id,
                name: item.name,
                category: item.category,
                season: item.season || undefined,
              };
            });
          }
        } catch (err) {
          console.error('Error fetching wardrobe items:', err);
        }
      }

      // Results'ı wardrobe items ile birleştir
      const data = resultsData.map((result) => ({
        ...result,
        wardrobe_item: wardrobeItemsMap[result.wardrobe_item_id] || undefined,
      }));

      setResults((prevResults) => {
        if (reset) {
          // Eğer try-on ekranından geldiysek ve optimistik bir kayıt eklediysek,
          // bu kaydı Supabase verisiyle birleştir (ilk açılışta boş görünmesin).
          if (bootstrappedFromTryOn && params.fromTryOn === 'true' && params.resultUrl) {
            const optimistic = prevResults.filter((r) => r.id.startsWith('temp-'));
            return [...optimistic, ...data];
          } else {
            return data;
          }
        } else {
          return [...prevResults, ...data];
        }
      });
      
      // Check if we have more items
      setHasMore(data.length === ITEMS_PER_PAGE);
      console.log(`✅ Loaded ${data.length} items, hasMore: ${data.length === ITEMS_PER_PAGE}`);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setInitialLoad(false);
      setRefreshing(false);
    }
  }, [user, bootstrappedFromTryOn, params.fromTryOn, params.resultUrl]);

  // İlk yükleme için useEffect
  useEffect(() => {
    if (user) {
      setPage(0);
      setHasMore(true);
      setInitialLoad(true);
      fetchResults(0, true);
    }
  }, [user, fetchResults]);

  useFocusEffect(
    useCallback(() => {
      // If coming directly from try-on with a freshly generated image,
      // optimistically inject it into the list for instant UX.
      if (
        !bootstrappedFromTryOn &&
        params.fromTryOn === 'true' &&
        params.resultUrl &&
        user
      ) {
        const optimisticItem: TryOnResult = {
          id: `temp-${Date.now()}`,
          user_id: user.id,
          wardrobe_item_id: params.wardrobeItemId || '',
          result_image_url: params.resultUrl,
          created_at: new Date().toISOString(),
        };
        setResults((prev) => {
          // Eğer aynı URL zaten listede varsa tekrar ekleme
          if (prev.some((r) => r.result_image_url === optimisticItem.result_image_url)) {
            return prev;
          }
          return [optimisticItem, ...prev];
        });
        setBootstrappedFromTryOn(true);
      }

      // Load from cache first for instant display
      loadFromCache();
      // Then fetch fresh data
      if (user) {
        setPage(0);
        setHasMore(true);
        setInitialLoad(true);
        fetchResults(0, true);
      }
    }, [user, params.fromTryOn, params.resultUrl, params.wardrobeItemId, bootstrappedFromTryOn, fetchResults])
  );

  // Filtreleme fonksiyonu
  useEffect(() => {
    let filtered = [...results];

    // Tarih filtresi
    if (selectedDateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.created_at);
        
        switch (selectedDateFilter) {
          case 'today':
            return itemDate >= today;
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return itemDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return itemDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    setFilteredResults(filtered);
  }, [results, selectedDateFilter]);

  // Cache removed to prevent SQLITE_FULL error
  // Using thumbnails from Supabase Storage for fast loading

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
    setFullImageLoaded(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedImage(null);
    setFullImageLoaded(false);
  };

  const handleDownload = async () => {
    if (!selectedImage || !selectedImage.result_image_url) {
      Alert.alert(language === 'en' ? 'Error' : 'Hata', language === 'en' ? 'Image not found' : 'Resim bulunamadı');
      return;
    }
    
    setActionLoading(true);
    try {
      // Önce medya kütüphanesi iznini kontrol et ve iste
      let perm = await MediaLibrary.getPermissionsAsync();
      
      if (!perm.granted) {
        // İzin yoksa izin iste
        perm = await MediaLibrary.requestPermissionsAsync();
        
        if (!perm.granted) {
          // İzin reddedildiyse kullanıcıyı ayarlara yönlendir
          Alert.alert(
            language === 'en' ? 'Permission needed' : 'İzin gerekli',
            language === 'en'
              ? 'Please allow photo library permission to save images in your device settings.'
              : 'Görselleri kaydetmek için cihaz ayarlarından fotoğraf galerisi izni vermeniz gerekiyor.',
            [
              {
                text: language === 'en' ? 'Cancel' : 'İptal',
                style: 'cancel',
              },
              {
                text: language === 'en' ? 'Open Settings' : 'Ayarları Aç',
                onPress: () => Linking.openSettings(),
              },
            ]
          );
          setActionLoading(false);
          return;
        }
      }

      const filename = `modli_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      // Dosyayı local cache'e indir
      const downloadResult = await FileSystem.downloadAsync(selectedImage.result_image_url, fileUri);
      
      if (downloadResult.status !== 200) {
        throw new Error('Download failed');
      }

      // Fotoğrafı galeriye kaydet
      await MediaLibrary.saveToLibraryAsync(fileUri);

      Alert.alert(
        language === 'en' ? 'Saved' : 'Kaydedildi',
        language === 'en' ? 'Image saved to your gallery.' : 'Görsel telefon galerine kaydedildi.'
      );
    } catch (error: any) {
      console.error('Download error:', error);
      Alert.alert(
        language === 'en' ? 'Error' : 'Hata', 
        language === 'en' 
          ? `Failed to save: ${error?.message || 'Unknown error'}` 
          : `Kaydetme başarısız: ${error?.message || 'Bilinmeyen hata'}`
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleShare = async () => {
    const imageUrl = selectedImage?.result_image_url;
    if (!selectedImage || !imageUrl) {
      Alert.alert(language === 'en' ? 'Error' : 'Hata', language === 'en' ? 'Image not found' : 'Resim bulunamadı');
      return;
    }

    setActionLoading(true);
    try {
      const filename = `modli_share_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      // URL'i indir
      await FileSystem.downloadAsync(imageUrl, fileUri);

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
              const imageUrl = selectedImage.result_image_url;
              await AsyncStorage.setItem('tryOnBaseImage', imageUrl);
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

  // Resimleri daha hızlı yüklemek için direkt URL kullanıyoruz
  // Thumbnail'ler backend'de oluşturulmalı veya expo-image kullanılmalı

  // Gallery Image Item Component - Optimized for fast loading
  const GalleryImageItem = React.memo(({ item, onPress }: { item: TryOnResult; onPress: (item: TryOnResult) => void }) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    
    return (
      <TouchableOpacity
        style={styles.imageCard}
        onPress={() => onPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.imageContainer}>
          {imageLoading && (
            <View style={styles.imagePlaceholder}>
              <ActivityIndicator size="small" color="#6366f1" />
            </View>
          )}
          {!imageError ? (
            <Image
              source={{ uri: item.result_image_url }}
              style={[styles.image, imageLoading && styles.imageLoading]}
              contentFit="cover"
              transition={50}
              cachePolicy="memory-disk"
              priority="high"
              onLoadStart={() => {
                setImageLoading(true);
                setImageError(false);
              }}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
            />
          ) : (
            <View style={styles.imageError}>
              <Ionicons name="image-outline" size={24} color="#6b7280" />
            </View>
          )}
        </View>
        <View style={styles.imageDate}>
          <Ionicons name="time-outline" size={12} color="#9ca3af" />
          <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      </TouchableOpacity>
    );
  });

  const renderItem = ({ item }: { item: TryOnResult }) => (
    <GalleryImageItem item={item} onPress={handleImagePress} />
  );

  const renderEmpty = () => {
    const hasFilters = selectedDateFilter !== 'all';
    
    return (
      <View style={styles.emptyState}>
        <Ionicons name="images-outline" size={60} color="#2d2d44" />
        <Text style={styles.emptyTitle}>
          {hasFilters ? t.gallery.noResults : (language === 'en' ? 'No images yet' : 'Henüz görsel yok')}
        </Text>
        <Text style={styles.emptySubtitle}>
          {hasFilters
            ? (language === 'en' ? 'Try adjusting your filters' : 'Filtrelerinizi değiştirmeyi deneyin')
            : (language === 'en' ? 'Your try-on results will appear here' : 'Deneme sonuçlarınız burada görünecek')}
        </Text>
      </View>
    );
  };

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
          <Text style={styles.title}>{t.gallery.title}</Text>
          <Text style={styles.subtitle}>
            {filteredResults.length}/{results.length} {language === 'en' ? 'images' : 'görsel'}
          </Text>
        </View>
        {initialLoad && (
          <ActivityIndicator size="small" color="#6366f1" />
        )}
      </View>

      {/* Filtreleme UI */}
      <View style={styles.filtersContainer}>
        {/* Tarih Filtreleri */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateScroll}
          contentContainerStyle={styles.dateContent}
        >
          {[
            { key: 'all' as const, label: t.gallery.all },
            { key: 'today' as const, label: t.gallery.today },
            { key: 'week' as const, label: t.gallery.thisWeek },
            { key: 'month' as const, label: t.gallery.thisMonth },
          ].map((date) => (
            <TouchableOpacity
              key={date.key}
              style={[
                styles.dateChip,
                selectedDateFilter === date.key && styles.dateChipActive,
              ]}
              onPress={() => setSelectedDateFilter(date.key)}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.dateText,
                  selectedDateFilter === date.key && styles.dateTextActive,
                ]}
              >
                {date.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filtreleri Temizle */}
        {selectedDateFilter !== 'all' && (
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={() => {
              setSelectedDateFilter('all');
            }}
          >
            <Ionicons name="close-circle" size={16} color="#6366f1" />
            <Text style={styles.clearFiltersText}>{t.gallery.clearFilters}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredResults}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        ListEmptyComponent={initialLoad ? null : renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        removeClippedSubviews={true}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={30}
        initialNumToRender={6}
        windowSize={6}
      />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={[styles.modalCloseButton, { top: insets.top + 10 }]} onPress={closeModal}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {selectedImage && (
            <View style={styles.imageWrapper}>
              <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContentContainer}
                maximumZoomScale={5}
                minimumZoomScale={1}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                centerContent={true}
                bouncesZoom={true}
                scrollEventThrottle={16}
              >
                <Image 
                  source={{ uri: selectedImage.result_image_url }} 
                  style={styles.fullImage} 
                  contentFit="contain"
                  onLoad={() => {
                    setFullImageLoaded(true);
                  }}
                  transition={100}
                  cachePolicy="memory-disk"
                />
              </ScrollView>
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
  imageContainer: { width: '100%', height: imageSize * 1.3, position: 'relative' },
  image: { width: '100%', height: imageSize * 1.3 },
  imageLoading: { opacity: 0 },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  imageError: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  imageDate: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  dateText: { color: '#9ca3af', fontSize: 11 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, width: '100%' },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { color: '#6b7280', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  footerLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 10 },
  footerText: { color: '#9ca3af', fontSize: 13 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalCloseButton: { position: 'absolute', right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  imageWrapper: { flex: 1, width: width, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  scrollContainer: { flex: 1, width: width },
  scrollContentContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullImage: { 
    width: width, 
    height: height * 0.7,
  },
  modalActions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 20, paddingTop: 20, backgroundColor: 'rgba(0,0,0,0.8)' },
  modalButton: { alignItems: 'center', gap: 4 },
  modalButtonText: { color: '#fff', fontSize: 12 },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0a0a0a',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#6366f1' + '40',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  categoriesScroll: {
    maxHeight: 52,
    marginBottom: 10,
  },
  categoriesContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1.5,
    borderColor: '#2d2d44',
  },
  categoryButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  categoryText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dateScroll: {
    maxHeight: 40,
  },
  dateContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0a0a0a',
  },
  dateChipActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#4f46e5' + '20',
  },
  dateText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  dateTextActive: {
    color: '#a5b4fc',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#6366f1' + '20',
  },
  clearFiltersText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
  },
});
