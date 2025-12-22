import React, { useEffect, useState, useCallback } from 'react';
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
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { WardrobeItem, ClothingCategory, Season } from '../../src/types';
import { WardrobeCabinet } from '../../src/components/WardrobeCabinet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Extrapolate,
  FadeInDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const categories: { key: ClothingCategory | 'all'; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', icon: 'grid' },
  { key: 'tops', icon: 'shirt' },
  { key: 'bottoms', icon: 'walk-outline' },
  { key: 'dresses', icon: 'woman-outline' },
  { key: 'outerwear', icon: 'body-outline' },
  { key: 'shoes', icon: 'footsteps' },
  { key: 'accessories', icon: 'bag' },
];

const seasons: { key: Season | 'all'; label: string }[] = [
  { key: 'all', label: 'allSeasons' },
  { key: 'summer', label: 'summer' },
  { key: 'winter', label: 'winter' },
  { key: 'spring', label: 'spring' },
  { key: 'autumn', label: 'autumn' },
];

const { width } = Dimensions.get('window');
// Kartlar arasında ve kenarlarda boşluk: 2*20 padding + 2*6 margin = 52
const imageSize = (width - 52) / 2;
const ITEMS_PER_PAGE = 20;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function WardrobeScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WardrobeItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | 'all'>('all');
  const [selectedSeason, setSelectedSeason] = useState<Season | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [loading, setLoading] = useState(true); // İlk yükleme için true
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isCabinetOpen, setIsCabinetOpen] = useState(false);
  const cabinetOpacity = useSharedValue(1);
  const contentOpacity = useSharedValue(0);
  const cabinetOpenValue = useSharedValue(0);

  const fetchItems = useCallback(async (pageNum: number = 0, reset: boolean = false) => {
    if (!user || (loadingMore && !reset)) return;
    
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const from = pageNum * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      console.log(`📥 Fetching wardrobe page ${pageNum}: items ${from}-${to}`);
      
      const { data, error } = await supabase
        .from('wardrobe_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        setItems((prevItems) => {
          const newItems = reset ? data : [...prevItems, ...data];
          return newItems;
        });
        setHasMore(data.length === ITEMS_PER_PAGE);
        console.log(`✅ Loaded ${data.length} wardrobe items, hasMore: ${data.length === ITEMS_PER_PAGE}`);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [user, loadingMore]);

  // İlk yükleme için useEffect
  useEffect(() => {
    if (user) {
      setPage(0);
      setHasMore(true);
      fetchItems(0, true);
    }
  }, [user, fetchItems]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setPage(0);
        setHasMore(true);
        setIsCabinetOpen(false);
        cabinetOpacity.value = 1;
        contentOpacity.value = 0;
        fetchItems(0, true);
      }
    }, [user, fetchItems])
  );

  useEffect(() => {
    filterItems();
  }, [items, selectedCategory, selectedSeason, searchQuery]);

  const filterItems = () => {
    let filtered = [...items];
    
    // Arama sorgusu ile filtreleme
    if (searchQuery.trim()) {
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }
    if (selectedSeason !== 'all') {
      filtered = filtered.filter(
        (item) => item.season === selectedSeason || item.season === 'all'
      );
    }
    setFilteredItems(filtered);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchItems(nextPage, false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    await fetchItems(0, true);
  };

  const handleCabinetOpen = () => {
    setIsCabinetOpen(true);
    cabinetOpacity.value = withTiming(0, { duration: 400 });
    contentOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
  };

  const handleDeleteItem = (item: WardrobeItem) => {
    Alert.alert(
      language === 'en' ? 'Delete Item' : 'Parçayı Sil',
      language === 'en' ? 'Are you sure you want to delete this item?' : 'Bu parçayı silmek istediğinize emin misiniz?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('wardrobe_items')
              .delete()
              .eq('id', item.id);
            
            if (!error) {
              setItems((prevItems) => prevItems.filter((i) => i.id !== item.id));
            }
          },
        },
      ]
    );
  };

  // Kıyafet animasyonu için shared value
  useEffect(() => {
    if (isCabinetOpen) {
      cabinetOpenValue.value = withTiming(1, { duration: 800 });
    } else {
      cabinetOpenValue.value = 0;
    }
  }, [isCabinetOpen, cabinetOpenValue]);

  const renderItem = ({ item, index }: { item: WardrobeItem; index: number }) => {
    const delay = index * 80;

    return (
      <AnimatedTouchable
        style={styles.itemCard}
        onPress={() => router.push({ pathname: '/try-on', params: { itemId: item.id } })}
        onLongPress={() => handleDeleteItem(item)}
        activeOpacity={0.85}
        entering={isCabinetOpen ? FadeInDown.delay(delay).duration(400).springify() : undefined}
      >
        <View style={styles.itemImageWrapper}>
          <Image
            source={{ uri: item.thumbnail_url || item.image_url }}
            style={styles.itemImage}
            resizeMode="cover"
            fadeDuration={200}
            progressiveRenderingEnabled={true}
          />
          {item.color && (
            <View style={styles.itemColorBadge}>
              <View style={[styles.colorDot, { backgroundColor: item.color }]} />
            </View>
          )}
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.itemTags}>
            {item.season && (
              <View style={styles.seasonPill}>
                <Ionicons name="sunny-outline" size={12} color="#a5b4fc" />
                <Text style={styles.itemSeason}>
                  {t.wardrobe[item.season as keyof typeof t.wardrobe]}
                </Text>
              </View>
            )}
          </View>
        </View>
      </AnimatedTouchable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons name="shirt-outline" size={60} color="#2d2d44" />
      <Text style={styles.emptyTitle}>{t.wardrobe.empty}</Text>
      <Text style={styles.emptySubtitle}>{t.wardrobe.addFirst}</Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/add-item')}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.emptyButtonText}>{t.wardrobe.addItem}</Text>
      </TouchableOpacity>
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

  const getCategoryLabel = (key: string) => {
    const labels: Record<string, string> = {
      all: t.wardrobe.all,
      tops: t.wardrobe.tops,
      bottoms: t.wardrobe.bottoms,
      dresses: t.wardrobe.dresses,
      outerwear: t.wardrobe.outerwear,
      shoes: t.wardrobe.shoes,
      accessories: t.wardrobe.accessories,
    };
    return labels[key] || key;
  };

  const totalItems = items.length;
  const visibleItems = filteredItems.length;

  const cabinetStyle = useAnimatedStyle(() => {
    return {
      opacity: cabinetOpacity.value,
      position: cabinetOpacity.value === 0 ? 'absolute' : 'relative',
      zIndex: cabinetOpacity.value === 0 ? -1 : 1,
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      flex: 1,
    };
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Dolap - İlk açılışta gösterilir */}
      {!isCabinetOpen && (
        <Animated.View style={[styles.cabinetWrapper, cabinetStyle]}>
          <WardrobeCabinet 
            onOpen={handleCabinetOpen} 
            isOpen={isCabinetOpen}
            clothes={filteredItems}
          />
        </Animated.View>
      )}

      {/* İçerik - Dolap açıldıktan sonra gösterilir */}
      {isCabinetOpen && (
        <Animated.View style={[contentStyle, { flex: 1 }]}>
          {/* Header */}
          <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t.wardrobe.title}</Text>
            <Text style={styles.subtitle}>
              {visibleItems}/{totalItems}{' '}
              {language === 'en' ? 'items shown' : 'parça görüntüleniyor'}
            </Text>
          </View>
          <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setIsSearchActive(!isSearchActive)}
            activeOpacity={0.9}
          >
            <Ionicons name={isSearchActive ? "close" : "search"} size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/add-item')}
            activeOpacity={0.9}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input */}
      {isSearchActive && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={language === 'en' ? 'Search by item name...' : 'Parça ismine göre ara...'}
            placeholderTextColor="#6b7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter kapsayıcı */}
      <View style={styles.filtersContainer}>
        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContent}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryButton,
                selectedCategory === cat.key && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(cat.key)}
              activeOpacity={0.9}
            >
              <Ionicons
                name={cat.icon}
                size={20}
                color={selectedCategory === cat.key ? '#ffffff' : '#6b7280'}
              />
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat.key && styles.categoryTextActive,
                ]}
              >
                {getCategoryLabel(cat.key)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Seasons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.seasonsScroll}
          contentContainerStyle={styles.seasonsContent}
        >
          {seasons.map((season) => (
            <TouchableOpacity
              key={season.key}
              style={[
                styles.seasonChip,
                selectedSeason === season.key && styles.seasonChipActive,
              ]}
              onPress={() => setSelectedSeason(season.key)}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.seasonText,
                  selectedSeason === season.key && styles.seasonTextActive,
                ]}
              >
                {t.wardrobe[season.label as keyof typeof t.wardrobe]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Items Grid */}
      {loading && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>
            {language === 'en' ? 'Loading...' : 'Yükleniyor...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={({ item, index }) => renderItem({ item, index })}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          style={styles.itemsContainer}
          contentContainerStyle={styles.itemsGrid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          initialNumToRender={10}
          windowSize={5}
        />
      )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#9ca3af',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f9fafb',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
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
  filtersContainer: {
    paddingHorizontal: 16,
  },
  categoriesScroll: {
    maxHeight: 52,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  categoryTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  seasonsScroll: {
    maxHeight: 40,
    marginTop: 10,
  },
  seasonsContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  seasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#020617',
  },
  seasonChipActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#4f46e5' + '20',
  },
  seasonText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  seasonTextActive: {
    color: '#a5b4fc',
  },
  itemsContainer: {
    flex: 1,
    marginTop: 16,
  },
  itemsGrid: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  itemCard: {
    width: imageSize,
    marginHorizontal: 6, // kartlar arasında yatay boşluk
    backgroundColor: '#020617',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  itemImageWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#020617',
  },
  itemInfo: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemName: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '500',
  },
  itemTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffffff' + '30',
  },
  itemColorBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#020617' + 'aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  itemSeason: {
    color: '#a5b4fc',
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 12,
  },
  cabinetWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
  },
  openHint: {
    marginTop: 24,
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.8,
  },
});
