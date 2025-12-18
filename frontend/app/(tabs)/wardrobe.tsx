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
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { WardrobeItem, ClothingCategory, Season } from '../../src/types';

const categories: { key: ClothingCategory | 'all'; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', icon: 'grid-outline' },
  { key: 'tops', icon: 'shirt-outline' },
  { key: 'bottoms', icon: 'airplane-outline' },
  { key: 'dresses', icon: 'body-outline' },
  { key: 'outerwear', icon: 'cloudy-outline' },
  { key: 'shoes', icon: 'footsteps-outline' },
  { key: 'accessories', icon: 'watch-outline' },
];

const seasons: { key: Season | 'all'; label: string }[] = [
  { key: 'all', label: 'allSeasons' },
  { key: 'summer', label: 'summer' },
  { key: 'winter', label: 'winter' },
  { key: 'spring', label: 'spring' },
  { key: 'autumn', label: 'autumn' },
];

const { width } = Dimensions.get('window');
const imageSize = (width - 48) / 2;
const ITEMS_PER_PAGE = 20;

export default function WardrobeScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WardrobeItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | 'all'>('all');
  const [selectedSeason, setSelectedSeason] = useState<Season | 'all'>('all');
  const [loading, setLoading] = useState(false); // Changed to false for instant display
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setPage(0);
      setHasMore(true);
      fetchItems(0, true);
    }, [])
  );

  useEffect(() => {
    filterItems();
  }, [items, selectedCategory, selectedSeason]);

  const fetchItems = async (pageNum: number = 0, reset: boolean = false) => {
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
        const newItems = reset ? data : [...items, ...data];
        setItems(newItems);
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
  };

  const filterItems = () => {
    let filtered = [...items];
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
              setItems(items.filter((i) => i.id !== item.id));
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: WardrobeItem }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => router.push({ pathname: '/try-on', params: { itemId: item.id } })}
      onLongPress={() => handleDeleteItem(item)}
    >
      <Image 
        source={{ uri: item.thumbnail_url || item.image_base64 }} 
        style={styles.itemImage}
        defaultSource={require('../../assets/images/icon.png')}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.itemTags}>
          {item.color && <View style={[styles.colorDot, { backgroundColor: item.color }]} />}
          {item.season && (
            <Text style={styles.itemSeason}>
              {t.wardrobe[item.season as keyof typeof t.wardrobe]}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t.wardrobe.title}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/add-item')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

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
          >
            <Ionicons
              name={cat.icon}
              size={20}
              color={selectedCategory === cat.key ? '#fff' : '#6b7280'}
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

      {/* Items Grid */}
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesScroll: {
    maxHeight: 50,
  },
  categoriesContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
  },
  categoryButtonActive: {
    backgroundColor: '#6366f1',
  },
  categoryText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  seasonsScroll: {
    maxHeight: 40,
    marginTop: 12,
  },
  seasonsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  seasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  seasonChipActive: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f1' + '20',
  },
  seasonText: {
    color: '#6b7280',
    fontSize: 12,
  },
  seasonTextActive: {
    color: '#6366f1',
  },
  itemsContainer: {
    flex: 1,
    marginTop: 16,
  },
  itemsGrid: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  itemCard: {
    width: imageSize,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  itemImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#2d2d44',
  },
  itemInfo: {
    padding: 10,
  },
  itemName: {
    color: '#fff',
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
    borderColor: '#fff' + '30',
  },
  itemSeason: {
    color: '#6b7280',
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
});
