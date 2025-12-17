import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import axios from 'axios';
import { WeatherData, WardrobeItem } from '../../src/types';
import { supabase } from '../../src/lib/supabase';

const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;

export default function HomeScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { profile, user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [recentItems, setRecentItems] = useState<WardrobeItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([fetchWeather(), fetchRecentItems()]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const fetchWeather = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setWeatherLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=${language}`
      );

      const data = response.data;
      setWeather({
        temp: Math.round(data.main.temp),
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        city: data.name,
        isCold: data.main.temp < 15,
        isRainy: data.weather[0].main.toLowerCase().includes('rain'),
      });
    } catch (error) {
      console.error('Error fetching weather:', error);
    } finally {
      setWeatherLoading(false);
    }
  };

  const fetchRecentItems = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('wardrobe_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4);

      if (!error && data) {
        setRecentItems(data);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const getWeatherIcon = () => {
    if (!weather) return 'partly-sunny';
    const icon = weather.icon;
    if (icon.includes('01')) return 'sunny';
    if (icon.includes('02') || icon.includes('03')) return 'partly-sunny';
    if (icon.includes('04')) return 'cloudy';
    if (icon.includes('09') || icon.includes('10')) return 'rainy';
    if (icon.includes('11')) return 'thunderstorm';
    if (icon.includes('13')) return 'snow';
    return 'partly-sunny';
  };

  const getSuggestionText = () => {
    if (!weather) return '';
    if (weather.isRainy) {
      return language === 'en'
        ? 'Rainy day! Check your outerwear collection.'
        : 'Yağmurlu bir gün! Dış giyim koleksiyonuna bak.';
    }
    if (weather.isCold) {
      return language === 'en'
        ? 'Cold weather! Time for winter clothes.'
        : 'Soğuk hava! Kışlık kıyafetlerin zamanı.';
    }
    return language === 'en'
      ? 'Nice weather! Perfect for light outfits.'
      : 'Güzel hava! Hafif kıyafetler için mükemmel.';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 20 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {t.home.greeting}, {profile?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'}
          </Text>
          <Text style={styles.subGreeting}>
            {language === 'en' ? "Let's find your perfect look" : 'Mükemmel görünümünü bulalım'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color="#6366f1" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Credits Card */}
      <TouchableOpacity
        style={styles.creditsCard}
        onPress={() => router.push('/subscription')}
      >
        <View style={styles.creditsLeft}>
          <Ionicons name="sparkles" size={24} color="#fbbf24" />
          <View>
            <Text style={styles.creditsNumber}>{profile?.credits || 0}</Text>
            <Text style={styles.creditsLabel}>{t.home.creditsLeft}</Text>
          </View>
        </View>
        <View style={styles.upgradeButton}>
          <Text style={styles.upgradeText}>{t.home.upgrade}</Text>
          <Ionicons name="arrow-forward" size={16} color="#6366f1" />
        </View>
      </TouchableOpacity>

      {/* Weather Card */}
      <View style={styles.weatherCard}>
        <View style={styles.weatherHeader}>
          <Ionicons name="location" size={16} color="#6b7280" />
          <Text style={styles.weatherLocation}>
            {weather?.city || (language === 'en' ? 'Loading...' : 'Yükleniyor...')}
          </Text>
        </View>
        {weatherLoading ? (
          <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} />
        ) : weather ? (
          <>
            <View style={styles.weatherMain}>
              <Ionicons name={getWeatherIcon() as any} size={50} color="#fbbf24" />
              <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
            </View>
            <Text style={styles.weatherDesc}>{weather.description}</Text>
            <View style={styles.suggestionBox}>
              <Ionicons name="bulb" size={16} color="#6366f1" />
              <Text style={styles.suggestionText}>{getSuggestionText()}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.weatherError}>
            {language === 'en' ? 'Enable location for weather' : 'Hava durumu için konumu etkinleştir'}
          </Text>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#6366f1' }]}
          onPress={() => router.push('/try-on')}
        >
          <Ionicons name="sparkles" size={24} color="#fff" />
          <Text style={styles.actionText}>{t.home.tryOn}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#8b5cf6' }]}
          onPress={() => router.push('/(tabs)/wardrobe')}
        >
          <Ionicons name="shirt" size={24} color="#fff" />
          <Text style={styles.actionText}>{t.home.viewWardrobe}</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Items */}
      {recentItems.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {language === 'en' ? 'Recent Items' : 'Son Eklenenler'}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/wardrobe')}>
              <Text style={styles.seeAll}>
                {language === 'en' ? 'See All' : 'Tümünü Gör'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                onPress={() => router.push({ pathname: '/try-on', params: { itemId: item.id } })}
              >
                <Image
                  source={{ uri: item.image_base64 }}
                  style={styles.itemImage}
                />
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
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
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subGreeting: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366f1' + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fbbf24' + '40',
  },
  creditsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creditsNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  creditsLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6366f1' + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
  },
  weatherCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  weatherLocation: {
    color: '#6b7280',
    fontSize: 14,
  },
  weatherMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  weatherTemp: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  weatherDesc: {
    color: '#9ca3af',
    fontSize: 16,
    textTransform: 'capitalize',
    marginTop: 4,
  },
  weatherError: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: '#6366f1' + '10',
    padding: 12,
    borderRadius: 8,
  },
  suggestionText: {
    color: '#a5b4fc',
    fontSize: 13,
    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  seeAll: {
    color: '#6366f1',
    fontSize: 14,
  },
  itemCard: {
    marginRight: 12,
    width: 120,
  },
  itemImage: {
    width: 120,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
  },
  itemName: {
    color: '#fff',
    fontSize: 13,
    marginTop: 8,
  },
});
