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
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../src/contexts/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// Model images
const modelImages = [
  {
    id: 'erkek',
    source: require('../../assets/images/erkek.png'),
    name: 'Erkek',
  },
  {
    id: 'kadin',
    source: require('../../assets/images/kadin.png'),
    name: 'Kadın',
  },
];

// Clothing items mapping based on selected model
const getClothingItems = (modelId: string | null) => {
  if (modelId === 'erkek') {
    return [
      {
        id: 'tshirte',
        source: require('../../assets/images/tshirte.jpg'),
        name: 'T-Shirt',
      },
      {
        id: 'takime',
        source: require('../../assets/images/takime.jpg'),
        name: 'Takım',
      },
    ];
  } else if (modelId === 'kadin') {
    return [
      {
        id: 'siyah',
        source: require('../../assets/images/siyah.png'),
        name: 'Siyah',
      },
      {
        id: 'kirmizi',
        source: require('../../assets/images/kirmizi.png'),
        name: 'Kırmızı',
      },
    ];
  }
  return [];
};

// Try-on results mapping (model + clothing combination)
const getTryOnResult = (modelId: string | null, clothingId: string | null) => {
  if (modelId === 'erkek' && clothingId === 'tshirte') {
    return require('../../assets/images/tsirt.png');
  }
  if (modelId === 'erkek' && clothingId === 'takime') {
    return require('../../assets/images/takim.png');
  }
  if (modelId === 'kadin' && clothingId === 'kirmizi') {
    return require('../../assets/images/kirmizik.png');
  }
  if (modelId === 'kadin' && clothingId === 'siyah') {
    return require('../../assets/images/siyahk.png');
  }
  return null;
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedClothing, setSelectedClothing] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  
  // Animation values
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(-20)).current;
  const modelAnimations = useRef(
    modelImages.map(() => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;
  const modelItemScales = useRef(
    modelImages.map(() => new Animated.Value(1))
  ).current;
  const clothingAnimations = useRef<Record<string, { scale: Animated.Value; opacity: Animated.Value }>>({}).current;
  const clothingItemScales = useRef<Record<string, Animated.Value>>({}).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0.8)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Animate title on mount
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Animate model items on mount
  React.useEffect(() => {
    if (currentIndex === 0) {
      modelAnimations.forEach((anim, index) => {
        Animated.parallel([
          Animated.spring(anim.scale, {
            toValue: 1,
            delay: index * 150,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue: 1,
            delay: index * 150,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [currentIndex]);

  // Animate clothing items when model is selected
  React.useEffect(() => {
    if (currentIndex === 1 && selectedModel) {
      const clothingItems = getClothingItems(selectedModel);
      clothingItems.forEach((item, index) => {
        if (!clothingAnimations[item.id]) {
          clothingAnimations[item.id] = {
            scale: new Animated.Value(0),
            opacity: new Animated.Value(0),
          };
        }
        if (!clothingItemScales[item.id]) {
          clothingItemScales[item.id] = new Animated.Value(1);
        }
        Animated.parallel([
          Animated.spring(clothingAnimations[item.id].scale, {
            toValue: 1,
            delay: index * 150,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(clothingAnimations[item.id].opacity, {
            toValue: 1,
            delay: index * 150,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [currentIndex, selectedModel]);

  // Animate result image
  React.useEffect(() => {
    if (currentIndex === 2 && selectedModel && selectedClothing) {
      Animated.parallel([
        Animated.timing(resultOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(resultScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      resultOpacity.setValue(0);
      resultScale.setValue(0.8);
    }
  }, [currentIndex, selectedModel, selectedClothing]);

  const handleNext = async () => {
    if (currentIndex === 0 && !selectedModel) {
      // First page - must select a model
      return;
    }
    if (currentIndex === 1 && !selectedClothing) {
      // Second page - must select clothing
      return;
    }
    if (currentIndex < 2) {
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

  const checkmarkScaleModel = useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    if (selectedModel && currentIndex === 0) {
      Animated.spring(checkmarkScaleModel, {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }).start();
    } else {
      checkmarkScaleModel.setValue(0);
    }
  }, [selectedModel, currentIndex]);

  const renderModelSelection = () => {

    return (
      <View style={styles.modelSelectionContainer}>
        <Animated.View
          style={[
            styles.modelHeaderContainer,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          <Text style={styles.mainTitle}>{t.onboarding.slide1Title}</Text>
          <Text style={styles.subTitle}>{t.onboarding.slide1Desc}</Text>
        </Animated.View>

        <View style={styles.modelGridContainer}>
          {modelImages.map((model, index) => {
            const anim = modelAnimations[index];
            const isSelected = selectedModel === model.id;
            const itemScale = modelItemScales[index];

            return (
              <Animated.View
                key={model.id}
                style={{
                  transform: [
                    { scale: Animated.multiply(anim.scale, itemScale) },
                  ],
                  opacity: anim.opacity,
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.modelGridItem,
                    isSelected && styles.gridItemSelected,
                  ]}
                  onPress={() => {
                    Animated.sequence([
                      Animated.spring(itemScale, {
                        toValue: 0.95,
                        useNativeDriver: true,
                      }),
                      Animated.spring(itemScale, {
                        toValue: 1,
                        useNativeDriver: true,
                      }),
                    ]).start();
                    setSelectedModel(model.id);
                    setSelectedClothing(null);
                  }}
                  activeOpacity={0.9}
                >
                  <Image source={model.source} style={styles.gridImage} />
                  {isSelected && (
                    <Animated.View
                      style={[
                        styles.checkmarkContainer,
                        {
                          transform: [{ scale: checkmarkScaleModel }],
                        },
                      ]}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={28}
                        color="#22c55e"
                      />
                    </Animated.View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </View>
    );
  };

  const checkmarkScaleClothing = useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    if (selectedClothing && currentIndex === 1) {
      Animated.spring(checkmarkScaleClothing, {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }).start();
    } else {
      checkmarkScaleClothing.setValue(0);
    }
  }, [selectedClothing, currentIndex]);

  const renderClothingSelection = () => {
    const clothingItems = getClothingItems(selectedModel);

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
          }}
        >
          <Text style={styles.mainTitle}>{t.onboarding.slide2Title}</Text>
          <Text style={styles.subTitle}>{t.onboarding.slide2Desc}</Text>
        </Animated.View>

        <View style={styles.modelGridContainer}>
          {clothingItems.map((item, index) => {
            const anim =
              clothingAnimations[item.id] ||
              ({ scale: new Animated.Value(1), opacity: new Animated.Value(1) } as {
                scale: Animated.Value;
                opacity: Animated.Value;
              });
            const isSelected = selectedClothing === item.id;
            const itemScale = clothingItemScales[item.id] || new Animated.Value(1);

            return (
              <Animated.View
                key={item.id}
                style={{
                  transform: [
                    { scale: Animated.multiply(anim.scale, itemScale) },
                  ],
                  opacity: anim.opacity,
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.modelGridItem,
                    isSelected && styles.gridItemSelected,
                  ]}
                  onPress={() => {
                    Animated.sequence([
                      Animated.spring(itemScale, {
                        toValue: 0.95,
                        useNativeDriver: true,
                      }),
                      Animated.spring(itemScale, {
                        toValue: 1,
                        useNativeDriver: true,
                      }),
                    ]).start();
                    setSelectedClothing(item.id);
                  }}
                  activeOpacity={0.9}
                >
                  <Image source={item.source} style={styles.gridImage} />
                  {isSelected && (
                    <Animated.View
                      style={[
                        styles.checkmarkContainer,
                        {
                          transform: [{ scale: checkmarkScaleClothing }],
                        },
                      ]}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={28}
                        color="#22c55e"
                      />
                    </Animated.View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderTryOnResult = () => {
    const resultSource = getTryOnResult(selectedModel, selectedClothing);

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
          }}
        >
          <Text style={styles.mainTitle}>{t.onboarding.slide3Title}</Text>
          <Text style={styles.subTitle}>{t.onboarding.slide3Subtitle}</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.resultImageContainer,
            {
              opacity: resultOpacity,
              transform: [{ scale: resultScale }],
            },
          ]}
        >
          {resultSource && (
            <Image source={resultSource} style={styles.resultImage} />
          )}
        </Animated.View>
      </ScrollView>
    );
  };

  const renderSlide = ({ item, index }: { item: { id: string }; index: number }) => (
    <View style={[styles.slide, { width }]}>
      {index === 0 && renderModelSelection()}
      {index === 1 && renderClothingSelection()}
      {index === 2 && renderTryOnResult()}
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

  const getButtonText = () => {
    if (currentIndex === 0) return t.onboarding.next;
    if (currentIndex === 1) return t.onboarding.tryOn;
    return t.onboarding.getStarted;
  };

  const slides = [{ id: '1' }, { id: '2' }, { id: '3' }];

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
        {currentIndex < 2 && (
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipText}>{t.onboarding.skip}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
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
      <Animated.View
        style={{
          transform: [{ scale: buttonScale }],
        }}
      >
        <TouchableOpacity
          style={[
            styles.button,
            ((currentIndex === 0 && !selectedModel) ||
              (currentIndex === 1 && !selectedClothing)) &&
              styles.buttonDisabled,
          ]}
          onPress={() => {
            Animated.sequence([
              Animated.spring(buttonScale, {
                toValue: 0.95,
                useNativeDriver: true,
              }),
              Animated.spring(buttonScale, {
                toValue: 1,
                useNativeDriver: true,
              }),
            ]).start();
            handleNext();
          }}
          activeOpacity={0.8}
          disabled={
            (currentIndex === 0 && !selectedModel) ||
            (currentIndex === 1 && !selectedClothing)
          }
        >
          <Text style={styles.buttonText}>{getButtonText()}</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={{ height: insets.bottom + 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    backgroundColor: '#f3f4f6',
  },
  langText: {
    color: '#1f2937',
    fontWeight: '600',
    fontSize: 14,
  },
  skipText: {
    color: '#6B46C1',
    fontSize: 16,
    fontWeight: '500',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    alignItems: 'center',
  },
  modelSelectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modelHeaderContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subTitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  modelGridContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: 12,
    paddingHorizontal: 15,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  modelGridItem: {
    width: (width - 60) / 2,
    aspectRatio: 2 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  gridItem: {
    width: (width - 48) / 2 - 8,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridItemSelected: {
    borderColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  resultImageContainer: {
    width: width - 40,
    aspectRatio: 2 / 3,
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 20,
    backgroundColor: '#f9fafb',
    shadowColor: '#6B46C1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  resultImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B46C1',
    marginHorizontal: 4,
  },
  button: {
    backgroundColor: '#6B46C1',
    marginHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6B46C1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
