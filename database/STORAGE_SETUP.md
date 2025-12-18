# 📦 Supabase Storage Setup Guide

Bu rehber, Modli uygulaması için Supabase Storage bucket'larının nasıl oluşturulacağını açıklar.

## 🎯 Gerekli Bucket'lar

Modli uygulaması için 3 bucket gereklidir:

1. **`wardrobe`** - Gardırop kıyafet resimleri
2. **`profiles`** - Kullanıcı profil fotoğrafları  
3. **`try-on-results`** - Sanal deneme sonuç görselleri

---

## 🚀 Bucket Oluşturma Adımları

### 1. Supabase Dashboard'a Giriş

1. https://supabase.com/dashboard adresine gidin
2. Production projenizi seçin (`modli-production`)
3. Sol menüden **Storage** → **Buckets** seçin

---

### 2. Wardrobe Bucket Oluşturma

**Settings:**
```
Name: wardrobe
Public Bucket: ✅ Yes (checked)
File Size Limit: 10 MB
Allowed MIME Types: image/jpeg, image/png, image/webp
```

**CLI ile (Opsiyonel):**
```sql
-- Storage bucket oluştur
INSERT INTO storage.buckets (id, name, public)
VALUES ('wardrobe', 'wardrobe', true);

-- Public access policy
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'wardrobe' );

-- Authenticated upload policy
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'wardrobe' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own files
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'wardrobe'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'wardrobe'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

### 3. Profiles Bucket Oluşturma

**Settings:**
```
Name: profiles
Public Bucket: ✅ Yes (checked)
File Size Limit: 5 MB
Allowed MIME Types: image/jpeg, image/png
```

**CLI ile (Opsiyonel):**
```sql
-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true);

-- Policies (wardrobe ile aynı pattern)
-- ... (yukarıdaki policies'i bucket_id = 'profiles' olarak tekrarla)
```

---

### 4. Try-On-Results Bucket Oluşturma

**Settings:**
```
Name: try-on-results
Public Bucket: ✅ Yes (checked)
File Size Limit: 15 MB
Allowed MIME Types: image/jpeg, image/png
```

**CLI ile (Opsiyonel):**
```sql
-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('try-on-results', 'try-on-results', true);

-- Policies (wardrobe ile aynı pattern)
-- ... (yukarıdaki policies'i bucket_id = 'try-on-results' olarak tekrarla)
```

---

## 📁 Folder Structure

Her bucket içinde dosyalar kullanıcı ID'sine göre organize edilir:

```
wardrobe/
├── user-uuid-1/
│   ├── 20231217_143022_abc123_full.jpg
│   ├── 20231217_143022_abc123_thumb.jpg
│   ├── 20231217_144530_def456_full.jpg
│   └── 20231217_144530_def456_thumb.jpg
├── user-uuid-2/
│   └── ...

profiles/
├── user-uuid-1/
│   ├── profile_full.jpg
│   └── profile_thumb.jpg
└── user-uuid-2/
    └── ...

try-on-results/
├── user-uuid-1/
│   ├── result_20231217_143022_full.jpg
│   └── result_20231217_143022_thumb.jpg
└── user-uuid-2/
    └── ...
```

---

## 🔐 Security Policies

### Policy Açıklaması

```sql
-- 1. Herkes görebilir (public read)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'wardrobe' );

-- 2. Sadece authenticated users upload edebilir
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'wardrobe' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text  -- Sadece kendi folder'ına
);

-- 3. Kullanıcılar sadece kendi dosyalarını güncelleyebilir
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'wardrobe'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Kullanıcılar sadece kendi dosyalarını silebilir
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'wardrobe'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## 🧪 Test

### 1. Dashboard'dan Test

1. Storage → Buckets → `wardrobe`
2. **Upload File** butonuna tıklayın
3. Bir resim seçin
4. Upload tamamlandığında public URL'yi test edin

### 2. API ile Test

```bash
# Backend upload endpoint test
curl -X POST https://modli.mekanizma.com/api/upload-image \
  -H "Content-Type: application/json" \
  -d '{
    "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "bucket": "wardrobe",
    "user_id": "your-user-uuid",
    "filename": "test-image"
  }'

# Response:
# {
#   "success": true,
#   "full_url": "https://xxx.supabase.co/storage/v1/object/public/wardrobe/user-uuid/test-image_full.jpg",
#   "thumbnail_url": "https://xxx.supabase.co/storage/v1/object/public/wardrobe/user-uuid/test-image_thumb.jpg"
# }
```

