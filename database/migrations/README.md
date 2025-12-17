# Database Migrations

Bu klasör Supabase veritabanı migration'larını içerir.

## Migration Nasıl Çalıştırılır?

### Yöntem 1: Supabase Dashboard (Önerilen)

1. [Supabase Dashboard](https://app.supabase.com)'a giriş yapın
2. Projenizi seçin
3. Sol menüden **SQL Editor**'ı açın
4. **New Query** butonuna tıklayın
5. Migration dosyasının içeriğini kopyalayıp yapıştırın
6. **Run** butonuna tıklayın
7. Success mesajını bekleyin

### Yöntem 2: Supabase CLI

```bash
# CLI yüklü değilse
npm install -g supabase

# Login
supabase login

# Migration çalıştır
supabase db push
```

## Mevcut Migrations

### 1. make_color_season_optional.sql
**Tarih:** 2025-12-17  
**Açıklama:** `wardrobe_items` tablosunda `color` ve `season` alanlarını opsiyonel yapar.

**Ne Değişir:**
- ✅ `color` alanı artık NULL olabilir
- ✅ `season` alanı artık NULL olabilir
- ✅ Kullanıcılar kıyafet eklerken bu alanları boş bırakabilir

**Çalıştırma:**
```sql
-- Supabase SQL Editor'da çalıştırın
ALTER TABLE wardrobe_items ALTER COLUMN color DROP NOT NULL;
ALTER TABLE wardrobe_items ALTER COLUMN season DROP NOT NULL;
```

## Sorun Giderme

### Hata: "null value in column violates not-null constraint"
**Çözüm:** İlgili migration'ı çalıştırın (yukarıdaki SQL komutunu Supabase'de çalıştırın).

### Migration çalışmadı mı?
1. SQL Editor'da hatayı kontrol edin
2. Tablo isminin doğru olduğundan emin olun
3. Gerekli yetkilere sahip olduğunuzdan emin olun
