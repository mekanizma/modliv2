# Modli Admin Panel

Kullanıcılara kredi atama ve push bildirimi gönderme için web tabanlı, şifre korumalı yönetim paneli. Mobil uygulamadan bağımsızdır ve Coolify üzerinde ayrı bir uygulama olarak deploy edilebilir.

## Özellikler
- E-posta/şifre ile admin girişi (backend `/api/admin/login`)
- Tüm kullanıcıları listeleme, kredi güncelleme
- Tekil veya tüm kullanıcılara push notification isteği oluşturma
- İstatistik kartları (kullanıcı ve kredi özetleri)

## Geliştirme
```bash
cd admin-panel
cp env.example .env      # VITE_BACKEND_URL değerini ayarla (örn: https://api.modli.com)
npm install
npm run dev
```

Gerekli sürümler: Node.js 18+.

## Build
```bash
npm run build
npm run preview
```

## Coolify Deploy (ayrı uygulama)
1. Yeni uygulama olarak **Static Site** seçin.
2. Kaynak: bu repo, **base directory**: `admin-panel`.
3. Build komutu: `npm run build`
4. Publish klasörü: `dist`
5. Ortam değişkeni: `VITE_BACKEND_URL=https://<backend-domain>`
6. Domain ve TLS ayarlarını tanımlayın, deploy’u başlatın.

## Notlar
- Backend push servisi şu an placeholder; gerçek gönderim için Expo/FCM entegrasyonu gerektirir.
- Admin token’ı localStorage içinde `modli_admin_session_v1` anahtarıyla saklanır.
- API çağrıları `X-Admin-Token` header’ı ile backend’e iletilir.

