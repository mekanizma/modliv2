# 🔧 MongoDB Bağlantı Sorunu Çözümü

## ❌ Şu Anki Sorun

```
mongodb:27017: [Errno -3] Temporary failure in name resolution
```

Backend çalışıyor ama MongoDB'ye bağlanamıyor.

---

## ✅ Çözüm 1: Docker Compose ile Deploy (ÖNERİLEN)

Coolify'da MongoDB ve Backend'i **birlikte** deploy edin.

### Adımlar:

#### 1. Coolify'da Mevcut Uygulamayı Sil (Varsa)
```
Applications → modli-backend → Settings → Delete Application
```

#### 2. Yeni Application Oluştur
```
+ New Resource → Application
```

#### 3. Git Source
```
Repository: https://github.com/mekanizma/modliv1.git
Branch: main
```

#### 4. Build Pack Seç
```
Build Pack: Docker Compose
Docker Compose File: docker-compose.yml
```

⚠️ **ÖNEMLİ:** "Docker Compose" seçin, "Dockerfile" DEĞİL!

#### 5. Environment Variables
```
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=SuperSecurePass123!
DB_NAME=modli_prod
FAL_KEY=a0a89116-c4cb-44e6-a338-73c631f770a8:6c791175bb517cccef78ba26fd767c9f
OPENWEATHER_API_KEY=8eb7f79142dbe8f173e1c81e85853fbc
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key
```

#### 6. Port Ayarları
Coolify genelde otomatik ayarlar, ama kontrol edin:
```
Backend Service Port: 8000
```

#### 7. Domain
```
Domain: modli.mekanizma.com
SSL: ✅ Enable (Let's Encrypt)
```

#### 8. Deploy
```
Deploy → Start
```

### Sonuç:
✅ MongoDB ve Backend aynı network'te çalışacak  
✅ Backend `mongodb:27017` adresine erişebilecek  
✅ Health check başarılı olacak

---

## ✅ Çözüm 2: Harici MongoDB (Hızlı Çözüm)

Docker Compose çalışmıyorsa, harici MongoDB kullanın.

### Seçenek A: MongoDB Atlas (ÜCRETSİZ)

#### 1. MongoDB Atlas'a Kaydol
```
https://www.mongodb.com/cloud/atlas/register
```

#### 2. Cluster Oluştur (Free Tier - M0)
```
Provider: AWS
Region: Frankfurt (eu-central-1) - Türkiye'ye yakın
Cluster Name: modli-cluster
```

#### 3. Database User Oluştur
```
Database Access → Add New User
Username: modli_user
Password: (güçlü şifre oluştur)
Role: Atlas Admin
```

#### 4. IP Whitelist
```
Network Access → Add IP Address
0.0.0.0/0 (Allow access from anywhere)
```

⚠️ **Güvenlik Notu:** Production'da Coolify server IP'sini ekleyin.

#### 5. Connection String Al
```
Clusters → Connect → Connect your application
Connection String: 
mongodb+srv://modli_user:<password>@modli-cluster.xxxxx.mongodb.net/modli_prod?retryWrites=true&w=majority
```

#### 6. Coolify'da Environment Variable Güncelle
```
MONGO_URL=mongodb+srv://modli_user:your_password@modli-cluster.xxxxx.mongodb.net/modli_prod?retryWrites=true&w=majority
DB_NAME=modli_prod
```

#### 7. Backend'i Redeploy Et
```
Application → Redeploy
```

### Sonuç:
✅ MongoDB Atlas bulutta çalışıyor  
✅ Backend harici MongoDB'ye bağlanıyor  
✅ Health check başarılı

---

## 🧪 Test Etme

### Health Check Test
```bash
curl https://modli.mekanizma.com/health
```

**Beklenen Sonuç:**
```json
{
  "status": "healthy",
  "service": "modli-backend",
  "database": "connected",
  "timestamp": "2025-12-18T..."
}
```

### API Test
```bash
curl https://modli.mekanizma.com/api/
```

**Beklenen Sonuç:**
```json
{
  "message": "Modli API - Virtual Try-On Service"
}
```

### API Health Test
```bash
curl https://modli.mekanizma.com/api/health
```

**Beklenen Sonuç:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-18T..."
}
```

---

## 🔍 Coolify Logs Kontrol

### Container Loglarını İzle
```
Application → Logs → Select Service (backend)
```

**Sağlıklı Log Örneği:**
```
INFO:     Started server process [1]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     127.0.0.1:46994 - "GET /health HTTP/1.1" 200 OK
```

**Sorunlu Log Örneği:**
```
ERROR - Health check failed: mongodb:27017: [Errno -3] Temporary failure...
INFO:     127.0.0.1:46994 - "GET /health HTTP/1.1" 503 Service Unavailable
```

---

## 📊 Hangisini Seçmeliyim?

| Özellik | Docker Compose | MongoDB Atlas |
|---------|----------------|---------------|
| **Kurulum** | Orta | Kolay |
| **Maliyet** | Sunucu maliyeti | Ücretsiz (512MB) |
| **Performans** | Yüksek (local) | Orta (network) |
| **Yönetim** | Manuel | Otomatik |
| **Backup** | Manuel | Otomatik |
| **Ölçeklenebilirlik** | Sınırlı | Yüksek |
| **Güvenlik** | Sizin kontrolünüzde | Atlas yönetiyor |

### Önerim:
- **Geliştirme & Test:** Docker Compose (hızlı ve local)
- **Production:** MongoDB Atlas (yönetilmiş, güvenli, backup)

---

## 🚀 Hızlı Başlangıç (Atlas ile)

Şu an için en hızlı çözüm:

```bash
1. MongoDB Atlas'a kaydol (5 dakika)
2. Cluster oluştur (2 dakika)
3. Connection string al (1 dakika)
4. Coolify'da MONGO_URL güncelle (1 dakika)
5. Redeploy (2 dakika)

Toplam: ~10 dakika
```

---

## 💡 Önemli Notlar

### Docker Compose ile İlgili
- Coolify'ın Docker Compose desteği bazen sorunlu olabilir
- Eğer çalışmazsa, MongoDB'yi ayrı bir "Database" service olarak ekleyin
- Coolify versiyonunuza bağlı olarak davranış değişebilir

### MongoDB Atlas ile İlgili
- Free tier 512MB storage (başlangıç için yeterli)
- Automatic backups (daily)
- Connection string içinde şifre var, güvenli tutun
- Network latency Türkiye → Frankfurt ~30-50ms (kabul edilebilir)

### Güvenlik
- MongoDB şifrelerini güçlü yapın
- Production'da IP whitelist kullanın
- Environment variables'ı güvenli saklayın
- HTTPS kullanın (Coolify otomatik sağlıyor)

---

## 🆘 Sorun mu Yaşıyorsunuz?

### "Docker Compose çalışmıyor"
→ MongoDB Atlas kullanın (Çözüm 2)

### "Atlas bağlantısı çok yavaş"
→ Coolify server'ınızı Europe region'a taşıyın

### "Free tier yetmiyor"
→ Upgrade yapın veya kendi MongoDB instance'ınızı kurun

---

## ✅ Son Kontrol Listesi

Deployment başarılı olduysa:
- [ ] `curl https://modli.mekanizma.com/health` → `200 OK`
- [ ] Response'da `"database": "connected"` var
- [ ] Logs'da `503 Service Unavailable` yok
- [ ] Logs'da MongoDB connection error yok
- [ ] Mobil uygulamadan API erişimi çalışıyor

**Hepsi ✅ ise tebrikler, deployment başarılı!** 🎉








