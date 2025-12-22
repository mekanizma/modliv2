import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Pressable, Text, FlatList, Image } from 'react-native';
import Svg, { Rect, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolate,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import { useLanguage } from '../contexts/LanguageContext';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedText = Animated.createAnimatedComponent(Text);

const { width, height } = Dimensions.get('window');
// Tam ekran için ekran boyutlarını kullan
const CABINET_WIDTH = width;
const CABINET_HEIGHT = height;

interface WardrobeCabinetProps {
  onOpen: () => void;
  isOpen: boolean;
  clothes: Array<{ id: string; thumbnail_url?: string; image_url: string }>;
}

export const WardrobeCabinet: React.FC<WardrobeCabinetProps> = ({ onOpen, isOpen, clothes }) => {
  const { t } = useLanguage();
  const open = useSharedValue(0);
  const light = useSharedValue(0);
  const idleAnimation = useSharedValue(0);
  const titleAnimation = useSharedValue(0);
  const subtitleAnimation = useSharedValue(0);
  const sound = useRef<Audio.Sound | null>(null);

  // Idle animasyonu (nefes alma efekti)
  useEffect(() => {
    if (!isOpen) {
      idleAnimation.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000 }),
          withTiming(0, { duration: 2000 })
        ),
        -1,
        false
      );

      // Başlık animasyonları - fade in + slide down
      titleAnimation.value = withDelay(200, withTiming(1, { duration: 800 }));
      subtitleAnimation.value = withDelay(600, withTiming(1, { duration: 800 }));
    } else {
      idleAnimation.value = 0;
      titleAnimation.value = 0;
      subtitleAnimation.value = 0;
    }
  }, [isOpen]);

  // Ses efekti (opsiyonel - dosya yoksa sessiz çalışır)
  useEffect(() => {
    // Ses dosyası varsa yükle
    // Dosya yolu: frontend/assets/sounds/wardrobe-open.mp3
    Audio.Sound.createAsync(require('../../assets/sounds/wardrobe-open.mp3'))
      .then(({ sound: s }) => (sound.current = s))
      .catch(() => {
        // Ses dosyası yoksa sessiz devam et
        console.log('Ses dosyası bulunamadı, sessiz devam ediliyor');
      });
  }, []);

  // Kapı açılma animasyonu
  const openWardrobe = async () => {
    if (isOpen) return;
    
    open.value = withTiming(1, { duration: 800 });
    light.value = withDelay(300, withTiming(1, { duration: 500 }));
    
    // Ses efekti çal
    try {
      await sound.current?.replayAsync();
    } catch {
      // Ses dosyası yoksa sessiz devam et
    }
    
    // Animasyon tamamlandıktan sonra callback çağır
    setTimeout(() => {
      runOnJS(onOpen)();
    }, 800);
  };

  // Kapak animasyonları - SVG için animatedProps kullanılmalı
  const leftDoorProps = useAnimatedProps(() => {
    'worklet';
    const rotateY = -90 * open.value;
    return {
      transform: [
        { translateX: 97 },
        { perspective: 1000 },
        { rotateY: `${rotateY}deg` },
        { translateX: -97 },
      ],
    };
  });

  const rightDoorProps = useAnimatedProps(() => {
    'worklet';
    const rotateY = 90 * open.value;
    return {
      transform: [
        { translateX: -97 },
        { perspective: 1000 },
        { rotateY: `${rotateY}deg` },
        { translateX: 97 },
      ],
    };
  });

  // Başlık animasyonları
  const titleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(titleAnimation.value, [0, 1], [0, 1], Extrapolate.CLAMP);
    const translateY = interpolate(titleAnimation.value, [0, 1], [-20, 0], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const subtitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(subtitleAnimation.value, [0, 1], [0, 1], Extrapolate.CLAMP);
    const translateY = interpolate(subtitleAnimation.value, [0, 1], [20, 0], Extrapolate.CLAMP);
    const scale = interpolate(subtitleAnimation.value, [0, 1], [0.9, 1], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // Işık efekti
  const lightStyle = useAnimatedStyle(() => ({
    opacity: light.value,
  }));

  // Idle animasyon (nefes alma)
  const idleStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      idleAnimation.value,
      [0, 1],
      [1, 1.02],
      Extrapolate.CLAMP
    );
    return {
      transform: [{ scale }],
    };
  });

  // Blur efekti - açılırken azalır
  const blurIntensity = interpolate(open.value, [0, 0.5, 1], [40, 20, 0]);

  return (
    <View style={styles.container}>
      <Pressable onPress={openWardrobe} disabled={isOpen}>
        <Animated.View style={[styles.cabinetContainer, idleStyle]}>
          {/* Blur efekti */}
          <BlurView
            intensity={blurIntensity}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />

          {/* Işık efekti */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
              },
              lightStyle,
            ]}
          />

          {/* SVG Dolap - Tam Ekran */}
          <AnimatedSvg
            width={CABINET_WIDTH}
            height={CABINET_HEIGHT}
            viewBox="0 0 320 440"
            style={styles.svgContainer}
            preserveAspectRatio="xMidYMid meet"
          >
            <Defs>
              {/* İç glow */}
              <LinearGradient id="innerGlow" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#6C72FF" stopOpacity="0.12" />
                <Stop offset="100%" stopColor="#6C72FF" stopOpacity="0" />
              </LinearGradient>

              {/* Neon divider */}
              <LinearGradient id="neonDivider" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#9FA4FF" />
                <Stop offset="50%" stopColor="#6C72FF" />
                <Stop offset="100%" stopColor="#9FA4FF" />
              </LinearGradient>

              {/* Sol kapak */}
              <LinearGradient id="doorLeft" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor="#1B2148" />
                <Stop offset="100%" stopColor="#0E1330" />
              </LinearGradient>

              {/* Sağ kapak */}
              <LinearGradient id="doorRight" x1="1" y1="0" x2="0" y2="0">
                <Stop offset="0%" stopColor="#1B2148" />
                <Stop offset="100%" stopColor="#0E1330" />
              </LinearGradient>
            </Defs>

            {/* Gövde */}
            <Rect
              x="20"
              y="20"
              width="280"
              height="400"
              rx="24"
              fill="#0B0F1A"
              stroke="#3B3FFF"
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />

            {/* İç panel */}
            <Rect
              x="36"
              y="36"
              width="248"
              height="368"
              rx="20"
              fill="#11162A"
            />

            {/* İç glow */}
            <AnimatedInnerLight light={light} />

            {/* 🟣 NEON KAPAK AYRIM ÇİZGİSİ */}
            <Rect
              x="158"
              y="44"
              width="4"
              height="352"
              rx="2"
              fill="url(#neonDivider)"
            />

            {/* SOL KAPAK */}
            <AnimatedG
              id="leftDoor"
              animatedProps={leftDoorProps}
            >
              <Rect
                x="36"
                y="36"
                width="122"
                height="368"
                rx="20"
                fill="#151B36"
              />
              <Rect
                x="36"
                y="36"
                width="122"
                height="368"
                rx="20"
                fill="url(#doorLeft)"
              />
              <Circle cx="150" cy="220" r="4" fill="#7B80FF" />
            </AnimatedG>

            {/* SAĞ KAPAK */}
            <AnimatedG
              id="rightDoor"
              animatedProps={rightDoorProps}
            >
              <Rect
                x="162"
                y="36"
                width="122"
                height="368"
                rx="20"
                fill="#151B36"
              />
              <Rect
                x="162"
                y="36"
                width="122"
                height="368"
                rx="20"
                fill="url(#doorRight)"
              />
              <Circle cx="170" cy="220" r="4" fill="#7B80FF" />
            </AnimatedG>
          </AnimatedSvg>

          {/* Üst başlık - SANAL GARDROP */}
          {!isOpen && (
            <Animated.Text style={[styles.titleText, titleStyle]}>
              {t.wardrobe.virtualWardrobe}
            </Animated.Text>
          )}

          {/* Alt başlık - KAPAĞI AÇ */}
          {!isOpen && (
            <Animated.Text style={[styles.subtitleText, subtitleStyle]}>
              {t.wardrobe.openCabinet}
            </Animated.Text>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  cabinetContainer: {
    width: CABINET_WIDTH,
    height: CABINET_HEIGHT,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  titleText: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    color: '#9FA4FF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    textShadowColor: '#6C72FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subtitleText: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    color: '#6C72FF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1.5,
    textShadowColor: '#9FA4FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  clothesContainer: {
    paddingTop: 20,
    paddingHorizontal: 12,
  },
});

