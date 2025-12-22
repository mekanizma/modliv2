import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../src/contexts/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface SlideData {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: 'slide1Title' | 'slide2Title' | 'slide3Title';
  descKey: 'slide1Desc' | 'slide2Desc' | 'slide3Desc';
  taglineKey: 'slide1Tagline' | 'slide2Tagline' | 'slide3Tagline';
  color: string;
}

const slides: SlideData[] = [
  {
    id: '1',
    icon: 'shirt-outline',
    titleKey: 'slide1Title',
    descKey: 'slide1Desc',
    taglineKey: 'slide1Tagline',
    color: '#6366f1',
  },
  {
    id: '2',
    icon: 'sparkles-outline',
    titleKey: 'slide2Title',
    descKey: 'slide2Desc',
    taglineKey: 'slide2Tagline',
    color: '#a855f7',
  },
  {
    id: '3',
    icon: 'cloudy-night-outline',
    titleKey: 'slide3Title',
    descKey: 'slide3Desc',
    taglineKey: 'slide3Tagline',
    color: '#22c55e',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      await completeOnboarding();
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    router.replace('/(auth)');
  };

  const renderSlide = ({ item }: { item: SlideData; index: number }) => (
    <View style={[styles.slide, { width }]}>
      <View style={styles.card}>
        <View
          style={[
            styles.imageContainer,
            {
              borderColor: item.color,
              shadowColor: item.color,
            },
          ]}
        >
          {item.id === '1' ? (
            <Image
              source={{
                uri: 'https://liftapp.ai/_next/static/media/whyLift.395ef2d8.webp',
              }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : item.id === '2' ? (
            <Image
              source={{
                uri: 'https://liftapp.ai/_next/static/media/whyLift.4634b40b.webp',
              }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : item.id === '3' ? (
            <Image
              source={require('../../assets/onboarding-wardrobe.png')}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imageOverlay}>
              <Ionicons name={item.icon} size={96} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.tagline}>{t.onboarding[item.taglineKey]}</Text>
          <Text style={styles.title}>{t.onboarding[item.titleKey]}</Text>
          <Text style={styles.description}>{t.onboarding[item.descKey]}</Text>
        </View>
      </View>
    </View>
  );

  const renderDot = (index: number) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const dotWidth = scrollX.interpolate({
      inputRange,
      outputRange: [8, 24, 8],
      extrapolate: 'clamp',
    });
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.3, 1, 0.3],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        key={index}
        style={[styles.dot, { width: dotWidth, opacity }]}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Language Toggle */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.langButton}
          onPress={() => setLanguage(language === 'en' ? 'tr' : 'en')}
        >
          <Text style={styles.langText}>{language === 'en' ? 'TR' : 'EN'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>{t.onboarding.skip}</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        keyExtractor={(item) => item.id}
      />

      {/* Pagination */}
      <View style={styles.pagination}>
        {slides.map((_, index) => renderDot(index))}
      </View>

      {/* Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleNext}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>
          {currentIndex === slides.length - 1
            ? t.onboarding.getStarted
            : t.onboarding.next}
        </Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>

      <View style={{ height: insets.bottom + 20 }} />
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
    paddingVertical: 10,
  },
  langButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  langText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  skipText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '500',
  },
  welcome: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginVertical: 20,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'left',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'left',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 30,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
    marginHorizontal: 4,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 12,
  },
  imageContainer: {
    width: '92%',
    alignSelf: 'center',
    aspectRatio: 3 / 4,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOverlay: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    width: '100%',
    alignItems: 'flex-start',
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a5b4fc',
    marginBottom: 8,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
