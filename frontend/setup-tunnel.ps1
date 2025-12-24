# Ngrok Tunnel Kurulum Scripti (PowerShell)
# Kullanım: .\setup-tunnel.ps1 YOUR_NGROK_TOKEN

param(
    [Parameter(Mandatory=$true)]
    [string]$NgrokToken
)

Write-Host "🔧 Ngrok token ayarlanıyor..." -ForegroundColor Cyan

# Environment variable'ı ayarla
[System.Environment]::SetEnvironmentVariable("NGROK_AUTHTOKEN", $NgrokToken, "User")

Write-Host "✅ Ngrok token kalıcı olarak ayarlandı!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Yeni bir PowerShell penceresi açmanız gerekebilir." -ForegroundColor Yellow
Write-Host ""
Write-Host "🎉 Kurulum tamamlandı! Şimdi şu komutu çalıştırabilirsiniz:" -ForegroundColor Green
Write-Host "   npm run start:tunnel" -ForegroundColor White
Write-Host ""
Write-Host "Veya:" -ForegroundColor Gray
Write-Host "   npm start --tunnel" -ForegroundColor White


