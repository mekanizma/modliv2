# 🚀 Modli Coolify Deployment Guide

Bu rehber, Modli uygulamasını Coolify ile **MongoDB + Backend birlikte** deploy etmek için adım adım talimatlar içerir.

## 📋 Backend URL
**Production:** `https://modli.mekanizma.com`

---

## 🎯 Ön Hazırlık

### Gerekli Bilgiler

- [x] **GitHub Repo:** https://github.com/mekanizma/modliv1
- [x] **Backend URL:** https://modli.mekanizma.com
- [x] **Docker Compose:** ✅ Hazır (MongoDB + Backend birlikte)
- [ ] **Sunucu IP Adresi:** _______________________
- [ ] **Domain DNS Ayarları:** Yapıldı ✅
- [ ] **API Keys:** Hazır ✅

### DNS Yapılandırması

Domain'inizin DNS ayarlarında aşağıdaki kaydı ekleyin:

```
Type: A Record
Name: modli.mekanizma.com (veya @ for root)
Value: SUNUCU_IP_ADRESI
TTL: 300
```

---

## 🐳 Coolify'da Deployment (Docker Compose)

### ⭐ Önerilen: Docker Compose ile Tek Seferde Deploy

MongoDB ve Backend'i **birlikte** deploy ediyoruz. `docker-compose.yml` dosyası zaten hazır!

### 1️⃣ Docker Compose Deployment

#### Docker Compose Deployment (MongoDB + Backend Birlikte)

1. **Coolify Dashboard** → `+ New Resource` → `Application`

2. **Git Source:**
```
Repository: https://github.com/mekanizma/modliv1.git
Branch: main
Base Directory: / (root)
Build Pack: Docker Compose
Docker Compose Location: docker-compose.yml (root'ta)
```

3. **Application Settings:**
```
Application Name: modli-app
Type: Docker Compose
```

4. **Environment Variables** (`.env` dosyası için):

```env
# MongoDB Credentials
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=your_secure_password_123
DB_NAME=modli_prod

# API Keys
FAL_KEY=a0a89116-c4cb-44e6-a338-73c631f770a8:6c791175bb517cccef78ba26fd767c9f
OPENWEATHER_API_KEY=8eb7f79142dbe8f173e1c81e85853fbc

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key

# CORS Configuration
ALLOWED_ORIGINS=https://modli.mekanizma.com,http://localhost:8081,http://localhost:19006
```

5. **Services** (Otomatik tanınır):
```yaml
✅ mongodb    (port 27017 - internal)
✅ backend    (port 8000 - exposed)
```

6. **Network:**
```
Network: modli-network (otomatik oluşturulur)
Dependencies: Backend depends on MongoDB (otomatik)
```

7. **Volumes** (Persistent Storage):
```
✅ mongo-data     → /data/db
✅ mongo-config   → /data/configdb
```

8. **Deploy** butonuna basın!

**🎉 Tek tıkla hem MongoDB hem Backend deploy edilir!**

#### Deployment Süreci

```bash
# Coolify otomatik olarak:
1. ✅ Docker Compose dosyasını okur
2. ✅ MongoDB container'ı başlatır
3. ✅ MongoDB health check bekler
4. ✅ Backend container'ı build eder
5. ✅ Backend'i başlatır (MongoDB'ye bağlanır)
6. ✅ Network oluşturur (modli-network)
7. ✅ Volumes mount eder (persistent data)
```

#### Test

```bash
# Backend health check
curl https://modli.mekanizma.com/health

# MongoDB test (Coolify terminal)
docker exec -it modli-app-mongodb-1 mongosh -u admin -p your_secure_password_123

# Logs
docker-compose logs -f
```

---

### 2️⃣ Domain & SSL Configuration

#### Domain Setup

1. **Application Settings** → **Domains**
2. **Add Domain:**

```
Domain: modli.mekanizma.com
Path: / (root)
Strip Prefix: ❌
```

3. **Enable HTTPS:**
```
SSL/TLS: ✅ Enable
Certificate: Let's Encrypt (Auto)
Force HTTPS: ✅ Enable
```

4. **Save** ve 5-10 dakika bekleyin (SSL sertifikası için)

#### Test

