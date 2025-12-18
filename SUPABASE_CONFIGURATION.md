# 🔧 Supabase Configuration

Bu dosya Supabase dashboard'da yapılması gereken önemli ayarları içerir.

## 🌐 Site URL ve Redirect URLs Ayarları

### Adım 1: Supabase Dashboard'a Giriş

1. https://app.supabase.com adresine gidin
2. Projenizi seçin
3. Sol menüden **Authentication** → **URL Configuration** 'a gidin

### Adım 2: Site URL Ayarı

**Site URL** alanına:
```
https://mekanizma.com/modli/index.html
```

**Ne İşe Yarar:**
- Email onaylama linki bu URL'e yönlendirir
- Şifre resetleme linki bu URL'e yönlendirir
- OAuth callback'leri bu URL'i kullanır

### Adım 3: Redirect URLs Ayarı

**Redirect URLs** alanına şunları ekleyin (her satıra bir tane):
```
https://mekanizma.com/modli/*
https://mekanizma.com/modli/index.html
http://localhost:8081
http://localhost:8082
exp://localhost:8081
exp://localhost:8082
```

**Neden Birden Fazla:**
- Production: `https://mekanizma.com/modli/*`
- Development: `localhost` ve `exp://` (Expo için)

---

## 📧 Email Template Ayarları

### Email Onaylama (Confirm Signup)

1. Sol menüden **Authentication** → **Email Templates** → **Confirm signup**
2. Subject değiştirmeyin (Confirm Your Email)
3. Body'de `{{ .ConfirmationURL }}` değişkenini kullanır
4. Bu otomatik olarak doğru URL'i kullanacak

**Örnek Template:**
```html
<h2>Welcome to Modli!</h2>
<p>Please confirm your email address by clicking the link below:</p>
<a href="{{ .ConfirmationURL }}">Confirm Email</a>
```

### Şifre Sıfırlama (Reset Password)

1. Sol menüden **Authentication** → **Email Templates** → **Reset password**
2. Subject: Reset Your Password
3. Body'de `{{ .ConfirmationURL }}` değişkenini kullanır

**Örnek Template:**
```html
<h2>Reset Your Password</h2>
<p>Click the link below to reset your password:</p>
<a href="{{ .ConfirmationURL }}">Reset Password</a>
```

---

## 🔐 SMTP Ayarları (Opsiyonel)

Eğer kendi email sunucunuzu kullanmak isterseniz:

1. **Authentication** → **SMTP Settings**
2. Enable Custom SMTP
3. Ayarlarınızı girin:
   - SMTP Host
   - SMTP Port
   - Username
   - Password
   - From Email

---

## ✅ Test Etme

### Email Onaylama Testi:
```typescript
// Yeni kullanıcı kaydı
await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'password123'
});

// Email gidecek:
// Subject: Confirm Your Email
// Link: https://mekanizma.com/modli/index.html?token=...
```

### Şifre Sıfırlama Testi:
```typescript
// Şifre sıfırlama isteği
await supabase.auth.resetPasswordForEmail('test@example.com', {
  redirectTo: 'https://mekanizma.com/modli/index.html'
});

// Email gidecek:
// Subject: Reset Your Password
// Link: https://mekanizma.com/modli/index.html?token=...
```

---

## 🚀 Frontend Kod Değişiklikleri

### Şifre Sıfırlama Butonu (✅ Zaten Eklendi)

`app/(auth)/index.tsx` dosyasında:
```typescript
const handleForgotPassword = async () => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://mekanizma.com/modli/index.html',
  });
};
```

### Sign-up Email Onaylama (✅ Zaten Var)

`AuthContext.tsx` dosyasında:
```typescript
await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: 'https://mekanizma.com/modli/index.html'
  }
});
```

---

## 📱 Deep Linking (Gelecek İçin)

Eğer mobile app'e direk link istiyorsanız:

### iOS
```
modli://reset-password
```

### Android
```
modli://reset-password
```

**app.json'a ekleyin:**
```json
{
  "expo": {
    "scheme": "modli"
  }
}
```

---

## 🔍 Troubleshooting

### Sorun: Email gelmiyor
**Çözüm:**
- Spam klasörünü kontrol edin
- SMTP ayarları doğru mu kontrol edin
- Supabase logs'a bakın (Authentication → Logs)

### Sorun: Link çalışmıyor
**Çözüm:**
- Site URL doğru ayarlı mı?
- Redirect URL listesinde var mı?
- Token'ın süresi dolmuş olabilir (1 saat)

### Sorun: Localhost'ta çalışmıyor
**Çözüm:**
- Redirect URLs'e `exp://localhost:8081` ekleyin
- Development için ayrı redirectTo kullanın:
```typescript
const redirectTo = __DEV__ 
  ? 'exp://localhost:8081' 
  : 'https://mekanizma.com/modli/index.html';
```

---

## 📊 Kontrol Listesi

### Dashboard Ayarları:
- [ ] Site URL: `https://mekanizma.com/modli/index.html`
- [ ] Redirect URLs eklenmiş
- [ ] Email templates güncellenmiş
- [ ] SMTP ayarları (opsiyonel)

### Test:
- [ ] Yeni kullanıcı kaydı → Email geldi mi?
- [ ] Email'deki link tıklanıyor mu?
- [ ] Şifre sıfırlama → Email geldi mi?
- [ ] Şifre sıfırlama linki çalışıyor mu?

---

## 💡 Önemli Notlar

1. **Production URL:** `https://mekanizma.com/modli/index.html`
2. **Development URL:** `exp://localhost:8081` (Expo)
3. **Token Geçerlilik Süresi:** 1 saat (Supabase default)
4. **Email Rate Limit:** Saatte 4 email/IP (Supabase free tier)

---

## 📝 Özet

✅ **Frontend:** Şifre sıfırlama butonu eklendi ve çalışıyor
✅ **redirectTo:** `https://mekanizma.com/modli/index.html` ayarlandı
⚠️ **Supabase Dashboard:** Site URL ve Redirect URLs ayarlarını yapmanız gerekiyor

**Yapılacak:** Yukarıdaki adımları Supabase dashboard'da uygulayın!

