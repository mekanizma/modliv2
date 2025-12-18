# 👗 Modli - AI-Powered Virtual Try-On

[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-blue)](https://github.com/mekanizma/modliv1)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-green)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/Frontend-React%20Native-blue)](https://reactnative.dev/)
[![AI](https://img.shields.io/badge/AI-fal.ai-purple)](https://fal.ai/)

**Modli**, AI destekli sanal giyim deneme uygulamasıdır. Kullanıcılar gardıroplarındaki kıyafetiçlerini dijital ortamda deneyebilir, farklı kombinasyonlar yaratabilir ve kıyafetlerini yönetebilirler.

## ✨ Özellikler

### 🎨 Sanal Deneme
- **AI-Powered Try-On**: fal.ai teknolojisi ile gerçekçi sanal deneme
- **Çoklu Katmanlama**: Birden fazla kıyafeti üst üste deneme
- **Yüksek Kalite**: Yüz ve vücut özelliklerini koruyarak doğal sonuçlar

### 👔 Dijital Gardırop
- Kıyafetlerinizi fotoğraflayıp dijital gardırobunuza ekleyin
- Kategori, renk, mevsim bazında düzenleme
- Hızlı arama ve filtreleme

### 📸 Galeri & Koleksiyonlar
- Denediğiniz kombinasyonları kaydedin
- Favori görünümlerinizi paylaşın
- Geçmiş denemelerinize hızlı erişim

### 🌐 Çoklu Dil Desteği
- Türkçe 🇹🇷
- English 🇬🇧

### ☁️ Hava Durumu Entegrasyonu
- Günlük hava durumuna göre kıyafet önerileri
- Lokasyon bazlı öneriler

## 🏗️ Teknoloji Stack'i

### Frontend (Mobile App)
- **Framework**: React Native + Expo
- **Navigation**: Expo Router
- **State Management**: React Context API
- **UI Components**: React Native + Ionicons
- **Authentication**: Supabase Auth
- **Storage**: AsyncStorage (caching)
- **Image Processing**: Expo Image Picker

### Backend (API)
- **Framework**: FastAPI (Python)
- **Server**: Uvicorn
- **Database**: 
  - MongoDB (wardrobe items, try-on results)
  - Supabase (user auth, profiles)
- **AI APIs**:
  - fal.ai (virtual try-on)
  - OpenWeatherMap (weather data)
- **CORS**: Starlette Middleware

### DevOps & Deployment
- **Version Control**: Git + GitHub
- **Container**: Docker
- **Deployment**: Coolify (recommended) / Portainer
- **CI/CD**: GitHub Actions (planned)
- **Mobile Build**: Expo EAS

## 📁 Proje Yapısı

```
modli-main/
├── backend/
│   ├── server.py              # FastAPI backend
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Environment variables (gitignored)
│   └── Dockerfile             # Docker configuration
├── frontend/
│   ├── app/                   # Expo Router pages
│   │   ├── (auth)/            # Authentication screens
│   │   ├── (tabs)/            # Main app tabs
│   │   ├── profile-setup.tsx  # Onboarding
│   │   ├── add-item.tsx       # Add clothing
│   │   └── try-on.tsx         # Virtual try-on
│   ├── src/
│   │   ├── contexts/          # React contexts (Auth, Language)
│   │   ├── i18n/              # Translations
│   │   ├── lib/               # Supabase client
│   │   └── types/             # TypeScript types
│   ├── assets/                # Images, icons
│   ├── app.json               # Expo configuration
│   ├── package.json           # Dependencies
│   └── .env                   # Environment variables (gitignored)
├── database/
│   └── migrations/            # Database migrations
├── .gitignore
├── PERFORMANCE_OPTIMIZATIONS.md
├── SUPABASE_CONFIGURATION.md
└── README.md
```

## 🚀 Kurulum

### Gereksinimler

- **Node.js** 18+ ve npm
- **Python** 3.11+
- **Expo CLI**: `npm install -g expo-cli`
- **MongoDB** (local veya Atlas)
- **Supabase Account** (ücretsiz tier yeterli)

### 1️⃣ Backend (Production Kullanıyoruz)

**Not:** Development için local backend çalıştırmanıza gerek yok! Production backend'i kullanıyoruz.

```bash
# Backend Production URL
https://modli.mekanizma.com
```

Eğer local backend çalıştırmak isterseniz:

```bash
# Backend klasörüne gidin
cd backend

# Python virtual environment oluşturun
python -m venv venv

# Virtual environment'ı aktifleştirin
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Dependencies'leri yükleyin
pip install -r requirements.txt

# .env dosyası oluşturun
cp .env.example .env
# .env dosyasını API keys ile doldurun

# Backend'i çalıştırın
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### 2️⃣ Frontend Kurulumu

```bash
# Frontend klasörüne gidin
cd frontend

# Dependencies'leri yükleyin
npm install

# .env dosyası oluşturun
cp .env.example .env
# .env dosyasını backend URL ve API keys ile doldurun

# Expo development server'ı başlatın
npm start
```

**Expo DevTools:** http://localhost:8081

**Uygulamayı test etmek için:**
- iOS: Expo Go app (App Store)
- Android: Expo Go app (Play Store)
- QR kodu tarayın ve uygulamayı açın

### 3️⃣ Environment Variables

#### Backend `.env`
```env
# MongoDB
MONGO_URL=mongodb://localhost:27017
DB_NAME=modli_dev

# AI APIs
FAL_KEY=your_fal_api_key
OPENWEATHER_API_KEY=your_openweather_key

# Supabase (optional for backend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_key
```

#### Frontend `.env`
```env
# Backend API (using production backend for development)
EXPO_PUBLIC_BACKEND_URL=https://modli.mekanizma.com

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenWeatherMap
EXPO_PUBLIC_OPENWEATHER_API_KEY=your_openweather_key
```

**Not:** Development sırasında production backend'i kullanıyoruz. Local backend kullanmak isterseniz:
```env
EXPO_PUBLIC_BACKEND_URL=http://YOUR_LOCAL_IP:8000
```

### 4️⃣ Database Setup

#### Supabase
1. https://supabase.com adresinden proje oluşturun
2. SQL Editor'da tabloları oluşturun:
   - `profiles` (user profiles)
   - `wardrobe_items` (clothing items)
   - `try_on_results` (saved results)
3. Authentication'ı etkinleştirin
4. `database/migrations/` klasöründeki SQL'leri çalıştırın

#### MongoDB
```bash
# Local MongoDB (Docker ile)
docker run -d -p 27017:27017 --name modli-mongodb mongo:7

# Veya MongoDB Atlas kullanın (ücretsiz)
# https://www.mongodb.com/cloud/atlas/register
```

## 📱 Production Deployment

Detaylı deployment rehberi için ayrı dokümantasyon hazırlanmıştır:

### Backend Deployment (Coolify)
1. VPS hazırlayın (2GB RAM, 2 CPU minimum)
2. Coolify kurun
3. GitHub repo'yu bağlayın
4. Environment variables'ı ekleyin
5. Deploy edin
6. Domain ve SSL yapılandırın

### Mobile App (Expo EAS)
```bash
# EAS CLI kurulumu
npm install -g eas-cli
eas login

# Build configuration
eas build:configure

# Production build
eas build --platform android --profile production
eas build --platform ios --profile production

# App Store & Play Store submit
eas submit --platform android
eas submit --platform ios
```

## 🛠️ Development

### Backend API Endpoints

```
GET  /health                    # Health check
POST /api/try-on                # Virtual try-on
GET  /api/weather/{location}    # Weather data
POST /api/wardrobe/add          # Add clothing item
GET  /api/wardrobe/list         # List items
```

### Testing

```bash
# Backend tests
cd backend
pytest

# Frontend type checking
cd frontend
npx tsc --noEmit
```

## 📊 Performance Optimizations

- ✅ **Image Compression**: 0.5-0.6 quality, EXIF stripped
- ✅ **Gallery Caching**: AsyncStorage ile client-side caching
- ✅ **Pagination**: FlatList + lazy loading
- ✅ **API Optimization**: fal.ai inference steps: 30 (speed vs quality)
- ✅ **Navigation**: Optimized data transfer via AsyncStorage

Detaylar: [PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md)

## 🔐 Güvenlik

- **API Keys**: `.env` dosyalarında, gitignore'da
- **Authentication**: Supabase Auth (JWT tokens)
- **Password**: Bcrypt hashing
- **CORS**: Sadece izin verilen origin'ler
- **Rate Limiting**: API endpoint'lerinde (production)

## 📝 Lisans

Bu proje özel bir projedir. Ticari kullanım yasaktır.

## 👥 Ekip

- **Developer**: Mekanizma Team
- **AI Integration**: fal.ai
- **Backend**: FastAPI + Python
- **Frontend**: React Native + Expo

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Push edin (`git push origin feature/AmazingFeature`)
5. Pull Request açın

## 📞 İletişim

- **GitHub**: [@mekanizma](https://github.com/mekanizma)
- **Email**: info@modli.com
- **Website**: https://modli.com

## 🙏 Teşekkürler

- [Expo](https://expo.dev/) - React Native framework
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [Supabase](https://supabase.com/) - Backend as a Service
- [fal.ai](https://fal.ai/) - AI virtual try-on
- [MongoDB](https://www.mongodb.com/) - Database
- [Coolify](https://coolify.io/) - Self-hosted PaaS

---

**⭐ Beğendiyseniz yıldız vermeyi unutmayın!**

Made with ❤️ in Turkey 🇹🇷