```bash
# Health check test
curl https://modli.mekanizma.com/health

# Beklenen çıktı:
{
  "status": "healthy",
  "timestamp": "2025-12-17T...",
  "services": {
    "mongodb": "connected",
    "fal_api": "configured"
  }
}
```

---

## 📱 Frontend Configuration

### EAS Build için Environment Variables

**`frontend/eas.json`** zaten güncellenmiş durumda:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://modli.mekanizma.com",
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your_anon_key",
        "EXPO_PUBLIC_OPENWEATHER_API_KEY": "your_weather_key"
      }
    }
  }
}
```

### Production Build

```bash
cd frontend

# iOS production build
eas build --platform ios --profile production

# Android production build
eas build --platform android --profile production
```

---

---

## 🔄 Local Test (Docker Compose)

Deploy etmeden önce local'de test edebilirsiniz:

### Local Test Adımları

```bash
# 1. Repo'yu klonlayın
git clone https://github.com/mekanizma/modliv1.git
cd modliv1

# 2. .env dosyası oluşturun
cp .env.example .env
```

**`.env` içeriği:**
```env
# MongoDB Credentials
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=test123
DB_NAME=modli_dev

# API Keys
FAL_KEY=your_fal_key
OPENWEATHER_API_KEY=your_weather_key

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_service_key
```

```bash
# 3. Docker Compose ile başlat (MongoDB + Backend birlikte)
docker-compose up -d

# 4. Logs kontrol et
docker-compose logs -f

# 5. Test et
curl http://localhost:8000/health

# Beklenen çıktı:
# {
#   "status": "healthy",
#   "services": {
#     "mongodb": "connected",
#     "fal_api": "configured"
#   }
# }

# 6. Durdur
docker-compose down

# Volumes ile birlikte temizle (dikkat: data silinir!)
docker-compose down -v
```

### docker-compose.yml Yapısı

Dosya zaten hazır ve şunları içeriyor:

```yaml
services:
  mongodb:
    image: mongo:7
    ports: ["27017:27017"]
    volumes:
      - mongo-data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_ROOT_USER}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASS}
    healthcheck: ✅
    
  backend:
    build: ./backend
    ports: ["8000:8000"]
    depends_on:
      mongodb:
        condition: service_healthy  # ✅ MongoDB hazır olana kadar bekler
    environment:
      - MONGO_URL=mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASS}@mongodb:27017
      - DB_NAME=${DB_NAME}
      # ... diğer env vars
    healthcheck: ✅

volumes:
  mongo-data:
  mongo-config:

networks:
  modli-network:
```

**✅ MongoDB + Backend birlikte, otomatik dependency yönetimi!**

---

## 🔍 Monitoring & Debugging

### Coolify Logs

1. **Application** → **Logs** sekmesi
2. Real-time log akışını izleyin
3. Filtreler: Error, Warning, Info

### Container'a Bağlanma

```bash
# Backend container
docker exec -it modli-backend bash

# MongoDB container
docker exec -it modli-mongodb mongosh -u admin -p your_password

# Python ortamını test et
python -c "import pymongo; print('MongoDB library OK')"
python -c "import motor; print('Motor library OK')"
```

### Common Issues

#### 1. MongoDB Bağlantı Hatası

```
Error: MongoServerError: Authentication failed
```

**Çözüm:**
- MongoDB service'inin running olduğunu kontrol edin
- MONGO_URL'deki username/password'ü kontrol edin
- Network ayarlarını kontrol edin (aynı network'te olmalı)

```bash
# MongoDB status
docker ps | grep modli-mongodb

# Network kontrol
docker network ls
docker network inspect modli-network
```

#### 2. Backend Health Check Failed

```
Health check failed: connection refused
```

**Çözüm:**
- Backend container'ın başladığını kontrol edin
- MongoDB'nin hazır olduğunu bekleyin (depends_on)
- Environment variables'ı kontrol edin

```bash
# Backend logs
docker logs modli-backend -f

