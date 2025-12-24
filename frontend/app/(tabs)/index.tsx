import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Animated,
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
  const [statsNumber, setStatsNumber] = useState(150);
  const [statsMessageIndex, setStatsMessageIndex] = useState(0);
  const [subGreetingIndex, setSubGreetingIndex] = useState(0);
  
  // Animasyon değerleri
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim1 = useRef(new Animated.Value(0)).current;
  const sparkleAnim2 = useRef(new Animated.Value(0)).current;
  const sparkleAnim3 = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const tryOnButtonScale = useRef(new Animated.Value(1)).current;
  const tryOnColorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  // KOMBİN DENE butonu animasyonları
  useEffect(() => {
    // Pulse animasyonu
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(tryOnButtonScale, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(tryOnButtonScale, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );


    // Renk geçişi animasyonu
    const colorAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(tryOnColorAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: false,
        }),
        Animated.timing(tryOnColorAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: false,
        }),
      ])
    );

    pulseAnimation.start();
    colorAnimation.start();

    return () => {
      pulseAnimation.stop();
      colorAnimation.stop();
    };
  }, []);

  // Header animasyonları
  useEffect(() => {
    // Pulse animasyonu
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    // Sparkle animasyonları (farklı zamanlarda)
    const sparkleAnimation1 = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim1, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim1, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    const sparkleAnimation2 = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(sparkleAnim2, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim2, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    const sparkleAnimation3 = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(sparkleAnim3, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim3, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
    sparkleAnimation1.start();
    sparkleAnimation2.start();
    sparkleAnimation3.start();

    return () => {
      pulseAnimation.stop();
      sparkleAnimation1.stop();
      sparkleAnimation2.stop();
      sparkleAnimation3.stop();
    };
  }, []);

  // SubGreeting slide animasyonu
  useEffect(() => {
    const messages = t.home.subGreetingMessages || [];
    if (messages.length === 0) return;

    const changeMessage = () => {
      // Fade out ve slide up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Mesajı değiştir
        setSubGreetingIndex((prev) => (prev + 1) % messages.length);
        
        // Fade in ve slide down
        slideAnim.setValue(20);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    // İlk yüklemede 4 saniye sonra başlat, sonra her 4 saniyede bir tekrarla
    const timeout = setTimeout(() => {
      changeMessage();
    }, 4000);

    const interval = setInterval(changeMessage, 4000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [t.home.subGreetingMessages]);

  // Dinamik istatistik mesajlarını değiştir
  useEffect(() => {
    const updateStats = () => {
      // Rastgele sayı (50-800 arası, daha geniş aralık)
      const randomNumber = Math.floor(Math.random() * 750) + 50;
      setStatsNumber(randomNumber);
      
      // Rastgele mesaj seç
      const messages = t.home.statsMessages || [];
      if (messages.length > 0) {
        const randomIndex = Math.floor(Math.random() * messages.length);
        setStatsMessageIndex(randomIndex);
      }
    };

    // İlk yüklemede
    updateStats();

    // Her 3 dakikada bir değiştir
    const interval = setInterval(updateStats, 180000);

    return () => clearInterval(interval);
  }, [t.home.statsMessages]);

  const loadData = async () => {
    await Promise.all([fetchWeather(), fetchRecentItems()]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const fetchWeather = async (retryCount = 0) => {
    try {
      // Konum servislerinin açık olup olmadığını kontrol et
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        console.warn('Location services are disabled');
        setWeatherLoading(false);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted:', status);
        setWeatherLoading(false);
        return;
      }

      // Android için accuracy ve timeout belirt
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 15000, // 15 saniye timeout
        maximumAge: 60000, // 1 dakika cache
      });
      
      const { latitude, longitude } = location.coords;

      if (!OPENWEATHER_API_KEY) {
        console.error('OpenWeather API key not configured');
        setWeatherLoading(false);
        return;
      }

      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=${language}`,
        { timeout: 10000 }
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
    } catch (error: any) {
      console.error('Error fetching weather:', error);
      
      // Retry mekanizması - maksimum 2 deneme
      if (retryCount < 2 && (error.code === 'TIMEOUT' || error.message?.includes('timeout'))) {
        console.log(`Retrying weather fetch (attempt ${retryCount + 1})...`);
        setTimeout(() => {
          fetchWeather(retryCount + 1);
        }, 2000);
        return;
      }
      
      // Hata durumunda weather state'ini null yap
      setWeather(null);
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
    
    const temp = weather.temp;
    const icon = weather.icon;
    const isRainy = weather.isRainy;
    const isCold = weather.isCold;
    
    // Çok soğuk (0°C altı)
    if (temp < 0) {
      return language === 'en'
        ? 'Freezing cold! Layer up with warm coats and accessories.'
        : 'Dondurucu soğuk! Sıcak montlar ve aksesuarlarla katmanlayın.';
    }
    
    // Soğuk ve yağmurlu
    if (isCold && isRainy) {
      return language === 'en'
        ? 'Cold and rainy! Waterproof jacket and warm layers needed.'
        : 'Soğuk ve yağmurlu! Su geçirmez ceket ve sıcak katmanlar gerekli.';
    }
    
    // Sadece yağmurlu
    if (isRainy) {
      return language === 'en'
        ? 'Rainy day! Grab your waterproof outerwear and boots.'
        : 'Yağmurlu gün! Su geçirmez dış giyim ve botlarınızı alın.';
    }
    
    // Soğuk ama kuru (0-10°C)
    if (isCold && temp >= 0 && temp < 10) {
      return language === 'en'
        ? 'Chilly weather! Perfect for cozy sweaters and jackets.'
        : 'Serin hava! Rahat kazaklar ve ceketler için mükemmel.';
    }
    
    // Hafif soğuk (10-15°C)
    if (temp >= 10 && temp < 15) {
      return language === 'en'
        ? 'Cool breeze! Light layers and long sleeves work best.'
        : 'Serin esinti! Hafif katmanlar ve uzun kollu kıyafetler ideal.';
    }
    
    // Ilık (15-20°C)
    if (temp >= 15 && temp < 20) {
      return language === 'en'
        ? 'Mild weather! Perfect for light jackets or cardigans.'
        : 'Ilık hava! Hafif ceketler veya hırkalar için mükemmel.';
    }
    
    // Sıcak (20-25°C)
    if (temp >= 20 && temp < 25) {
      return language === 'en'
        ? 'Pleasant temperature! Light fabrics and breathable outfits.'
        : 'Rahat sıcaklık! Hafif kumaşlar ve nefes alabilir kıyafetler.';
    }
    
    // Çok sıcak (25-30°C)
    if (temp >= 25 && temp < 30) {
      return language === 'en'
        ? 'Warm day! Go for light colors and airy fabrics.'
        : 'Sıcak gün! Açık renkler ve hafif kumaşlar tercih edin.';
    }
    
    // Aşırı sıcak (30°C üstü)
    if (temp >= 30) {
      return language === 'en'
        ? 'Hot weather! Light, loose-fitting clothes are essential.'
        : 'Sıcak hava! Hafif, bol kıyafetler şart.';
    }
    
    // İkon bazlı öneriler
    if (icon.includes('01')) { // Açık güneşli
      return language === 'en'
        ? 'Sunny day! Bright colors and sunglasses complete the look.'
        : 'Güneşli gün! Açık renkler ve güneş gözlüğü görünümü tamamlar.';
    }
    
    if (icon.includes('02') || icon.includes('03')) { // Parçalı bulutlu
      return language === 'en'
        ? 'Partly cloudy! Versatile layers work great today.'
        : 'Parçalı bulutlu! Çok amaçlı katmanlar bugün harika.';
    }
    
    if (icon.includes('04')) { // Bulutlu
      return language === 'en'
        ? 'Cloudy skies! Neutral tones create a sophisticated look.'
        : 'Bulutlu gökyüzü! Nötr tonlar şık bir görünüm yaratır.';
    }
    
    if (icon.includes('11')) { // Fırtına
      return language === 'en'
        ? 'Stormy weather! Stay indoors or wear protective layers.'
        : 'Fırtınalı hava! İçeride kalın veya koruyucu katmanlar giyin.';
    }
    
    if (icon.includes('13')) { // Kar
      return language === 'en'
        ? 'Snowy day! Warm boots and insulated outerwear are must-haves.'
        : 'Karlı gün! Sıcak botlar ve yalıtımlı dış giyim şart.';
    }
    
    if (icon.includes('50')) { // Sis
      return language === 'en'
        ? 'Foggy morning! Layered outfits provide comfort and style.'
        : 'Sisli sabah! Katmanlı kıyafetler konfor ve stil sağlar.';
    }
    
    // Varsayılan
    return language === 'en'
      ? 'Nice weather! Perfect for experimenting with your style.'
      : 'Güzel hava! Stilinizi denemek için mükemmel.';
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
        <Animated.View 
          style={[
            styles.greetingCard,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={styles.greetingContent}>
            <View style={styles.greetingTextContainer}>
              <View style={styles.greetingRow}>
                <Text style={styles.greeting}>
                  {t.home.greeting}
                </Text>
                <View style={styles.sparkleContainer}>
                  <Animated.View
                    style={[
                      styles.sparkle,
                      {
                        opacity: sparkleAnim1,
                        transform: [
                          {
                            scale: sparkleAnim1.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="sparkles" size={16} color="#fbbf24" />
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.sparkle,
                      styles.sparkle2,
                      {
                        opacity: sparkleAnim2,
                        transform: [
                          {
                            scale: sparkleAnim2.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="star" size={14} color="#10b981" />
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.sparkle,
                      styles.sparkle3,
                      {
                        opacity: sparkleAnim3,
                        transform: [
                          {
                            scale: sparkleAnim3.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="sparkles" size={12} color="#8b5cf6" />
                  </Animated.View>
                </View>
              </View>
              <Text style={styles.greetingName}>
                {profile?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'}
              </Text>
              <View style={styles.subGreetingContainer}>
                <Animated.Text
                  style={[
                    styles.subGreeting,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }],
                    },
                  ]}
                >
                  {t.home.subGreetingMessages?.[subGreetingIndex] || 
                   (language === 'en' ? "Let's find your perfect look" : 'Mükemmel görünümünü bulalım')}
                </Animated.Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.avatarButton}
            >
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={24} color="#6366f1" />
                </View>
              )}
            </TouchableOpacity>
          </View>
          {/* Kredi Hatırlatma - küçük pill, avatar altı */}
          {typeof profile?.credits === 'number' && (
            <TouchableOpacity
              style={styles.creditInline}
              onPress={() => router.push('/subscription')}
              activeOpacity={0.9}
            >
              <Ionicons name="flash" size={14} color="#fbbf24" />
              <Text style={styles.creditInlineText}>
                {profile.credits}
              </Text>
              <Text style={styles.creditInlineLabel}>
                {language === 'en' ? 'left' : 'kredi'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statsContent}>
          <Ionicons name="trending-up" size={20} color="#10b981" />
          <Text style={styles.statsText}>
            <Text style={styles.statsNumber}>{statsNumber}</Text>{' '}
            {t.home.statsMessages?.[statsMessageIndex] || t.home.statsMessages?.[0] || ''}
          </Text>
        </View>
      </View>

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
        <Animated.View
          style={[
            styles.tryOnButtonWrapper,
            {
              transform: [{ scale: tryOnButtonScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: tryOnColorAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ['#6366f1', '#8b5cf6', '#ec4899'],
                }) as any,
              },
            ]}
            onPress={() => router.push('/try-on')}
            activeOpacity={0.9}
          >
            <Ionicons name="sparkles" size={24} color="#fff" />
            <Text style={styles.actionText}>{t.home.tryOn}</Text>
          </TouchableOpacity>
        </Animated.View>
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
                  source={{ uri: item.thumbnail_url || item.image_url }}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greetingCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#6366f1' + '30',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  greetingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '600',
    color: '#9ca3af',
    marginRight: 8,
  },
  greetingName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 4,
    textShadowColor: '#8b5cf6',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subGreetingContainer: {
    height: 20,
    marginTop: 2,
    overflow: 'hidden',
  },
  subGreeting: {
    fontSize: 13,
    color: '#6b7280',
  },
  sparkleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    height: 20,
    width: 50,
  },
  sparkle: {
    position: 'absolute',
    left: 0,
  },
  sparkle2: {
    left: 12,
  },
  sparkle3: {
    left: 24,
  },
  avatarButton: {
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1' + '30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  statsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statsText: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
  },
  statsNumber: {
    fontWeight: 'bold',
    color: '#10b981',
    fontSize: 15,
  },
  creditInline: {
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#fbbf24' + '30',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creditInlineText: {
    color: '#fbbf24',
    fontWeight: '700',
    fontSize: 14,
  },
  creditInlineLabel: {
    color: '#9ca3af',
    fontSize: 12,
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
  tryOnButtonWrapper: {
    flex: 1,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
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
