#!/usr/bin/env node

/**
 * Ngrok token kurulum scripti
 * Kullanım: node scripts/setup-ngrok.js YOUR_NGROK_TOKEN
 */

const { execSync } = require('child_process');
const os = require('os');

const token = process.argv[2];

if (!token) {
  console.error('❌ Hata: Ngrok token gerekli!');
  console.log('\nKullanım: node scripts/setup-ngrok.js YOUR_NGROK_TOKEN');
  console.log('\nToken\'ı şuradan alabilirsiniz: https://dashboard.ngrok.com/get-started/your-authtoken');
  process.exit(1);
}

const platform = os.platform();

try {
  if (platform === 'win32') {
    // Windows için
    console.log('🔧 Windows için ngrok token ayarlanıyor...');
    
    // Geçici olarak environment variable ayarla
    process.env.NGROK_AUTHTOKEN = token;
    
    // Kalıcı olarak kullanıcı environment variable'ına ekle
    try {
      execSync(`setx NGROK_AUTHTOKEN "${token}"`, { stdio: 'inherit' });
      console.log('✅ Ngrok token kalıcı olarak ayarlandı!');
      console.log('⚠️  Yeni bir terminal açmanız gerekebilir.');
    } catch (error) {
      console.log('⚠️  setx komutu başarısız oldu, manuel olarak ayarlayın:');
      console.log(`   [System.Environment]::SetEnvironmentVariable("NGROK_AUTHTOKEN", "${token}", "User")`);
      console.log('\nVeya geçici olarak şu komutu kullanın:');
      console.log(`   $env:NGROK_AUTHTOKEN="${token}"`);
    }
  } else {
    // Linux/Mac için
    console.log('🔧 Ngrok token ayarlanıyor...');
    
    // Ngrok config dosyasına token ekle
    const ngrokConfigPath = `${os.homedir()}/.ngrok2/ngrok.yml`;
    const fs = require('fs');
    const path = require('path');
    
    // Config dizinini oluştur
    const configDir = path.dirname(ngrokConfigPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Config dosyasını oku veya oluştur
    let config = {};
    if (fs.existsSync(ngrokConfigPath)) {
      const yaml = require('yaml');
      const content = fs.readFileSync(ngrokConfigPath, 'utf8');
      config = yaml.parse(content) || {};
    }
    
    config.authtoken = token;
    
    // YAML yazmak için basit bir yöntem
    const yamlContent = `authtoken: ${token}\n`;
    fs.writeFileSync(ngrokConfigPath, yamlContent);
    
    console.log('✅ Ngrok token ayarlandı!');
    console.log(`   Config dosyası: ${ngrokConfigPath}`);
  }
  
  console.log('\n🎉 Kurulum tamamlandı! Şimdi şu komutu çalıştırabilirsiniz:');
  console.log('   npm run start:tunnel');
  
} catch (error) {
  console.error('❌ Hata:', error.message);
  console.log('\nManuel kurulum için:');
  console.log('1. https://dashboard.ngrok.com/get-started/your-authtoken adresinden token alın');
  console.log('2. Environment variable olarak ayarlayın:');
  if (platform === 'win32') {
    console.log('   PowerShell: $env:NGROK_AUTHTOKEN="your-token"');
  } else {
    console.log('   Bash: export NGROK_AUTHTOKEN="your-token"');
  }
  process.exit(1);
}


