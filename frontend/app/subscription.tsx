import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '../src/contexts/LanguageContext';
import { useAuth } from '../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SUBSCRIPTION_PLANS, SubscriptionPlan } from '../src/types';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { profile, updateProfile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const getPlanTagline = (planId: string) => {
    if (language === 'en') {
      switch (planId) {
        case 'basic':
          return 'Take your first step into the fashion world. Bring your wardrobe pieces to life with AI and start discovering your style.';
        case 'standard':
          return 'Perfect style for every day! Plan your weekly outfits in seconds and end the "what should I wear" dilemma every morning.';
        case 'premium':
          return 'For style enthusiasts who push boundaries! Have your personal style consultant with you at all times, shine every day with unlimited creativity.';
        default:
          return '';
      }
    } else {
      switch (planId) {
        case 'basic':
          return 'Moda dünyasına ilk adımı atın. Gardırobunuzdaki parçaları yapay zeka ile canlandırın ve stilinizi keşfetmeye başlayın.';
        case 'standard':
          return 'Her güne kusursuz bir stil! Haftalık kombinlerinizi saniyeler içinde planlayın ve her sabah "ne giyeceğim" derdine son verin.';
        case 'premium':
          return 'Sınırları zorlayan stil tutkunları için! Kişisel stil danışmanınız her an yanınızda olsun, sınırsız yaratıcılıkla her gün ışıldayın.';
        default:
          return '';
      }
    }
  };

  const handlePurchase = async () => {
    if (!selectedPlan) return;

    setPurchasing(true);
    
    // In production, integrate with payment provider (Stripe, RevenueCat, etc.)
    // For now, simulate a purchase
    Alert.alert(
      language === 'en' ? 'Payment' : 'Ödeme',
      language === 'en'
        ? `This would charge $${selectedPlan.price_usd} for ${selectedPlan.credits} credits`
        : `${selectedPlan.credits} kredi için ${selectedPlan.price_try} TL tahsil edilecektir`,
      [
        { text: t.common.cancel, style: 'cancel', onPress: () => setPurchasing(false) },
        {
          text: language === 'en' ? 'Confirm (Demo)' : 'Onayla (Demo)',
          onPress: async () => {
            // Demo: Add credits
            await updateProfile({
              credits: (profile?.credits || 0) + selectedPlan.credits,
              subscription_tier: selectedPlan.id,
            });
            await refreshProfile();
            setPurchasing(false);
            Alert.alert(
              language === 'en' ? 'Success!' : 'Başarılı!',
              language === 'en'
                ? `${selectedPlan.credits} credits added to your account`
                : `${selectedPlan.credits} kredi hesabınıza eklendi`,
              [{ text: 'OK', onPress: () => router.back() }]
            );
          },
        },
      ]
    );
  };

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'basic':
        return '#22c55e';
      case 'standard':
        return '#6366f1';
      case 'premium':
        return '#f59e0b';
      default:
        return '#6366f1';
    }
  };

  const getPlanIcon = (planId: string): keyof typeof Ionicons.glyphMap => {
    switch (planId) {
      case 'basic':
        return 'star-outline';
      case 'standard':
        return 'star-half';
      case 'premium':
        return 'star';
      default:
        return 'star-outline';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t.subscription.title}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Current Credits */}
        <View style={styles.currentCredits}>
          <Ionicons name="sparkles" size={24} color="#fbbf24" />
          <Text style={styles.currentCreditsText}>
            {language === 'en' ? 'Current Credits:' : 'Mevcut Kredi:'} {profile?.credits || 0}
          </Text>
        </View>

        {/* Plans */}
        {SUBSCRIPTION_PLANS.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={[
              styles.planCard,
              selectedPlan?.id === plan.id && {
                borderColor: getPlanColor(plan.id),
              },
            ]}
            onPress={() => setSelectedPlan(plan)}
          >
            {plan.id === 'standard' && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>
                  {language === 'en' ? 'POPULAR' : 'POPÜLER'}
                </Text>
              </View>
            )}
            
            <View style={styles.planHeader}>
              <View style={[styles.planIcon, { backgroundColor: getPlanColor(plan.id) + '20' }]}>
                <Ionicons name={getPlanIcon(plan.id)} size={28} color={getPlanColor(plan.id)} />
              </View>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>
                  {t.subscription[plan.id as keyof typeof t.subscription]}
                </Text>
                <Text style={styles.planCredits}>
                  {plan.credits} {t.subscription.images}
                </Text>
                <Text style={styles.planTagline}>
                  {getPlanTagline(plan.id)}
                </Text>
              </View>
              <View style={styles.planPrice}>
                <Text style={styles.priceMain}>
                  {language === 'en'
                    ? `$${plan.price_usd}`
                    : `${plan.price_try} TL`}
                </Text>
              </View>
            </View>

            {selectedPlan?.id === plan.id && (
              <View style={styles.selectedCheck}>
                <Ionicons name="checkmark-circle" size={24} color={getPlanColor(plan.id)} />
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>{t.subscription.features}</Text>
          
          {language === 'tr' ? (
            <>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>Sınırsız Dijital Gardırop: Tüm kıyafetlerinizi cebinizde taşıyın, istediğiniz yerden erişin.</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>Gelişmiş AI Prova Odası: Kıyafetleri üzerinizde görmeden satın alma riskini bitirin.</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>Akıllı Hava Durumu Entegrasyonu: Yağmura veya soğuğa yakalanmayın; hava durumuna en uygun kombin önerileri.</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>Vücut Tipine Özel Analiz: Sadece size en çok yakışacak kesimleri ve modelleri keşfedin.</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>Renk Uyumu Asistanı: Birbiriyle en uyumlu renkleri yapay zeka ile anında eşleştirin.</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>Unlimited Digital Wardrobe: Carry all your clothes in your pocket, access from anywhere.</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>Advanced AI Fitting Room: Eliminate the risk of buying clothes without seeing them on you.</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>Smart Weather Integration: Don't get caught in rain or cold; outfit suggestions tailored to weather conditions.</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>Body Type-Specific Analysis: Discover only the cuts and models that suit you best.</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>Color Harmony Assistant: Instantly match the most harmonious colors with AI.</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Purchase Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[
            styles.purchaseButton,
            !selectedPlan && styles.purchaseButtonDisabled,
          ]}
          onPress={handlePurchase}
          disabled={!selectedPlan || purchasing}
        >
          <Text style={styles.purchaseButtonText}>
            {purchasing
              ? (language === 'en' ? 'Processing...' : 'İşleniyor...')
              : selectedPlan
              ? language === 'en'
                ? `Purchase - $${selectedPlan.price_usd}`
                : `Satın Al - ${selectedPlan.price_try} TL`
              : (language === 'en' ? 'Select a Plan' : 'Plan Seçin')}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.disclaimer}>
          {language === 'en'
            ? 'Secure payment processed. Cancel anytime.'
            : 'Güvenli ödeme. İstediğiniz zaman iptal edin.'}
        </Text>
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  currentCredits: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a1a2e',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 24,
  },
  currentCreditsText: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '600',
  },
  planCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2d2d44',
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  popularText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planInfo: {
    flex: 1,
    marginLeft: 14,
  },
  planName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  planCredits: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 2,
  },
  planTagline: {
    color: '#e5e7eb',
    fontSize: 12,
    marginTop: 4,
  },
  planPrice: {
    alignItems: 'flex-end',
  },
  priceMain: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  selectedCheck: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  featuresSection: {
    marginTop: 24,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
  },
  featuresTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  featureText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
  },
  purchaseButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  purchaseButtonDisabled: {
    backgroundColor: '#6366f1' + '60',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimer: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
});
