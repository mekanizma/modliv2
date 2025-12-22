import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Switch,
  Modal,
  Dimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SUBSCRIPTION_PLANS } from '../../src/types';
import * as ImagePicker from 'expo-image-picker';
import { ensureDailyOutfitReminderScheduled, getNotificationsEnabled, setNotificationsEnabled } from '../../src/lib/notifications';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { profile, signOut, user, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const enabled = await getNotificationsEnabled();
        setNotificationsEnabled(enabled);
      } catch (error) {
        console.warn('Failed to load notifications preference', error);
      }
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      t.settings.logout,
      language === 'en' ? 'Are you sure you want to log out?' : 'Çıkış yapmak istediğinize emin misiniz?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.settings.logout,
          style: 'destructive',
          onPress: async () => {
            console.log('🚪 Starting logout process...');
            await signOut();
            console.log('📍 Navigating to auth screen...');
            // Use small timeout to ensure state is cleared
            setTimeout(() => {
              router.replace('/(auth)');
            }, 100);
            console.log('✅ Logout navigation initiated');
          },
        },
      ]
    );
  };

  const handleAvatarPress = () => {
    if (profile?.avatar_url) {
      setAvatarModalVisible(true);
    } else {
      showImageOptions();
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      language === 'en' ? 'Change Photo' : 'Fotoğraf Değiştir',
      '',
      [
        { 
          text: language === 'en' ? 'Take Photo' : 'Fotoğraf Çek', 
          onPress: () => pickImage(true) 
        },
        { 
          text: language === 'en' ? 'Choose from Gallery' : 'Galeriden Seç', 
          onPress: () => pickImage(false) 
        },
        { text: language === 'en' ? 'Cancel' : 'İptal', style: 'cancel' },
      ]
    );
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        const permissionType = useCamera 
          ? (language === 'en' ? 'Camera' : 'Kamera')
          : (language === 'en' ? 'Photo Library' : 'Fotoğraf Galerisi');
        
        Alert.alert(
          `📷 ${permissionType} ${language === 'en' ? 'Permission Required' : 'İzni Gerekli'}`,
          language === 'en' 
            ? `Modli needs access to your ${permissionType.toLowerCase()} to update your profile photo.\n\nPlease enable this permission in Settings.`
            : `Modli profil fotoğrafınızı güncellemek için ${permissionType.toLowerCase()} erişimine ihtiyaç duyuyor.\n\nLütfen bu izni Ayarlar'dan etkinleştirin.`,
          [
            {
              text: language === 'en' ? 'Cancel' : 'İptal',
              style: 'cancel'
            },
            {
              text: language === 'en' ? '⚙️ Open Settings' : '⚙️ Ayarları Aç',
              onPress: () => Linking.openSettings()
            }
          ]
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.6,
            base64: true,
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.6,
            base64: true,
            exif: false,
          });

      if (!result.canceled && result.assets[0].base64) {
        setUpdatingAvatar(true);
        setAvatarModalVisible(false);
        
        const newAvatarUrl = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await updateProfile({ avatar_url: newAvatarUrl });
        
        Alert.alert(
          '✅ ' + (language === 'en' ? 'Success!' : 'Başarılı!'),
          language === 'en' ? 'Your profile photo has been updated.' : 'Profil fotoğrafınız güncellendi.'
        );
        setUpdatingAvatar(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(
        '❌ ' + (language === 'en' ? 'Error' : 'Hata'),
        language === 'en' 
          ? 'We couldn\'t update your photo. Please try again.' 
          : 'Fotoğrafınız güncellenemedi. Lütfen tekrar deneyin.'
      );
      setUpdatingAvatar(false);
    }
  };

  const getCurrentPlan = () => {
    if (!profile?.subscription_tier) return null;
    return SUBSCRIPTION_PLANS.find((p) => p.id === profile.subscription_tier);
  };

  const currentPlan = getCurrentPlan();

  const MenuItem = ({
    icon,
    label,
    onPress,
    rightElement,
    danger,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons
          name={icon}
          size={22}
          color={danger ? '#ef4444' : '#6b7280'}
        />
        <Text style={[styles.menuItemText, danger && { color: '#ef4444' }]}>
          {label}
        </Text>
      </View>
      {rightElement || (
        <Ionicons name="chevron-forward" size={20} color="#6b7280" />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top, paddingBottom: insets.bottom + 100 },
      ]}
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8}>
          {updatingAvatar ? (
            <View style={styles.avatarPlaceholder}>
              <ActivityIndicator size="large" color="#6366f1" />
            </View>
          ) : profile?.avatar_url ? (
            <View>
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </View>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={40} color="#6366f1" />
              <View style={styles.editBadge}>
                <Ionicons name="add" size={14} color="#fff" />
              </View>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.userName}>
          {profile?.full_name || user?.email?.split('@')[0] || 'User'}
        </Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Subscription Card */}
      <TouchableOpacity
        style={styles.subscriptionCard}
        onPress={() => router.push('/subscription')}
      >
        <View style={styles.subscriptionLeft}>
          <Ionicons name="diamond" size={28} color="#fbbf24" />
          <View>
            <Text style={styles.subscriptionTitle}>
              {currentPlan ? currentPlan.name : (language === 'en' ? 'Free Plan' : 'Ücretsiz Plan')}
            </Text>
            <Text style={styles.subscriptionCredits}>
              {profile?.credits || 0} {t.subscription.images}
            </Text>
          </View>
        </View>
        <View style={styles.upgradeChip}>
          <Text style={styles.upgradeChipText}>{t.subscription.upgrade}</Text>
        </View>
      </TouchableOpacity>

      {/* Body Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Body Information' : 'Vücut Bilgileri'}
        </Text>
        
        <View style={styles.bodyInfoCard}>
          <View style={styles.bodyInfoItem}>
            <Ionicons name="resize-outline" size={20} color="#6366f1" />
            <Text style={styles.bodyInfoLabel}>{language === 'en' ? 'Height' : 'Boy'}</Text>
            <Text style={styles.bodyInfoValue}>{profile?.height || '-'} cm</Text>
          </View>
          <View style={styles.bodyInfoDivider} />
          <View style={styles.bodyInfoItem}>
            <Ionicons name="barbell-outline" size={20} color="#6366f1" />
            <Text style={styles.bodyInfoLabel}>{language === 'en' ? 'Weight' : 'Kilo'}</Text>
            <Text style={styles.bodyInfoValue}>{profile?.weight || '-'} kg</Text>
          </View>
          <View style={styles.bodyInfoDivider} />
          <View style={styles.bodyInfoItem}>
            <Ionicons name="person-outline" size={20} color="#6366f1" />
            <Text style={styles.bodyInfoLabel}>{language === 'en' ? 'Gender' : 'Cinsiyet'}</Text>
            <Text style={styles.bodyInfoValue}>
              {profile?.gender === 'male' ? (language === 'en' ? 'Male' : 'Erkek') : 
               profile?.gender === 'female' ? (language === 'en' ? 'Female' : 'Kadın') : 
               profile?.gender === 'other' ? (language === 'en' ? 'Other' : 'Diğer') : '-'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.editBodyInfoButton}
          onPress={() => router.push('/edit-profile')}
        >
          <Ionicons name="create-outline" size={18} color="#6366f1" />
          <Text style={styles.editBodyInfoText}>
            {language === 'en' ? 'Edit Information' : 'Bilgileri Düzenle'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings Sections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Preferences' : 'Tercihler'}
        </Text>
        
        <MenuItem
          icon="language"
          label={t.settings.language}
          rightElement={
            <TouchableOpacity
              style={styles.langSwitch}
              onPress={() => setLanguage(language === 'en' ? 'tr' : 'en')}
            >
              <Text style={styles.langText}>{language === 'en' ? 'English' : 'Türkçe'}</Text>
              <Ionicons name="swap-horizontal" size={16} color="#6366f1" />
            </TouchableOpacity>
          }
        />
        
        <MenuItem
          icon="notifications"
          label={t.settings.notifications}
          rightElement={
            <Switch
              value={notificationsEnabled}
              onValueChange={async (value) => {
                setNotificationsEnabled(value);
                if (value) {
                  await setNotificationsEnabled(true);
                  // Kullanıcı bildirimleri açtığında günlük 07:30 bildirimi planla
                  await ensureDailyOutfitReminderScheduled(language);
                } else {
                  await setNotificationsEnabled(false);
                }
              }}
              trackColor={{ false: '#2d2d44', true: '#6366f1' + '60' }}
              thumbColor={notificationsEnabled ? '#6366f1' : '#6b7280'}
            />
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'About' : 'Hakkında'}
        </Text>
        <MenuItem icon="document-text" label={t.settings.privacy} onPress={() => setPrivacyModalVisible(true)} />
        <MenuItem icon="shield-checkmark" label={t.settings.terms} onPress={() => setTermsModalVisible(true)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Account' : 'Hesap'}
        </Text>
        <MenuItem icon="log-out" label={t.settings.logout} onPress={handleLogout} danger />
      </View>

      <Text style={styles.version}>Modli v1.0.0</Text>

      {/* Avatar Full Screen Modal */}
      <Modal
        visible={avatarModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={[styles.modalCloseButton, { top: insets.top + 10 }]}
            onPress={() => setAvatarModalVisible(false)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Zoomable Avatar */}
          {profile?.avatar_url && (
            <ScrollView
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContentContainer}
              maximumZoomScale={5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent={true}
              bouncesZoom={true}
            >
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </ScrollView>
          )}

          {/* Change Photo Button */}
          <View style={[styles.modalActions, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity style={styles.changePhotoButton} onPress={showImageOptions}>
              <Ionicons name="camera-outline" size={24} color="#fff" />
              <Text style={styles.changePhotoText}>
                {language === 'en' ? 'Change Photo' : 'Fotoğrafı Değiştir'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal
        visible={privacyModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.legalModalContainer}>
          <View style={[styles.legalModalContent, { paddingTop: insets.top + 20 }]}>
            <View style={styles.legalModalHeader}>
              <Text style={styles.legalModalTitle}>
                {language === 'en' ? 'Privacy Policy' : 'Gizlilik Politikası'}
              </Text>
              <TouchableOpacity onPress={() => setPrivacyModalVisible(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.legalModalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.legalText}>
                {language === 'en' ? `
Last Updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

1. Introduction

Welcome to Modli. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we handle your personal data when you use our app.

2. Information We Collect

Personal Information:
• Email address and name
• Profile information (height, weight, gender)
• Photos you upload for virtual try-on
• Payment information for subscriptions

Usage Data:
• App usage statistics
• Device information
• Error logs and diagnostics

3. How We Use Your Information

We use your information to:
• Provide virtual try-on services using AI technology
• Process your subscription and payments
• Improve our app and services
• Send you important updates and notifications
• Provide customer support

4. Data Storage and Security

• Your data is stored securely using industry-standard encryption
• We use Supabase for authentication and database services
• Photos are processed temporarily and can be deleted at any time
• We do not sell your personal information to third parties

5. Third-Party Services

We use the following third-party services:
• Supabase (Authentication and Database)
• fal.ai (AI Image Processing)
• RapidAPI (Additional AI Services)
• Payment processors for subscriptions

6. Your Rights

You have the right to:
• Access your personal data
• Correct inaccurate data
• Delete your account and data
• Export your data
• Opt-out of marketing communications

7. Data Retention

• Account data is retained while your account is active
• You can request deletion of your data at any time
• Deleted data is permanently removed within 30 days

8. Children's Privacy

Modli is not intended for users under 13 years of age. We do not knowingly collect data from children.

9. Changes to This Policy

We may update this privacy policy from time to time. We will notify you of any changes by updating the date at the top.

10. Contact Us

If you have questions about this privacy policy, please contact us at:
Email: privacy@modli.app

By using Modli, you agree to this privacy policy.
                ` : `
Son Güncelleme: ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}

1. Giriş

Modli'ye hoş geldiniz. Gizliliğinize saygı duyuyor ve kişisel verilerinizi korumaya kararlıyız. Bu gizlilik politikası, uygulamamızı kullandığınızda kişisel verilerinizi nasıl ele aldığımız hakkında sizi bilgilendirecektir.

2. Topladığımız Bilgiler

Kişisel Bilgiler:
• E-posta adresi ve ad
• Profil bilgileri (boy, kilo, cinsiyet)
• Sanal deneme için yüklediğiniz fotoğraflar
• Abonelik için ödeme bilgileri

Kullanım Verileri:
• Uygulama kullanım istatistikleri
• Cihaz bilgileri
• Hata günlükleri ve tanılamalar

3. Bilgilerinizi Nasıl Kullanırız

Bilgilerinizi şunlar için kullanırız:
• Yapay zeka teknolojisi kullanarak sanal deneme hizmetleri sunmak
• Aboneliğinizi ve ödemelerinizi işlemek
• Uygulamamızı ve hizmetlerimizi geliştirmek
• Size önemli güncellemeler ve bildirimler göndermek
• Müşteri desteği sağlamak

4. Veri Depolama ve Güvenlik

• Verileriniz endüstri standardı şifreleme kullanılarak güvenli bir şekilde saklanır
• Kimlik doğrulama ve veritabanı hizmetleri için Supabase kullanıyoruz
• Fotoğraflar geçici olarak işlenir ve istediğiniz zaman silinebilir
• Kişisel bilgilerinizi üçüncü şahıslara satmıyoruz

5. Üçüncü Taraf Hizmetler

Aşağıdaki üçüncü taraf hizmetleri kullanıyoruz:
• Supabase (Kimlik Doğrulama ve Veritabanı)
• fal.ai (Yapay Zeka Görüntü İşleme)
• RapidAPI (Ek Yapay Zeka Hizmetleri)
• Abonelikler için ödeme işlemcileri

6. Haklarınız

Şu haklara sahipsiniz:
• Kişisel verilerinize erişim
• Yanlış verileri düzeltme
• Hesabınızı ve verilerinizi silme
• Verilerinizi dışa aktarma
• Pazarlama iletişimlerinden vazgeçme

7. Veri Saklama

• Hesap verileri, hesabınız aktif olduğu sürece saklanır
• Verilerinizin silinmesini istediğiniz zaman talep edebilirsiniz
• Silinen veriler 30 gün içinde kalıcı olarak kaldırılır

8. Çocukların Gizliliği

Modli, 13 yaşın altındaki kullanıcılar için tasarlanmamıştır. Çocuklardan bilerek veri toplamıyoruz.

9. Bu Politikadaki Değişiklikler

Bu gizlilik politikasını zaman zaman güncelleyebiliriz. Herhangi bir değişiklik olması durumunda, üstteki tarihi güncelleyerek sizi bilgilendireceğiz.

10. Bize Ulaşın

Bu gizlilik politikası hakkında sorularınız varsa, lütfen bizimle iletişime geçin:
E-posta: privacy@modli.app

Modli'yi kullanarak bu gizlilik politikasını kabul etmiş olursunuz.
                `}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Terms of Service Modal */}
      <Modal
        visible={termsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTermsModalVisible(false)}
      >
        <View style={styles.legalModalContainer}>
          <View style={[styles.legalModalContent, { paddingTop: insets.top + 20 }]}>
            <View style={styles.legalModalHeader}>
              <Text style={styles.legalModalTitle}>
                {language === 'en' ? 'Terms of Service' : 'Kullanım Şartları'}
              </Text>
              <TouchableOpacity onPress={() => setTermsModalVisible(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.legalModalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.legalText}>
                {language === 'en' ? `
Last Updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

1. Acceptance of Terms

By accessing and using Modli, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the app.

2. Description of Service

Modli is an AI-powered virtual try-on application that allows users to:
• Upload their photos
• Try on clothing items virtually using AI technology
• Save and share generated images
• Access weather-based outfit recommendations

3. User Accounts

Account Creation:
• You must provide accurate and complete information
• You are responsible for maintaining account security
• You must be at least 13 years old to create an account
• One person may not maintain multiple accounts

4. Subscription and Payments

Free Trial:
• New users receive 1 free virtual try-on credit
• Additional features may require a paid subscription

Paid Subscriptions:
• Monthly and annual plans available
• Automatic renewal unless cancelled
• Refunds subject to our refund policy
• Prices may change with 30 days notice

5. User Content and Conduct

You agree to:
• Only upload photos that you own or have permission to use
• Not upload inappropriate, offensive, or illegal content
• Not use the service for commercial purposes without permission
• Respect intellectual property rights

We reserve the right to:
• Remove content that violates these terms
• Suspend or terminate accounts for violations
• Monitor usage for quality and security

6. Intellectual Property

• Modli owns all rights to the app, technology, and algorithms
• Generated images are for personal use only
• You retain ownership of photos you upload
• We may use anonymized data to improve our services

7. AI-Generated Content

Important Notice:
• AI-generated images are approximations and may not be perfectly accurate
• Results may vary based on photo quality and clothing type
• Generated images should not be used for professional purposes without verification
• We do not guarantee specific results or accuracy

8. Privacy and Data

• Your data is handled according to our Privacy Policy
• We use secure third-party services for processing
• You can request data deletion at any time
• We may collect usage data to improve the service

9. Limitation of Liability

Modli is provided "as is" without warranties of any kind. We are not liable for:
• Inaccurate or unsatisfactory AI-generated results
• Service interruptions or technical issues
• Loss of data or content
• Indirect or consequential damages

10. Service Modifications

We reserve the right to:
• Modify or discontinue features
• Change pricing with notice
• Update these terms (we'll notify you of major changes)
• Terminate the service with 30 days notice

11. Termination

We may terminate or suspend your account if:
• You violate these terms
• You engage in fraudulent activity
• Your account remains inactive for extended periods

You may terminate your account at any time through the app settings.

12. Governing Law

These terms are governed by the laws of Turkey. Any disputes will be resolved in Turkish courts.

13. Contact Us

For questions about these terms:
Email: support@modli.app

14. Updates

We may update these terms from time to time. Continued use of the app after changes constitutes acceptance of the new terms.

By using Modli, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
                ` : `
Son Güncelleme: ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}

1. Şartların Kabulü

Modli'ye erişerek ve kullanarak, bu Kullanım Şartlarını kabul etmiş olursunuz. Bu şartları kabul etmiyorsanız, lütfen uygulamayı kullanmayın.

2. Hizmet Açıklaması

Modli, kullanıcıların şunları yapmasına olanak tanıyan yapay zeka destekli bir sanal deneme uygulamasıdır:
• Fotoğraflarını yüklemek
• Yapay zeka teknolojisini kullanarak kıyafetleri sanal olarak denemek
• Oluşturulan görüntüleri kaydetmek ve paylaşmak
• Hava durumuna göre kıyafet önerileri almak

3. Kullanıcı Hesapları

Hesap Oluşturma:
• Doğru ve eksiksiz bilgi sağlamalısınız
• Hesap güvenliğini korumaktan siz sorumlusunuz
• Hesap oluşturmak için en az 13 yaşında olmalısınız
• Bir kişi birden fazla hesap kullanamaz

4. Abonelik ve Ödemeler

Ücretsiz Deneme:
• Yeni kullanıcılar 1 ücretsiz sanal deneme kredisi alır
• Ek özellikler ücretli abonelik gerektirebilir

Ücretli Abonelikler:
• Aylık ve yıllık planlar mevcuttur
• İptal edilmediği sürece otomatik yenileme
• İadeler, iade politikamıza tabidir
• Fiyatlar 30 gün önceden bildirimle değişebilir

5. Kullanıcı İçeriği ve Davranışı

Kabul ediyorsunuz:
• Yalnızca sahip olduğunuz veya kullanma izniniz olan fotoğrafları yüklemek
• Uygunsuz, saldırgan veya yasa dışı içerik yüklememek
• Hizmeti izinsiz ticari amaçlarla kullanmamak
• Fikri mülkiyet haklarına saygı göstermek

Şu haklara sahibiz:
• Bu şartları ihlal eden içeriği kaldırmak
• İhlaller nedeniyle hesapları askıya almak veya sonlandırmak
• Kalite ve güvenlik için kullanımı izlemek

6. Fikri Mülkiyet

• Modli, uygulama, teknoloji ve algoritmaların tüm haklarına sahiptir
• Oluşturulan görüntüler yalnızca kişisel kullanım içindir
• Yüklediğiniz fotoğrafların sahipliği size aittir
• Hizmetlerimizi geliştirmek için anonim veri kullanabiliriz

7. Yapay Zeka ile Oluşturulan İçerik

Önemli Uyarı:
• Yapay zeka tarafından oluşturulan görüntüler tahminlerdir ve tamamen doğru olmayabilir
• Sonuçlar fotoğraf kalitesine ve kıyafet türüne göre değişebilir
• Oluşturulan görüntüler doğrulama yapılmadan profesyonel amaçlar için kullanılmamalıdır
• Belirli sonuçlar veya doğruluk garanti etmiyoruz

8. Gizlilik ve Veri

• Verileriniz Gizlilik Politikamıza göre işlenir
• İşleme için güvenli üçüncü taraf hizmetler kullanıyoruz
• Verilerinizin silinmesini istediğiniz zaman talep edebilirsiniz
• Hizmeti geliştirmek için kullanım verileri toplayabiliriz

9. Sorumluluk Sınırlaması

Modli "olduğu gibi" herhangi bir garanti olmaksızın sağlanır. Şunlardan sorumlu değiliz:
• Yanlış veya tatmin edici olmayan yapay zeka sonuçları
• Hizmet kesintileri veya teknik sorunlar
• Veri veya içerik kaybı
• Dolaylı veya sonuç olarak ortaya çıkan zararlar

10. Hizmet Değişiklikleri

Şu haklara sahibiz:
• Özellikleri değiştirmek veya durdurmak
• Bildirimle fiyatları değiştirmek
• Bu şartları güncellemek (büyük değişiklikler için sizi bilgilendireceğiz)
• 30 gün önceden bildirimle hizmeti sonlandırmak

11. Sonlandırma

Hesabınızı şu durumlarda sonlandırabiliriz:
• Bu şartları ihlal ederseniz
• Hileli faaliyette bulunursanız
• Hesabınız uzun süre aktif kalmazsa

Uygulama ayarlarından hesabınızı istediğiniz zaman sonlandırabilirsiniz.

12. Yürürlükteki Hukuk

Bu şartlar Türkiye yasalarına tabidir. Herhangi bir anlaşmazlık Türkiye mahkemelerinde çözülecektir.

13. Bize Ulaşın

Bu şartlar hakkında sorularınız için:
E-posta: support@modli.app

14. Güncellemeler

Bu şartları zaman zaman güncelleyebiliriz. Değişikliklerden sonra uygulamayı kullanmaya devam etmek, yeni şartların kabulü anlamına gelir.

Modli'yi kullanarak, bu Kullanım Şartlarını okuduğunuzu, anladığınızı ve bunlara bağlı kalmayı kabul ettiğinizi onaylamış olursunuz.
                `}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    paddingHorizontal: 20,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6366f1' + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  editBadge: {
    position: 'absolute',
    bottom: 16,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  subscriptionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fbbf24' + '30',
  },
  subscriptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subscriptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subscriptionCredits: {
    color: '#fbbf24',
    fontSize: 13,
    marginTop: 2,
  },
  upgradeChip: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  upgradeChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    color: '#fff',
    fontSize: 15,
  },
  langSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366f1' + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  langText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '500',
  },
  version: {
    textAlign: 'center',
    color: '#4b5563',
    fontSize: 12,
    marginTop: 20,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
    width: width,
  },
  scrollContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: width,
    height: height * 0.7,
  },
  modalActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  changePhotoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bodyInfoCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bodyInfoItem: {
    alignItems: 'center',
    gap: 4,
  },
  bodyInfoLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  bodyInfoValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bodyInfoDivider: {
    width: 1,
    backgroundColor: '#2d2d44',
  },
  editBodyInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  editBodyInfoText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
  // Legal Modal Styles
  legalModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  legalModalContent: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: height * 0.9,
    paddingHorizontal: 20,
  },
  legalModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
    marginBottom: 16,
  },
  legalModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  legalModalScroll: {
    flex: 1,
  },
  legalText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 22,
    paddingBottom: 40,
  },
});
