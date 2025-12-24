# Manuel Ngrok Kurulum Scripti
# Bu script ngrok'u manuel olarak indirip kurar ve Expo ile kullanılabilir hale getirir

Write-Host "🔧 Manuel Ngrok Kurulumu Başlatılıyor..." -ForegroundColor Cyan

$ngrokDir = "$env:LOCALAPPDATA\ngrok"
$ngrokExe = "$ngrokDir\ngrok.exe"
$downloadUrl = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"

# Ngrok dizinini oluştur
if (-not (Test-Path $ngrokDir)) {
    New-Item -ItemType Directory -Path $ngrokDir -Force | Out-Null
    Write-Host "✅ Ngrok dizini oluşturuldu: $ngrokDir" -ForegroundColor Green
}

# Ngrok zaten kurulu mu kontrol et
if (Test-Path $ngrokExe) {
    Write-Host "✅ Ngrok zaten kurulu: $ngrokExe" -ForegroundColor Green
    $version = & $ngrokExe version 2>&1
    Write-Host "   Versiyon: $version" -ForegroundColor Gray
} else {
    Write-Host "📥 Ngrok indiriliyor..." -ForegroundColor Yellow
    
    $zipPath = "$env:TEMP\ngrok.zip"
    
    try {
        # Ngrok'u indir
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
        Write-Host "✅ İndirme tamamlandı" -ForegroundColor Green
        
        # Zip'i aç
        Write-Host "📦 Ngrok çıkarılıyor..." -ForegroundColor Yellow
        Expand-Archive -Path $zipPath -DestinationPath $ngrokDir -Force
        Write-Host "✅ Ngrok kuruldu: $ngrokExe" -ForegroundColor Green
        
        # Zip dosyasını sil
        Remove-Item $zipPath -Force
    } catch {
        Write-Host "❌ Hata: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Manuel kurulum için:" -ForegroundColor Yellow
        Write-Host "1. https://ngrok.com/download adresinden Windows için ngrok indirin" -ForegroundColor White
        Write-Host "2. ngrok.exe dosyasını şuraya kopyalayın: $ngrokDir" -ForegroundColor White
        exit 1
    }
}

# PATH'e ekle (geçici)
$env:Path += ";$ngrokDir"

# PATH'e kalıcı olarak ekle
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$ngrokDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$ngrokDir", "User")
    Write-Host "✅ Ngrok PATH'e eklendi" -ForegroundColor Green
}

# Ngrok token kontrolü
Write-Host ""
Write-Host "🔑 Ngrok Token Kontrolü..." -ForegroundColor Cyan
$token = [Environment]::GetEnvironmentVariable("NGROK_AUTHTOKEN", "User")

if ([string]::IsNullOrEmpty($token)) {
    Write-Host "⚠️  Ngrok token bulunamadı!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Token'ı ayarlamak için:" -ForegroundColor Yellow
    Write-Host "1. https://dashboard.ngrok.com/get-started/your-authtoken adresinden token alın" -ForegroundColor White
    Write-Host "2. Şu komutu çalıştırın:" -ForegroundColor White
    Write-Host '   [Environment]::SetEnvironmentVariable("NGROK_AUTHTOKEN", "YOUR_TOKEN", "User")' -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Veya PowerShell script'i ile:" -ForegroundColor Yellow
    Write-Host "   .\setup-tunnel.ps1 YOUR_TOKEN" -ForegroundColor Cyan
} else {
    Write-Host "✅ Ngrok token ayarlı" -ForegroundColor Green
}

# Ngrok'u test et
Write-Host ""
Write-Host "🧪 Ngrok test ediliyor..." -ForegroundColor Cyan
try {
    $ngrokVersion = & $ngrokExe version 2>&1
    Write-Host "✅ Ngrok çalışıyor: $ngrokVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Ngrok test edilemedi. Yeni bir terminal açıp tekrar deneyin." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Kurulum tamamlandı!" -ForegroundColor Green
Write-Host ""
Write-Host "Kullanım:" -ForegroundColor Cyan
Write-Host "1. Yeni bir PowerShell terminali açın (PATH güncellemesi için)" -ForegroundColor White
Write-Host "2. Ngrok token'ınızı ayarlayın (yukarıdaki talimatlara bakın)" -ForegroundColor White
Write-Host "3. Expo'yu tunnel modunda başlatın:" -ForegroundColor White
Write-Host "   npm run start:tunnel" -ForegroundColor Cyan
Write-Host ""
Write-Host "Alternatif: Manuel ngrok başlatma" -ForegroundColor Yellow
Write-Host "1. Başka bir terminalde: ngrok http 8081" -ForegroundColor White
Write-Host "2. Expo'yu LAN modunda başlatın: npm run start:lan" -ForegroundColor White
Write-Host "3. Ngrok'un verdiği HTTPS URL'ini kullanın" -ForegroundColor White

