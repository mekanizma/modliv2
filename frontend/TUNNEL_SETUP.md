# Tunnel Modu Kurulum Rehberi

## Sorun
`npm start --tunnel` komutu çalıştırıldığında ngrok ile ilgili hata alınıyor ve LAN dışından bağlanılamıyor.

**Hata:** `TypeError [ERR_INVALID_ARG_TYPE]: The "file" argument must be of type string. Received null`

Bu hata genellikle ngrok binary'sinin bulunamadığında oluşur.

## Çözüm 0: Manuel Ngrok Kurulumu (Windows için ÖNERİLEN)

Windows'ta `@expo/ngrok-bin` paketi bazen binary'yi indiremez. Bu durumda manuel kurulum yapın:

### Otomatik Kurulum (PowerShell Script)

```powershell
cd frontend
.\scripts\setup-manual-ngrok.ps1
```

Script otomatik olarak:
1. Ngrok'u indirip kurar
2. PATH'e ekler
3. Token kontrolü yapar

### Manuel Kurulum

1. **Ngrok'u indirin:**
   - https://ngrok.com/download adresinden Windows için indirin
   - Veya direkt link: https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip

2. **Ngrok'u kurun:**
   ```powershell
   # Ngrok dizinini oluştur
   $ngrokDir = "$env:LOCALAPPDATA\ngrok"
   New-Item -ItemType Directory -Path $ngrokDir -Force
   
   # Zip'i çıkar ve ngrok.exe'yi kopyala
   Expand-Archive -Path "path\to\ngrok.zip" -DestinationPath $ngrokDir
   
   # PATH'e ekle
   $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
   [Environment]::SetEnvironmentVariable("Path", "$currentPath;$ngrokDir", "User")
   ```

3. **Yeni terminal açın** (PATH güncellemesi için)

4. **Token'ı ayarlayın** (Çözüm 1'e bakın)

5. **Expo'yu başlatın:**
   ```bash
   npm run start:tunnel
   ```

## Çözüm 1: Ngrok Token Ayarlama

1. **Ngrok hesabı oluşturun:**
   - https://dashboard.ngrok.com/signup adresinden ücretsiz hesap oluşturun

2. **Auth token'ı alın:**
   - Ngrok dashboard'da "Your Authtoken" bölümünden token'ınızı kopyalayın

3. **Token'ı ayarlayın:**
   ```bash
   # Windows PowerShell
   $env:NGROK_AUTHTOKEN="your-token-here"
   
   # Veya kalıcı olarak sistem değişkenlerine ekleyin
   [System.Environment]::SetEnvironmentVariable("NGROK_AUTHTOKEN", "your-token-here", "User")
   ```

4. **Uygulamayı tunnel modunda başlatın:**
   ```bash
   npm run start:tunnel
   # veya
   npm start --tunnel
   ```

## Çözüm 2: Expo CLI Güncelleme

Expo CLI'yi güncelleyin:
```bash
npm install -g expo-cli@latest
# veya
npx expo-cli@latest start --tunnel
```

## Çözüm 3: Manuel Ngrok Kurulumu

1. **Ngrok'u indirin ve kurun:**
   - https://ngrok.com/download adresinden Windows için indirin
   - İndirilen dosyayı PATH'e ekleyin veya proje klasörüne kopyalayın

2. **Ngrok'u yapılandırın:**
   ```bash
   ngrok config add-authtoken YOUR_TOKEN_HERE
   ```

3. **Ngrok'u manuel başlatın (başka bir terminal):**
   ```bash
   ngrok http 8081
   ```

4. **Expo'yu LAN modunda başlatın:**
   ```bash
   npm run start:lan
   ```

5. **Ngrok URL'ini Expo'ya manuel olarak girin:**
   - Expo DevTools'ta "Connection" sekmesine gidin
   - Ngrok'un verdiği HTTPS URL'ini kullanın

## Çözüm 4: Alternatif - Cloudflare Tunnel (Ücretsiz)

1. **Cloudflare Tunnel kurulumu:**
   ```bash
   # Cloudflare Tunnel indirin
   # https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
   ```

2. **Tunnel oluşturun ve başlatın:**
   ```bash
   cloudflared tunnel --url http://localhost:8081
   ```

## Çözüm 5: Port Forwarding (Router üzerinden)

Eğer router'a erişiminiz varsa:

1. Router ayarlarına girin
2. Port forwarding ekleyin:
   - Dış port: 8081
   - İç port: 8081
   - IP: Bilgisayarınızın yerel IP'si
3. Expo'yu LAN modunda başlatın:
   ```bash
   npm run start:lan
   ```
4. Dış IP adresinizi kullanın (whatismyip.com'dan öğrenebilirsiniz)

## Hızlı Test

Tunnel modunun çalışıp çalışmadığını test etmek için:

```bash
# Terminal 1: Expo'yu başlat
npm run start:tunnel

# Terminal 2: Ngrok durumunu kontrol et
# Ngrok dashboard'da aktif tunnel'ları görebilirsiniz
```

## Notlar

- Ngrok ücretsiz planında bazı kısıtlamalar vardır (bağlantı süresi, bant genişliği)
- Production ortamında Cloudflare Tunnel veya benzeri çözümler önerilir
- Güvenlik için tunnel URL'lerini paylaşırken dikkatli olun

