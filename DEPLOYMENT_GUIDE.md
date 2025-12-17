# 🚀 Modli Production Deployment Guide

Bu rehber, Modli uygulamasını production ortamına deploy etmek için adım adım talimatlar içerir.

## 📋 İçindekiler

1. [Ön Hazırlık](#-ön-hazırlık)
2. [Backend Deployment (Coolify)](#-backend-deployment-coolify)
3. [Mobile App Deployment (Expo EAS)](#-mobile-app-deployment-expo-eas)
4. [Database Setup](#-database-setup)
5. [Domain & SSL](#-domain--ssl)
6. [Production Checklist](#-production-checklist)

---

## 🎯 Ön Hazırlık

### Gerekli Hesaplar

- [ ] **GitHub Account** (✅ Hazır: https://github.com/mekanizma/modliv1)
- [ ] **VPS/Cloud Server** (DigitalOcean, Hetzner, Linode, vb.)
  - Minimum: 2 CPU, 2GB RAM, 20GB Disk
  - Önerilen: Ubuntu 22.04 LTS
- [ ] **Domain Name** (örn: modli.mekanizma.com)
- [ ] **MongoDB Atlas Account** (ücretsiz tier yeterli)
- [ ] **Supabase Account** (production projesi)
- [ ] **Apple Developer Account** ($99/yıl - iOS için)
- [ ] **Google Play Console** ($25 one-time - Android için)
- [ ] **Expo Account** (ücretsiz)

### API Keys Hazırlığı

Aşağıdaki API anahtarlarını hazır bulundurun:
- fal.ai API Key
- OpenWeatherMap API Key
- Supabase Production URL & Keys
- MongoDB Atlas Connection String

---

## 🐳 Backend Deployment (Coolify)

### 1. Sunucu Hazırlığı

```bash
# SSH ile sunucunuza bağlanın
ssh root@YOUR_SERVER_IP

# Sistem güncellemesi
apt update && apt upgrade -y

# Coolify kurulumu (tek komut!)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

**Kurulum süresi:** ~5 dakika

**Coolify'a erişim:** `http://YOUR_SERVER_IP:8000`

### 2. Coolify'da Proje Oluşturma

1. **Dashboard** → `+ New Resource` → `Application`

2. **Git Repository:**
   - Source: GitHub
   - Repository: `https://github.com/mekanizma/modliv1.git`
   - Branch: `main`
   - Build Pack: `Dockerfile`
   - Dockerfile Location: `backend/Dockerfile`

3. **Configuration:**
   - Name: `modli-backend`
   - Port: `8000`
   - Start Command: (Dockerfile'da tanımlı, değiştirmeyin)

4. **Environment Variables:**
   ```env
   MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/modli_prod
   DB_NAME=modli_prod
   FAL_KEY=a0a89116-c4cb-44e6-a338-73c631f770a8:6c791175bb517cccef78ba26fd767c9f
   OPENWEATHER_API_KEY=8eb7f79142dbe8f173e1c81e85853fbc
   SUPABASE_URL=https://your-prod-project.supabase.co
   SUPABASE_KEY=your_service_role_key
   ```

5. **Deploy** butonuna basın!

### 3. Domain & SSL Yapılandırması

**Domain DNS Ayarları:**
```
Type: A Record
Name: modli.mekanizma.com
Value: YOUR_SERVER_IP
TTL: 300
```

**Coolify'da:**
1. Application → Domains
2. `modli.mekanizma.com` ekleyin
3. `Generate Domain` veya manuel girin
4. `Enable HTTPS` → Let's Encrypt otomatik çalışır

✅ **5-10 dakika içinde:** `https://modli.mekanizma.com` hazır!

### 4. Health Check Test

```bash
# API'nin çalıştığını kontrol edin
curl https://modli.mekanizma.com/health

# Beklenen çıktı:
# {"status":"healthy","timestamp":"2025-12-17T...","services":{...}}
```

---

## 📱 Mobile App Deployment (Expo EAS)

### 1. EAS CLI Kurulumu

```bash
# Global EAS CLI kurulumu
npm install -g eas-cli

# Expo hesabınızla giriş yapın
eas login
```

### 2. EAS Yapılandırması

```bash
cd frontend

# EAS build configuration oluştur
eas build:configure
```

Bu komut `eas.json` dosyası oluşturur. İçeriğini düzenleyin:

```json
{
  "cli": {
    "version": ">= 13.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://modli.mekanizma.com",
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-prod.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your_anon_key",
        "EXPO_PUBLIC_OPENWEATHER_API_KEY": "your_weather_key"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 3. App Store Connect Hazırlığı (iOS)

1. **Apple Developer Portal** → Certificates, Identifiers & Profiles
   - Bundle ID oluşturun: `com.modli.app`

2. **App Store Connect** → My Apps → `+` → New App
   - Name: Modli
   - Bundle ID: `com.modli.app`
   - SKU: `modli-app-001`
   - Primary Language: Turkish

3. **app.json güncelleme:**
   ```json
   "ios": {
     "bundleIdentifier": "com.modli.app",
     "buildNumber": "1",
     "supportsTablet": true
   }
   ```

### 4. Google Play Console Hazırlığı (Android)

1. **Play Console** → Create app
   - App name: Modli
   - Default language: Turkish
   - App or game: App
   - Free or paid: Free

2. **app.json güncelleme:**
   ```json
   "android": {
     "package": "com.modli.app",
     "versionCode": 1,
     "permissions": [
       "CAMERA",
       "READ_EXTERNAL_STORAGE",
       "WRITE_EXTERNAL_STORAGE",
       "INTERNET"
     ]
   }
   ```

### 5. Production Build

#### iOS Build

```bash
# iOS production build
eas build --platform ios --profile production

# Build tamamlandığında EAS size link verir
# Build süresi: ~15-20 dakika
```

#### Android Build

```bash
# Android production build (AAB format for Play Store)
eas build --platform android --profile production

# Build süresi: ~10-15 dakika
```

### 6. App Store'lara Submit

#### TestFlight (iOS)

```bash
# Otomatik submit
eas submit --platform ios --profile production

# Veya manuel:
# 1. EAS'dan IPA dosyasını indirin
# 2. Transporter app ile yükleyin
```

#### Google Play (Android)

```bash
# Otomatik submit
eas submit --platform android --profile production

# Veya manuel:
# 1. EAS'dan AAB dosyasını indirin
# 2. Play Console → Production → Create new release
# 3. AAB'yi yükleyin
```

### 7. Store Listings

Her iki store için de hazırlamanız gerekenler:

**App Screenshots:**
- iOS: 6.7", 6.5", 5.5" (iPhone)
- Android: Phone, Tablet

**App Description (Türkçe & İngilizce):**
```
Modli - Yapay Zeka Destekli Sanal Giyim Deneme

Gardırobunuzu dijitalleştirin, kıyafetlerinizi AI ile sanal olarak deneyin!

🎨 Özellikler:
• AI destekli gerçekçi sanal deneme
• Dijital gardırop yönetimi
• Çoklu kıyafet kombinasyonları
• Hava durumuna göre öneriler
• Türkçe ve İngilizce dil desteği

Modli ile gardırobunuzun tüm potansiyelini keşfedin!
```

**App Icon:** 1024x1024 PNG (transparent background yok)

**Privacy Policy URL:** https://modli.com/privacy

**Keywords:**
```
sanal deneme, AI, gardırop, moda, kıyafet, virtual try-on, wardrobe
```

---

## 🗄️ Database Setup

### MongoDB Atlas (Production)

1. **Cluster Oluşturma:**
   - https://cloud.mongodb.com → Create Cluster
   - Provider: AWS
   - Region: Frankfurt (EU-CENTRAL-1) - Türkiye'ye en yakın
   - Tier: M0 (Free) veya M10 ($0.08/saat)

2. **Network Access:**
   ```
   IP Access List:
   - Coolify sunucunuzun IP'sini ekleyin
   - Veya 0.0.0.0/0 (herkese açık - dikkatli kullanın)
   ```

3. **Database User:**
   ```
   Username: modli_admin
   Password: [güçlü şifre - kaydedin!]
   Database User Privileges: Atlas admin
   ```

4. **Connection String:**
   ```
   mongodb+srv://modli_admin:PASSWORD@cluster0.xxxxx.mongodb.net/modli_prod?retryWrites=true&w=majority
   ```

5. **Coolify'da Environment Variable güncelleme:**
   ```env
   MONGO_URL=mongodb+srv://modli_admin:PASSWORD@cluster0.xxxxx.mongodb.net/modli_prod
   ```

### Supabase (Production)

1. **Yeni Proje Oluşturma:**
   - https://supabase.com/dashboard
   - Organization: Yeni veya mevcut
   - Project name: `modli-production`
   - Database password: [güçlü şifre]
   - Region: Frankfurt (eu-central-1)

2. **Database Migration:**
   ```sql
   -- SQL Editor'da çalıştırın:
   
   -- Profiles table
   CREATE TABLE profiles (
     id UUID REFERENCES auth.users PRIMARY KEY,
     email TEXT,
     full_name TEXT,
     avatar_url TEXT,
     height NUMERIC,
     weight NUMERIC,
     gender TEXT,
     onboarding_completed BOOLEAN DEFAULT FALSE,
     subscription_tier TEXT DEFAULT 'free',
     subscription_status TEXT DEFAULT 'active',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Enable Row Level Security
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

   -- Policies
   CREATE POLICY "Users can view own profile" ON profiles
     FOR SELECT USING (auth.uid() = id);
   
   CREATE POLICY "Users can update own profile" ON profiles
     FOR UPDATE USING (auth.uid() = id);
   ```

   **Not:** `database/migrations/` klasöründeki tüm SQL dosyalarını çalıştırın.

3. **Authentication Settings:**
   - Dashboard → Authentication → Providers
   - Email: ✅ Enable
   - Email confirmations: ✅ Enable
   - Email templates → Confirm signup:
     ```
     Redirect URL: https://modli.com/auth/callback
     ```

4. **API Keys:**
   ```
   Project Settings → API

   Project URL: https://xxx-prod.supabase.co
   anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   service_role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (gizli tutun!)
   ```

5. **Environment Variables Güncelleme:**
   - **Backend (Coolify):**
     ```env
     SUPABASE_URL=https://xxx-prod.supabase.co
     SUPABASE_KEY=service_role_key
     ```
   - **Frontend (eas.json):**
     ```json
     "env": {
       "EXPO_PUBLIC_SUPABASE_URL": "https://xxx-prod.supabase.co",
       "EXPO_PUBLIC_SUPABASE_ANON_KEY": "anon_public_key"
     }
     ```

---

## 🌐 Domain & SSL

### Domain Yapılandırması

**Önerilen domain yapısı:**
```
mekanizma.com          → Landing page / Website
modli.mekanizma.com    → Backend API
www.mekanizma.com      → Website redirect
```

### DNS Records

```
Type    Name    Value               TTL
A       @       YOUR_SERVER_IP      300
A       api     YOUR_SERVER_IP      300
CNAME   www     modli.com           300
```

### SSL Sertifikaları

**Coolify (Backend):**
- Otomatik Let's Encrypt
- Coolify dashboard'dan "Enable HTTPS" seçeneği

**Frontend (Mobile App):**
- App Store & Play Store güvenli bağlantı gerektirir
- Backend'inizin HTTPS olması zorunlu

---

## ✅ Production Checklist

### Backend
- [ ] Coolify'da deploy edildi
- [ ] Environment variables yapılandırıldı
- [ ] MongoDB bağlantısı çalışıyor
- [ ] Supabase bağlantısı çalışıyor
- [ ] Domain bağlandı (modli.mekanizma.com)
- [ ] SSL sertifikası aktif
- [ ] Health check endpoint test edildi
- [ ] CORS production URL'leri ayarlandı

### Frontend
- [ ] `eas.json` yapılandırıldı
- [ ] Production environment variables ayarlandı
- [ ] Bundle ID/Package name belirlendi
- [ ] iOS build tamamlandı
- [ ] Android build tamamlandı
- [ ] App Store Connect'e yüklendi
- [ ] Google Play Console'a yüklendi
- [ ] Store listings tamamlandı (screenshots, descriptions)
- [ ] Privacy Policy & Terms sayfaları hazır

### Database
- [ ] MongoDB Atlas production cluster hazır
- [ ] Supabase production projesi oluşturuldu
- [ ] Database migrations çalıştırıldı
- [ ] Backup stratejisi belirlendi
- [ ] Row Level Security policies ayarlandı

### Security
- [ ] API keys production'a taşındı
- [ ] .env dosyaları gitignore'da
- [ ] HTTPS aktif (backend)
- [ ] Rate limiting yapılandırıldı (opsiyonel)
- [ ] CORS sadece production domain'leri

### Monitoring
- [ ] Coolify logs aktif
- [ ] Error tracking (Sentry vb.) kuruldu (opsiyonel)
- [ ] Uptime monitoring (UptimeRobot vb.) aktif (opsiyonel)

---

## 📊 Maliyet Tahmini

| Servis | Plan | Aylık |
|--------|------|-------|
| VPS (DigitalOcean) | 2GB RAM | $12 |
| MongoDB Atlas | M0 Free | $0 |
| Supabase | Free tier | $0 |
| Domain | .com | ~$1 |
| Apple Developer | Annual | ~$8/ay |
| Google Play | One-time | $25 (first time) |
| **TOPLAM** | | **~$21/ay** |

**Ölçeklenme:**
- MongoDB M10: +$57/ay (prod için önerilir)
- Supabase Pro: +$25/ay (100K+ users)
- Bigger VPS: +$20-50/ay

---

## 🔄 Güncelleme Süreci

### Backend Güncellemeleri

```bash
# Kod değişikliği yaptınız
git add .
git commit -m "Backend update: bug fixes"
git push origin main

# Coolify otomatik deploy eder (Git integration açıksa)
# Veya Coolify dashboard'dan manuel deploy
```

### Frontend Güncellemeleri

**Native kod değişikliği YOK:**
```bash
# OTA (Over-The-Air) Update - kullanıcılar app'i yeniden indirmez
eas update --branch production --message "Bug fixes and improvements"
```

**Native kod değişikliği VAR:**
```bash
# Yeni build gerekli
eas build --platform all --profile production
# App Store & Play Store'a yeniden submit
```

---

## 🆘 Sorun Giderme

### Backend çalışmıyor
```bash
# Coolify logs kontrolü
# Dashboard → Application → Logs

# Container'a bağlanma
docker exec -it modli-backend bash
python -c "import pymongo; print('MongoDB OK')"
```

### Mobile app backend'e bağlanamıyor
```bash
# Backend URL kontrolü
curl https://modli.mekanizma.com/health

# CORS kontrolü
# server.py'da allow_origins kontrol edin

# Environment variables
# eas.json'da EXPO_PUBLIC_BACKEND_URL doğru mu?
```

### Database bağlantı hatası
```bash
# MongoDB Atlas IP whitelist
# Coolify sunucu IP'si ekli mi?

# Connection string doğru mu?
# mongodb+srv:// formatında mı?
```

---

## 📞 Destek

- **Expo Docs:** https://docs.expo.dev/
- **Coolify Docs:** https://coolify.io/docs
- **MongoDB Atlas:** https://www.mongodb.com/docs/atlas/
- **Supabase:** https://supabase.com/docs

---

**🎉 Tebrikler!** Production'dasınız!

Made with ❤️ by Mekanizma Team