### 3. Frontend'den Test

```typescript
import { uploadImageToStorage } from '../lib/storage';

const result = await uploadImageToStorage(
  imageBase64,
  userId,
  'wardrobe',
  'my-shirt'
);

console.log('Full URL:', result.fullUrl);
console.log('Thumb URL:', result.thumbnailUrl);
```

---

## 📊 Storage Quotas

### Free Tier Limits
- **Storage:** 1 GB
- **Bandwidth:** 2 GB/month
- **API Requests:** 50,000/month

### Pro Tier ($25/month)
- **Storage:** 100 GB
- **Bandwidth:** 200 GB/month
- **API Requests:** 2,500,000/month

### Enterprise
- **Storage:** Unlimited
- **Bandwidth:** Unlimited
- **API Requests:** Unlimited

---

## 🎨 Image Sizes

### Wardrobe Items
- **Full:** 1080x1920 (max 2MB)
- **Thumbnail:** 300x300 (max 50KB)

### Profile Photos
- **Full:** 1080x1080 (max 1MB)
- **Thumbnail:** 300x300 (max 30KB)

### Try-On Results
- **Full:** 1080x1920 (max 3MB)
- **Thumbnail:** 300x300 (max 60KB)

---

## 🔄 Migration (Eski Base64'ten Yeni Storage'a)

Eğer mevcut kullanıcılarınız varsa ve base64 verileri DB'de tutuluyorsa:

```sql
-- 1. Wardrobe items migration script
DO $$
DECLARE
  item RECORD;
  upload_result JSONB;
BEGIN
  FOR item IN 
    SELECT id, user_id, image_base64 
    FROM wardrobe_items 
    WHERE image_base64 LIKE 'data:image%'
  LOOP
    -- Backend upload endpoint'ini çağır
    -- Upload result'ı al
    -- DB'yi güncelle
    UPDATE wardrobe_items
    SET 
      image_url = upload_result->>'full_url',
      thumbnail_url = upload_result->>'thumbnail_url',
      image_base64 = NULL  -- Base64'ü temizle
    WHERE id = item.id;
  END LOOP;
END $$;
```

**⚠️ Not:** Bu migration script'i production'da dikkatli kullanın. Önce test environment'ta deneyin.

---

## 🚨 Troubleshooting

### 1. "403 Forbidden" Hatası

**Problem:** Dosyaya erişilemiyor

**Çözüm:**
```sql
-- Bucket public mu kontrol et
SELECT * FROM storage.buckets WHERE name = 'wardrobe';

-- Public policy var mı kontrol et
SELECT * FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects';
```

### 2. "Upload Failed" Hatası

**Problem:** Dosya yüklenemiyor

**Çözüm:**
- File size limit kontrol et (dashboard)
- MIME type allowed kontrol et
- User authenticated mi kontrol et
- Bucket name doğru mu kontrol et

### 3. Thumbnail Oluşturulmuyor

**Problem:** Backend thumbnail oluşturamıyor

**Çözüm:**
```bash
# Backend'de Pillow kurulu mu kontrol et
pip list | grep Pillow

# requirements.txt'te olmalı
Pillow==11.1.0

# Backend logs kontrol et
docker logs modli-backend -f
```

---

## ✅ Checklist

Production'a geçmeden önce:

- [ ] 3 bucket oluşturuldu (`wardrobe`, `profiles`, `try-on-results`)
- [ ] Tüm bucket'lar public
- [ ] Storage policies oluşturuldu
- [ ] Backend `/api/upload-image` endpoint test edildi
- [ ] Frontend `uploadImageToStorage` test edildi
- [ ] Public URL'ler çalışıyor
- [ ] Thumbnail'lar oluşturuluyor
- [ ] File size limits ayarlandı
- [ ] MIME types yapılandırıldı
- [ ] Backup stratejisi belirlendi

---

## 📝 Notes

- Storage bucket isimleri değiştirilemez (silip yeniden oluşturulmalı)
- Public bucket'lar herkes tarafından okunabilir
- Private bucket'lar için RLS policies gerekir
- Thumbnail generation backend'de yapılır (Pillow)
- CDN otomatik aktif (Supabase'in global CDN'i)

---

## 🔗 Resources

- **Supabase Storage Docs:** https://supabase.com/docs/guides/storage
- **Storage API Reference:** https://supabase.com/docs/reference/javascript/storage
- **Storage Policies:** https://supabase.com/docs/guides/storage/security/access-control

---

Made with ❤️ by Mekanizma Team