// İç ışık animasyonu
function AnimatedInnerLight({ light }: { light: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    return {
      opacity: light.value,
    };
  });

  return (
    <AnimatedRect
      x="36"
      y="36"
      width="248"
      height="368"
      rx="20"
      fill="url(#innerGlow)"
      animatedProps={animatedProps}
    />
  );
}

// SVG içinde kıyafet gösterimi için placeholder
function AnimatedClothSVG({
  item,
  index,
  open,
  x,
  y,
}: {
  item: { id: string; thumbnail_url?: string; image_url: string };
  index: number;
  open: SharedValue<number>;
  x: number;
  y: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    const delay = index * 80;
    opacity.value = withDelay(delay, withTiming(open.value));
    translateY.value = withDelay(delay, withTiming((1 - open.value) * 20));
  }, [open.value, index]);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    return {
      opacity: opacity.value,
      transform: `translate(0, ${translateY.value})`,
    };
  });

  // SVG içinde Image kullanılamaz, bu yüzden placeholder renk kullanıyoruz
  const colors = ['#8EC5FC', '#E0C3FC', '#FBC2EB'];
  const heights = [90, 110, 95];

  return (
    <AnimatedRect
      x={x}
      y={y}
      width={40}
      height={heights[index % heights.length]}
      rx={6}
      fill={colors[index % colors.length]}
      animatedProps={animatedProps}
    />
  );
}