# Health check manuel test
docker exec -it modli-backend curl http://localhost:8000/health
```

#### 3. CORS Error

```
Access-Control-Allow-Origin error
```

**Çözüm:**
- ALLOWED_ORIGINS environment variable'ını kontrol edin
- Frontend URL'sinin ALLOWED_ORIGINS'te olduğundan emin olun

```env
ALLOWED_ORIGINS=https://modli.mekanizma.com,http://localhost:8081
```

#### 4. SSL Certificate Issues

**Çözüm:**
- DNS propagation'ı bekleyin (1-24 saat)
- Domain'in sunucu IP'sine işaret ettiğini kontrol edin
- Coolify'da "Regenerate Certificate" deneyin

```bash
# DNS kontrol
nslookup modli.mekanizma.com
dig modli.mekanizma.com
```

---

## 📊 Resource Usage

### Minimum Requirements

| Service | CPU | RAM | Disk |
|---------|-----|-----|------|
| MongoDB | 0.5 CPU | 512MB | 5GB |
| Backend | 0.5 CPU | 512MB | 1GB |
| **TOTAL** | **1 CPU** | **1GB** | **6GB** |

### Recommended for Production

| Service | CPU | RAM | Disk |
|---------|-----|-----|------|
| MongoDB | 1 CPU | 1GB | 20GB |
| Backend | 1 CPU | 1GB | 5GB |
| **TOTAL** | **2 CPU** | **2GB** | **25GB** |

---

## 🔄 Update & Maintenance

### Backend Code Update

```bash
# Git'e push edin
git add .
git commit -m "Update: bug fixes"
git push origin main

# Coolify otomatik deploy eder (Git integration aktifse)
# Veya manuel:
# Coolify Dashboard → Application → Deploy → Redeploy
```

### MongoDB Backup

```bash
# Backup oluştur
docker exec modli-mongodb mongodump \
  --username admin \
  --password your_password \
  --authenticationDatabase admin \
  --db modli_prod \
  --out /data/backup/$(date +%Y%m%d)

# Backup'ı local'e çek
docker cp modli-mongodb:/data/backup ./backup

# Restore
docker exec modli-mongodb mongorestore \
  --username admin \
  --password your_password \
  --authenticationDatabase admin \
  --db modli_prod \
  /data/backup/20251217/modli_prod
```

### MongoDB Upgrade

```bash
# Backup al
docker exec modli-mongodb mongodump --out /backup

# MongoDB version değiştir
# Coolify: Service → Configuration → Version → 8

# Redeploy
```

---

## ✅ Production Checklist

### Pre-Deployment
- [ ] GitHub repo güncel
- [ ] DNS ayarları yapıldı (A record)
- [ ] API keys hazır
- [ ] Supabase production projesi hazır
- [ ] .env.example değerleri dolduruldu
- [ ] docker-compose.yml kontrol edildi

### Docker Compose Deployment
- [ ] Coolify'da Docker Compose application oluşturuldu
- [ ] GitHub repo bağlandı
- [ ] Environment variables eklendi (.env)
- [ ] MongoDB + Backend birlikte deploy edildi
- [ ] MongoDB health check çalışıyor
- [ ] Backend health check çalışıyor
- [ ] Network oluşturuldu (modli-network)
- [ ] Persistent volumes mount edildi

### Domain & SSL
- [ ] Domain bağlandı (modli.mekanizma.com)
- [ ] SSL sertifikası aktif (Let's Encrypt)
- [ ] HTTPS forced
- [ ] CORS ayarları doğru

### Frontend Setup
- [ ] eas.json yapılandırıldı
- [ ] Production build tamamlandı
- [ ] Backend URL doğru (https://modli.mekanizma.com)
- [ ] Test build çalışıyor

### Security
- [ ] MongoDB strong password
- [ ] API keys güvenli
- [ ] CORS sadece allowed origins
- [ ] HTTPS forced
- [ ] Environment secrets Coolify'da

---

## 📞 Support

**Coolify Documentation:** https://coolify.io/docs

**Common Commands:**
```bash
# Container status
docker ps

# Logs
docker logs modli-backend -f
docker logs modli-mongodb -f

# Resource usage
docker stats

# Network
docker network inspect modli-network

# Remove and recreate (careful!)
docker-compose down -v
docker-compose up -d
```

---

## 🎉 Deployment Complete!

Backend URL: **https://modli.mekanizma.com**

Test endpoints:
- Health: `https://modli.mekanizma.com/health`
- API docs: `https://modli.mekanizma.com/docs`

**🚀 Artık production'dasınız!**

Made with ❤️ by Mekanizma Team

