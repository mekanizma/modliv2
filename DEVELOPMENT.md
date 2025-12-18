# 🛠️ Modli Development Guide

Bu rehber, Modli uygulamasını local'de geliştirirken kullanacağınız ayarları içerir.

## 🚀 Quick Start

### 1️⃣ Repository'yi Clone Edin

```bash
git clone https://github.com/mekanizma/modliv1.git
cd modliv1
```

### 2️⃣ Frontend Setup

```bash
cd frontend

# Dependencies yükle
npm install

# .env dosyası oluştur
cp .env.example .env
```

**`.env` içeriği:**
```env
# Backend API (Production backend kullanıyoruz - local backend'e gerek yok!)
EXPO_PUBLIC_BACKEND_URL=https://modli.mekanizma.com

# Supabase (Supabase dashboard'dan alın)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenWeatherMap
EXPO_PUBLIC_OPENWEATHER_API_KEY=8eb7f79142dbe8f173e1c81e85853fbc
```

### 3️⃣ Frontend'i Başlatın

```bash
npm start
```

Expo DevTools açılacak:
- **Android:** Expo Go app'i açın ve QR kodu tarayın
- **iOS:** Expo Go app'i açın ve QR kodu tarayın
- **Web:** `w` tuşuna basın

---

## 📱 Development Workflow

### Development Backend

**✅ Önerilen: Production Backend Kullanın**

Development sırasında production backend'i kullanmanız önerilir:
```env
EXPO_PUBLIC_BACKEND_URL=https://modli.mekanizma.com
```

**Avantajları:**
- ✅ Local backend çalıştırmaya gerek yok
- ✅ Database production'da (güncel data)
- ✅ API'ler production'da (fal.ai, weather)
- ✅ Sadece frontend geliştirmeye odaklanabilirsiniz

**Dezavantajları:**
- ⚠️ Backend değişikliklerini test edemezsiniz
- ⚠️ Production data ile çalışırsınız (dikkatli olun!)

### Local Backend (İsteğe Bağlı)

Eğer backend değişiklikleri yapıyorsanız:

```bash
cd backend

# Virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Dependencies
pip install -r requirements.txt

# .env dosyası oluştur
cp .env.example .env
# API keys'leri doldur

# Backend'i başlat
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

**Frontend `.env`'yi güncelle:**
```env
# Local network IP'nizi kullanın (localhost değil!)
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:8000
```

**IP adresinizi öğrenmek için:**
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
```

---

## 🔄 Hot Reload

### Frontend Hot Reload

Expo otomatik hot reload destekler:
- ✅ Dosya kaydedince otomatik yenilenir
- ✅ Component state korunur (çoğu zaman)
- ✅ Fast Refresh aktif

**Manuel reload:**
- **r** - Reload app
- **m** - Toggle menu
- **d** - Open DevTools

### Backend Hot Reload (Local)

```bash
# --reload flag ile başlatın
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

---

## 🧪 Testing

### Frontend Test

```bash
cd frontend

# Type check
npx tsc --noEmit

# Linting
npm run lint
```

### Backend Test (Local)

```bash
cd backend

# Pytest
pytest

# Type check
mypy server.py
```

---

## 🐛 Debugging

### React Native Debugger

1. Chrome DevTools açın: `http://localhost:8081/debugger-ui`
2. Expo app'te "Debug Remote JS" seçin

### Network Debugging

```bash
# Backend logs (production)
# Coolify dashboard → Logs

# Backend logs (local)
# Terminal'de otomatik görünür
```

### Console Logs

```typescript
// Frontend
console.log('🔍 Debug:', data);
console.error('❌ Error:', error);
console.warn('⚠️ Warning:', message);
```

```python
# Backend
import logging
logger = logging.getLogger(__name__)
logger.info(f"📥 Request: {data}")
logger.error(f"❌ Error: {error}")
```

---

## 📂 Project Structure

```
modli-main/
├── backend/
│   ├── server.py              # FastAPI backend
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Environment variables (gitignored)
│   └── Dockerfile             # Docker configuration
├── frontend/
│   ├── app/                   # Expo Router pages
│   │   ├── (auth)/            # Login, signup
│   │   ├── (tabs)/            # Main tabs (home, wardrobe, gallery, profile)
│   │   ├── profile-setup.tsx  # Onboarding
│   │   ├── add-item.tsx       # Add clothing
│   │   └── try-on.tsx         # Virtual try-on
│   ├── src/
│   │   ├── contexts/          # React contexts (Auth, Language)
│   │   ├── i18n/              # Translations (TR, EN)
│   │   ├── lib/               # Supabase client, storage helper
│   │   └── types/             # TypeScript types
│   ├── assets/                # Images, icons
│   ├── .env                   # Environment variables (gitignored)
│   ├── app.json               # Expo configuration
│   └── package.json           # Dependencies
├── database/
│   └── migrations/            # SQL migrations
├── DEVELOPMENT.md             # This file
├── README.md                  # Project overview
└── PERFORMANCE_IMPROVEMENTS.md # Performance docs
```

