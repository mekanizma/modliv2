import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { PRODUCT_IDS, SubscriptionPlan } from '../types';

// Expo Go'da react-native-iap çalışmaz, conditional import yapıyoruz
let RNIap: any = null;
let isIapAvailable = false;

try {
  // Sadece development client veya production build'de yükle
  if (Constants.appOwnership !== 'expo') {
    RNIap = require('react-native-iap');
    isIapAvailable = true;
  }
} catch (error) {
  console.warn('react-native-iap not available:', error);
  isIapAvailable = false;
}

// Mock types for Expo Go
export interface Purchase {
  productId: string;
  transactionReceipt?: string;
  purchaseToken?: string;
  acknowledged?: boolean;
  purchaseStateAndroid?: number;
}

export interface PurchaseError {
  code: string;
  message: string;
}

export interface Product {
  productId: string;
  localizedPrice: string;
  price: string;
  currency: string;
}

let purchaseUpdateSubscription: any = null;
let purchaseErrorSubscription: any = null;

export interface PurchaseResult {
  success: boolean;
  transactionReceipt?: string;
  productId?: string;
  error?: string;
}

/**
 * In-app purchase servisini başlatır
 */
export async function initPurchases(): Promise<boolean> {
  if (!isIapAvailable || !RNIap) {
    console.warn('IAP not available (Expo Go or not installed)');
    return false;
  }
  
  try {
    const result = await RNIap.initConnection();
    console.log('Purchase service initialized:', result);
    return result;
  } catch (error) {
    console.error('Failed to initialize purchase service:', error);
    return false;
  }
}

/**
 * Satın alma güncellemelerini dinler
 */
export function setupPurchaseListeners(
  onPurchaseComplete: (purchase: Purchase) => void,
  onPurchaseError: (error: PurchaseError) => void
) {
  if (!isIapAvailable || !RNIap) {
    console.warn('IAP not available, listeners not set up');
    return;
  }

  // Önceki listener'ları temizle
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
  }

  // Yeni listener'ları kur
  purchaseUpdateSubscription = RNIap.purchaseUpdatedListener((purchase: Purchase) => {
    console.log('Purchase updated:', purchase);
    onPurchaseComplete(purchase);
  });

  purchaseErrorSubscription = RNIap.purchaseErrorListener((error: PurchaseError) => {
    console.error('Purchase error:', error);
    onPurchaseError(error);
  });
}

/**
 * Satın alma listener'larını temizler
 */
export function cleanupPurchaseListeners() {
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }
}

/**
 * Mevcut ürünleri Google Play / App Store'dan alır
 */
export async function getProducts(): Promise<Product[]> {
  if (!isIapAvailable || !RNIap) {
    console.warn('IAP not available, returning empty products');
    return [];
  }

  try {
    const products = await RNIap.getProducts({ skus: PRODUCT_IDS });
    console.log('Available products:', products);
    return products;
  } catch (error) {
    console.error('Failed to get products:', error);
    return [];
  }
}

/**
 * Belirli bir ürünü satın alır
 */
export async function purchaseProduct(productId: string): Promise<PurchaseResult> {
  if (!isIapAvailable || !RNIap) {
    return {
      success: false,
      error: 'IAP not available. Please use a development build or production build.',
    };
  }

  try {
    console.log('Attempting to purchase:', productId);
    
    // Satın alma işlemini başlat
    const purchase = await RNIap.requestPurchase({ sku: productId });
    
    // Satın alma işlemi başlatıldı, listener üzerinden sonuç gelecek
    return {
      success: true,
      productId: purchase.productId,
      transactionReceipt: purchase.transactionReceipt,
    };
  } catch (error: any) {
    console.error('Purchase failed:', error);
    
    // Kullanıcı iptal ettiyse hata gösterme
    if (error.code === 'E_USER_CANCELLED' || error.code === 'USER_CANCELLED') {
      return {
        success: false,
        error: 'cancelled',
      };
    }

    return {
      success: false,
      error: error.message || 'Purchase failed',
    };
  }
}

/**
 * Satın alınan ürünü doğrular ve tamamlar
 */
export async function acknowledgePurchase(
  purchase: Purchase
): Promise<boolean> {
  if (!isIapAvailable || !RNIap) {
    console.warn('IAP not available, cannot acknowledge purchase');
    return false;
  }

  try {
    if (Platform.OS === 'android') {
      // Android için acknowledgePurchase kullan
      const PurchaseStateAndroid = RNIap.PurchaseStateAndroid || {
        PURCHASED: 1,
      };
      
      if (purchase.purchaseStateAndroid === PurchaseStateAndroid.PURCHASED) {
        if (!purchase.acknowledged) {
          await RNIap.finishTransaction({ purchase });
          await RNIap.acknowledgePurchaseAndroid({ token: purchase.purchaseToken });
        } else {
          await RNIap.finishTransaction({ purchase });
        }
      } else {
        await RNIap.finishTransaction({ purchase });
      }
    } else {
      // iOS için finishTransaction kullan
      await RNIap.finishTransaction({ purchase });
    }
    
    console.log('Purchase acknowledged:', purchase.productId);
    return true;
  } catch (error) {
    console.error('Failed to acknowledge purchase:', error);
    return false;
  }
}

/**
 * Bekleyen satın almaları kontrol eder
 */
export async function getPendingPurchases(): Promise<Purchase[]> {
  if (!isIapAvailable || !RNIap) {
    return [];
  }

  try {
    const purchases = await RNIap.getAvailablePurchases();
    console.log('Pending purchases:', purchases);
    return purchases;
  } catch (error) {
    console.error('Failed to get pending purchases:', error);
    return [];
  }
}

/**
 * Satın alma servisini kapatır
 */
export async function endConnection(): Promise<void> {
  if (!isIapAvailable || !RNIap) {
    return;
  }

  try {
    cleanupPurchaseListeners();
    await RNIap.endConnection();
    console.log('Purchase service disconnected');
  } catch (error) {
    console.error('Failed to end connection:', error);
  }
}

/**
 * Plan ID'den product ID'yi bulur
 */
export function getProductIdFromPlanId(planId: string, plans: SubscriptionPlan[]): string | null {
  const plan = plans.find(p => p.id === planId);
  return plan?.productId || null;
}

