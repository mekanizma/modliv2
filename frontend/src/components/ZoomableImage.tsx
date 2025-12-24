import React, { useCallback } from 'react';
import { Dimensions, Platform, StyleProp, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import {
  Gesture,
  GestureDetector,
  GestureType,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export type ZoomableImageProps = {
  uri: string;
  /**
   * Minimum zoom level.
   * Varsayılan: 1
   */
  minScale?: number;
  /**
   * Maximum zoom level.
   * Varsayılan: 5
   */
  maxScale?: number;
  /**
   * Double-tap sonrası hedef zoom seviyesi.
   * Varsayılan: 2.5
   */
  doubleTapScale?: number;
  /**
   * Zoom durumu (scale < threshold ise false, aksi halde true)
   * parent gesture'ların enable/disable kontrolü için kullanılır.
   */
  onZoomActiveChange?: (isZoomed: boolean) => void;
  /**
   * ScrollView / FlatList gibi parent gesture’lar ile simultane çalışması için.
   * react-native-gesture-handler'ın simultaneousHandlers tipi geniş tutuldu.
   */
  simultaneousHandlers?: GestureType | GestureType[] | null | undefined;
  /**
   * Dış sarmalayıcı için stil.
   */
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * İç image wrapper'ı için stil (örn. width/height).
   */
  imageWrapperStyle?: StyleProp<ViewStyle>;
};

const AnimatedView = Animated.createAnimatedComponent(View);

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

export const ZoomableImage: React.FC<ZoomableImageProps> = ({
  uri,
  minScale = 1,
  maxScale = 5,
  doubleTapScale = 2.5,
  onZoomActiveChange,
  simultaneousHandlers,
  containerStyle,
  imageWrapperStyle,
}) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const isZoomed = useSharedValue(false);
  const ZOOM_THRESHOLD = 1.1;

  // Container ve görsel boyutları için shared values
  const containerWidth = useSharedValue(screenWidth);
  const containerHeight = useSharedValue(screenHeight);
  const imageWidth = useSharedValue(screenWidth);
  const imageHeight = useSharedValue(screenHeight);
  const imageNaturalWidth = useSharedValue(0);
  const imageNaturalHeight = useSharedValue(0);

  // Boundary check için helper function - görselin gerçek boyutlarını kullanır
  const clampTranslate = (currentScale: number, currentTranslateX: number, currentTranslateY: number) => {
    'worklet';
    const cw = containerWidth.value;
    const ch = containerHeight.value;
    const iw = imageWidth.value;
    const ih = imageHeight.value;
    
    // Eğer görsel boyutları henüz yüklenmediyse, container boyutlarını kullan
    if (iw === 0 || ih === 0 || cw === 0 || ch === 0) {
      return { x: 0, y: 0 };
    }
    
    // Görselin scaled boyutu
    const scaledWidth = iw * currentScale;
    const scaledHeight = ih * currentScale;
    
    // Eğer scaled görsel container'dan küçükse, translate'i sıfırla
    if (scaledWidth <= cw && scaledHeight <= ch) {
      return { x: 0, y: 0 };
    }
    
    // Maksimum translate değerleri (görselin kenarları container'ın kenarlarına değdiğinde)
    // Daha agresif: görselin her zaman container içinde kalmasını sağla
    const maxTranslateX = Math.max(0, (scaledWidth - cw) / 2);
    const maxTranslateY = Math.max(0, (scaledHeight - ch) / 2);
    
    // Translate değerlerini clamp et - daha agresif sınırlama
    const clampedX = clamp(currentTranslateX, -maxTranslateX, maxTranslateX);
    const clampedY = clamp(currentTranslateY, -maxTranslateY, maxTranslateY);
    
    return { x: clampedX, y: clampedY };
  };

  const notifyZoomChange = useCallback(
    (active: boolean) => {
      onZoomActiveChange?.(active);
    },
    [onZoomActiveChange]
  );

  const maybeNotifyZoomState = (currentScale: number) => {
    'worklet';
    const active = currentScale >= ZOOM_THRESHOLD;
    if (active !== isZoomed.value) {
      isZoomed.value = active;
      if (onZoomActiveChange) {
        runOnJS(notifyZoomChange)(active);
      }
    }
  };

  const resetToInitial = () => {
    'worklet';
    scale.value = withTiming(1, { duration: 180 });
    translateX.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(0, { duration: 180 });
    maybeNotifyZoomState(1);
  };

  // iOS için pinch gesture (boundary check eklendi)
  const iosPinchGesture = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const nextScale = clamp(
        savedScale.value * event.scale,
        minScale,
        maxScale
      );
      scale.value = nextScale;
      maybeNotifyZoomState(nextScale);
      
      // Boundary check - zoom yapılırken görselin sınırları içinde kalması için
      const clamped = clampTranslate(nextScale, translateX.value, translateY.value);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      // Boundary check - gesture bitince de sınırları kontrol et
      const clamped = clampTranslate(scale.value, translateX.value, translateY.value);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
      
      if (scale.value < minScale) {
        resetToInitial();
      }
    });

  // Android için pinch gesture (iOS tarafına dokunmadan, boundary check eklendi)
  // Pinch gesture zaten 2 parmak gerektirir, minPointers/maxPointers gerekmez
  const androidPinchGesture = Gesture.Pinch()
    .enabled(true)
    .onBegin(() => {
      if (__DEV__) console.log('Android Pinch BEGIN');
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      if (__DEV__) console.log('Android Pinch UPDATE', event.scale);
      const nextScale = clamp(
        savedScale.value * event.scale,
        minScale,
        maxScale
      );
      scale.value = nextScale;
      maybeNotifyZoomState(nextScale);
      
      // Boundary check - zoom yapılırken görselin sınırları içinde kalması için
      const clamped = clampTranslate(nextScale, translateX.value, translateY.value);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      if (__DEV__) console.log('Android Pinch END');
      
      // Boundary check - gesture bitince de sınırları kontrol et
      const clamped = clampTranslate(scale.value, translateX.value, translateY.value);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
      
      if (scale.value < minScale) {
        resetToInitial();
      }
    });

  const pinchGesture = Platform.OS === 'android' ? androidPinchGesture : iosPinchGesture;

  // iOS için pan gesture (boundary check eklendi)
  const iosPanGesture = Gesture.Pan()
    .onBegin(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      // Sadece zoom edilmiş durumda pan açılsın
      if (scale.value <= minScale) {
        translateX.value = 0;
        translateY.value = 0;
        return;
      }
      const newTranslateX = savedTranslateX.value + event.translationX;
      const newTranslateY = savedTranslateY.value + event.translationY;
      
      // Boundary check - görselin ekran sınırları içinde kalması için
      const clamped = clampTranslate(scale.value, newTranslateX, newTranslateY);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      // Boundary check - gesture bitince de sınırları kontrol et
      const clamped = clampTranslate(scale.value, translateX.value, translateY.value);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
      
      // Scale tekrar 1'e yakınsa panning'i sıfırla
      if (scale.value <= minScale) {
        resetToInitial();
      }
    });

  // Android için pan gesture (iOS tarafına dokunmadan, boundary check eklendi)
  // Android'de pan gesture'ı pinch ile simultane çalışmalı ve daha hassas ayarlar gerekli
  const androidPanGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(true)
    .activeOffsetX([-3, 3])
    .activeOffsetY([-3, 3])
    .failOffsetX([-200, 200])
    .failOffsetY([-200, 200])
    .shouldCancelWhenOutside(false)
    .onBegin(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      // Sadece zoom edilmiş durumda pan açılsın
      if (scale.value <= minScale) {
        translateX.value = 0;
        translateY.value = 0;
        return;
      }
      const newTranslateX = savedTranslateX.value + event.translationX;
      const newTranslateY = savedTranslateY.value + event.translationY;
      
      // Boundary check - görselin ekran sınırları içinde kalması için
      const clamped = clampTranslate(scale.value, newTranslateX, newTranslateY);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      // Boundary check - gesture bitince de sınırları kontrol et
      const clamped = clampTranslate(scale.value, translateX.value, translateY.value);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
      
      // Scale tekrar 1'e yakınsa panning'i sıfırla
      if (scale.value <= minScale) {
        resetToInitial();
      }
    });

  const panGesture = Platform.OS === 'android' ? androidPanGesture : iosPanGesture;

  // iOS için double-tap gesture (değiştirilmedi)
  const iosDoubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((_event, success) => {
      if (!success) return;

      if (scale.value > minScale) {
        // Zaten zoom'luysa resetle
        resetToInitial();
      } else {
        // Double-tap ile zoom in
        const target = clamp(doubleTapScale, minScale, maxScale);
        scale.value = withTiming(target, { duration: 180 });
        translateX.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(0, { duration: 180 });
        maybeNotifyZoomState(target);
      }
    });

  // Android için double-tap gesture (iOS tarafına dokunmadan)
  const androidDoubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .enabled(true)
    .maxDuration(250)
    .onEnd((_event, success) => {
      if (__DEV__) console.log('Android DoubleTap END', success);
      if (!success) return;

      if (scale.value > minScale) {
        // Zaten zoom'luysa resetle
        resetToInitial();
      } else {
        // Double-tap ile zoom in
        const target = clamp(doubleTapScale, minScale, maxScale);
        scale.value = withTiming(target, { duration: 180 });
        translateX.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(0, { duration: 180 });
        maybeNotifyZoomState(target);
      }
    });

  const doubleTapGesture = Platform.OS === 'android' ? androidDoubleTapGesture : iosDoubleTapGesture;

  // Android için gesture compose - daha basit yaklaşım
  // iOS için gesture compose - hepsi simultane (değiştirilmedi)
  const composedGesture = Platform.OS === 'android'
    ? Gesture.Race(
        doubleTapGesture,
        Gesture.Simultaneous(pinchGesture, panGesture)
      )
    : Gesture.Simultaneous(
        doubleTapGesture,
        pinchGesture,
        panGesture
      );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  // Container boyutlarını almak için callback
  const handleContainerLayout = useCallback((event: any) => {
    const { width, height } = event.nativeEvent.layout;
    containerWidth.value = width;
    containerHeight.value = height;
  }, []);

  // Görsel boyutlarını almak için callback - image wrapper'ın boyutlarını kullan
  const handleImageLayout = useCallback((event: any) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      imageWidth.value = width;
      imageHeight.value = height;
    }
  }, []);

  // Görselin gerçek boyutlarını almak için callback
  const handleImageLoad = useCallback((event: any) => {
    // Expo-image'ın onLoad callback'i farklı format kullanabilir
    // Önce image wrapper'ın boyutlarını kullan, sonra natural boyutları al
    const naturalWidth = event.source?.width || event.nativeEvent?.source?.width || 0;
    const naturalHeight = event.source?.height || event.nativeEvent?.source?.height || 0;
    
    if (naturalWidth > 0 && naturalHeight > 0) {
      imageNaturalWidth.value = naturalWidth;
      imageNaturalHeight.value = naturalHeight;
      
      // contentFit="contain" için render edilen boyutları hesapla
      const cw = containerWidth.value;
      const ch = containerHeight.value;
      
      if (cw > 0 && ch > 0) {
        const aspectRatio = naturalWidth / naturalHeight;
        const containerAspectRatio = cw / ch;
        
        let renderWidth = cw;
        let renderHeight = ch;
        
        if (aspectRatio > containerAspectRatio) {
          // Görsel daha geniş, yüksekliği container'a göre ayarla
          renderHeight = cw / aspectRatio;
        } else {
          // Görsel daha yüksek, genişliği container'a göre ayarla
          renderWidth = ch * aspectRatio;
        }
        
        imageWidth.value = renderWidth;
        imageHeight.value = renderHeight;
      }
    }
  }, []);

  return (
    <View 
      style={containerStyle} 
      collapsable={false}
      onLayout={handleContainerLayout}
    >
      <GestureDetector
        gesture={composedGesture}
        simultaneousHandlers={simultaneousHandlers}
        enabled={true}
      >
        <AnimatedView style={animatedStyle} collapsable={false}>
          <View 
            style={imageWrapperStyle} 
            collapsable={false}
            onLayout={handleImageLayout}
          >
            <Image
              source={{ uri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              transition={100}
              cachePolicy="memory-disk"
              onLoad={handleImageLoad}
            />
          </View>
        </AnimatedView>
      </GestureDetector>
    </View>
  );
};

export default ZoomableImage;