---

## 🔧 Common Tasks

### Yeni Package Eklemek

**Frontend:**
```bash
cd frontend
npm install package-name
```

**Backend:**
```bash
cd backend
pip install package-name
echo "package-name==version" >> requirements.txt
```

### Environment Variables Eklemek

**Frontend:**
```bash
# .env dosyasına ekleyin
EXPO_PUBLIC_NEW_VAR=value

# Restart gerekli
npm start
```

**Backend:**
```bash
# .env dosyasına ekleyin
NEW_VAR=value

# Restart gerekli (local)
# Veya Coolify'da redeploy (production)
```

### Database Değişikliği

```sql
-- database/migrations/new_migration.sql
-- SQL kodunuzu yazın

-- Supabase Dashboard'da çalıştırın
-- SQL Editor → Run
```

### API Endpoint Eklemek

**Backend:**
```python
# backend/server.py
@api_router.post("/new-endpoint")
async def new_endpoint(request: NewRequest):
    # Logic here
    return {"success": True}
```

**Frontend:**
```typescript
// Frontend'de kullanın
const response = await axios.post(
  `${EXPO_PUBLIC_BACKEND_URL}/api/new-endpoint`,
  data
);
```

---

## 🚨 Troubleshooting

### "Cannot connect to backend"

**Çözüm 1:** Production backend kullanın
```env
EXPO_PUBLIC_BACKEND_URL=https://modli.mekanizma.com
```

**Çözüm 2:** Local backend IP'yi kontrol edin
```bash
# Windows
ipconfig

# .env'de kullanın
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:8000
```

### "Supabase error"

**Çözüm:** Supabase keys'leri kontrol edin
```bash
# Supabase Dashboard → Settings → API
# URL ve anon key'i kopyalayın
```

### "Module not found"

**Çözüm:**
```bash
# Frontend
cd frontend
rm -rf node_modules
npm install

# Backend
cd backend
pip install -r requirements.txt
```

### "Metro bundler error"

**Çözüm:**
```bash
# Cache'i temizle
cd frontend
npx expo start -c
```

---

## 📝 Code Style

### TypeScript (Frontend)

```typescript
// PascalCase for components
export default function HomeScreen() {}

// camelCase for functions
const fetchData = async () => {}

// Type everything
interface User {
  id: string;
  name: string;
}

// Use const for non-changing values
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
```

### Python (Backend)

```python
# snake_case for functions
def fetch_user_data():
    pass

# PascalCase for classes
class UserProfile(BaseModel):
    id: str
    name: str

# Type hints
def process_image(data: bytes) -> str:
    return "result"
```

---

## 🔗 Useful Links

### Development
- **Expo Docs:** https://docs.expo.dev/
- **React Native Docs:** https://reactnative.dev/
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **Supabase Docs:** https://supabase.com/docs

### Tools
- **Expo Go:** https://expo.dev/client
- **React DevTools:** https://react-devtools-experimental.vercel.app/
- **Postman:** https://www.postman.com/ (API testing)

### Project
- **GitHub:** https://github.com/mekanizma/modliv1
- **Backend:** https://modli.mekanizma.com
- **Docs:** README.md, PERFORMANCE_IMPROVEMENTS.md

---

## ⚡ Quick Commands

```bash
# Frontend start
cd frontend && npm start

# Frontend with cache clear
cd frontend && npx expo start -c

# Backend start (local)
cd backend && uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Install dependencies
cd frontend && npm install
cd backend && pip install -r requirements.txt

# Git workflow
git add .
git commit -m "Your message"
git push origin main
```

---

## 🎯 Development Tips

1. **Her zaman production backend kullanın** (local backend'e gerek yok)
2. **Type safety:** TypeScript strict mode kullanın
3. **Error handling:** Her async işlemde try-catch kullanın
4. **Console logs:** Emoji kullanın (`🔍`, `❌`, `✅`) - kolayca bulunur
5. **Git commits:** Açıklayıcı mesajlar yazın
6. **Testing:** Değişikliklerinizi test edin (iOS & Android)
7. **Performance:** Büyük listeler için FlatList kullanın
8. **Images:** Thumbnail kullanın, base64'ten kaçının

---

## 🆘 Yardım

**Sorun mu yaşıyorsunuz?**

1. Dokümantasyonu okuyun (README.md, PERFORMANCE_IMPROVEMENTS.md)
2. Console logs kontrol edin
3. Network requests kontrol edin (DevTools)
4. GitHub issues açın

---

Happy coding! 🚀

Made with ❤️ by Mekanizma Team
