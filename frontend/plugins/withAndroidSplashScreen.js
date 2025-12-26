const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to fix splashscreen_logo drawable issue
 * Creates splashscreen_logo drawable that references modli_logo
 * This plugin MUST run after expo-splash-screen
 */
const withAndroidSplashScreen = (config) => {
  // First, ensure files are created via withDangerousMod
  // This runs during prebuild and creates the files
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      try {
        const drawableDir = path.join(
          config.modRequest.platformProjectRoot,
          'app/src/main/res/drawable'
        );
        
        console.log('[withAndroidSplashScreen] ========================================');
        console.log('[withAndroidSplashScreen] Starting plugin execution');
        console.log('[withAndroidSplashScreen] Drawable directory:', drawableDir);
        console.log('[withAndroidSplashScreen] Platform project root:', config.modRequest.platformProjectRoot);
        console.log('[withAndroidSplashScreen] Project root:', config.modRequest.projectRoot);
        
        // Create drawable directory if it doesn't exist
        if (!fs.existsSync(drawableDir)) {
          fs.mkdirSync(drawableDir, { recursive: true });
          console.log('[withAndroidSplashScreen] ✓ Created drawable directory');
        } else {
          console.log('[withAndroidSplashScreen] ✓ Drawable directory already exists');
        }

        // Copy modli_logo.png to drawable directory
        const projectRoot = config.modRequest.projectRoot;
        const logoSourcePath = path.join(projectRoot, 'assets', 'images', 'modli-logo.png');
        const logoDestPath = path.join(drawableDir, 'modli_logo.png');
        
        console.log('[withAndroidSplashScreen] Logo source path:', logoSourcePath);
        console.log('[withAndroidSplashScreen] Logo dest path:', logoDestPath);
        console.log('[withAndroidSplashScreen] Source exists:', fs.existsSync(logoSourcePath));
        
        if (fs.existsSync(logoSourcePath)) {
          // Always copy to ensure it's up to date (even if it exists)
          fs.copyFileSync(logoSourcePath, logoDestPath);
          console.log('[withAndroidSplashScreen] ✓ Copied modli_logo.png to drawable directory');
          
          // Verify the file was copied correctly
          if (fs.existsSync(logoDestPath)) {
            const stats = fs.statSync(logoDestPath);
            console.log('[withAndroidSplashScreen] ✓ Logo file size:', stats.size, 'bytes');
          }
        } else {
          console.error('[withAndroidSplashScreen] ✗ ERROR: modli-logo.png not found at', logoSourcePath);
          // Create a fallback empty drawable to prevent build failure
          const fallbackContent = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#000000" />
</shape>`;
          const fallbackPath = path.join(drawableDir, 'modli_logo.xml');
          fs.writeFileSync(fallbackPath, fallbackContent, 'utf8');
          console.log('[withAndroidSplashScreen] ⚠ Created fallback modli_logo.xml (black rectangle)');
        }

        // Create splashscreen_logo.xml drawable that references modli_logo
        // Android 12+ splash screen için doğrudan bitmap kullanıyoruz
        // Android otomatik olarak logo'yu container'a sığdırır ve tamamını gösterir
        const drawableContent = `<?xml version="1.0" encoding="utf-8"?>
<!-- Android 12+ splash screen için logo drawable -->
<!-- Doğrudan bitmap kullanarak logo'nun tamamını gösteriyoruz -->
<bitmap
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@drawable/modli_logo"
    android:gravity="center"
    android:tileMode="disabled" />`;

        const drawablePath = path.join(drawableDir, 'splashscreen_logo.xml');
        
        // Always update to ensure it references modli_logo
        fs.writeFileSync(drawablePath, drawableContent, 'utf8');
        console.log('[withAndroidSplashScreen] ✓ Created/Updated splashscreen_logo.xml drawable');
        
        // Verify files exist
        if (fs.existsSync(drawablePath)) {
          console.log('[withAndroidSplashScreen] ✓ Verified: splashscreen_logo.xml exists');
          const content = fs.readFileSync(drawablePath, 'utf8');
          console.log('[withAndroidSplashScreen] File content:', content);
        } else {
          console.error('[withAndroidSplashScreen] ✗ ERROR: splashscreen_logo.xml was not created!');
        }
        
        if (fs.existsSync(logoDestPath) || fs.existsSync(path.join(drawableDir, 'modli_logo.xml'))) {
          console.log('[withAndroidSplashScreen] ✓ Verified: modli_logo file exists');
        } else {
          console.warn('[withAndroidSplashScreen] ⚠ WARNING: modli_logo file does not exist');
        }
        
        console.log('[withAndroidSplashScreen] ========================================');
        console.log('[withAndroidSplashScreen] Plugin execution completed successfully');
        
      } catch (error) {
        console.error('[withAndroidSplashScreen] ========================================');
        console.error('[withAndroidSplashScreen] ✗ ERROR during plugin execution:');
        console.error('[withAndroidSplashScreen] Error message:', error.message);
        console.error('[withAndroidSplashScreen] Error stack:', error.stack);
        console.error('[withAndroidSplashScreen] ========================================');
        // Don't throw - let build continue but log the error
      }
      
      return config;
    },
  ]);

  // Also hook into withAndroidManifest to ensure files exist during manifest processing
  // This provides a second chance to create files if withDangerousMod didn't run
  config = withAndroidManifest(config, async (config) => {
    try {
      const drawableDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/drawable'
      );
      
      // Ensure directory exists
      if (!fs.existsSync(drawableDir)) {
        fs.mkdirSync(drawableDir, { recursive: true });
      }

      // Ensure modli_logo.png exists and is up to date
      const projectRoot = config.modRequest.projectRoot;
      const logoSourcePath = path.join(projectRoot, 'assets', 'images', 'modli-logo.png');
      const logoDestPath = path.join(drawableDir, 'modli_logo.png');
      
      if (fs.existsSync(logoSourcePath)) {
        // Always copy to ensure it's up to date
        fs.copyFileSync(logoSourcePath, logoDestPath);
        console.log('[withAndroidSplashScreen] (Manifest hook) Copied/Updated modli_logo.png');
      }

      // Ensure splashscreen_logo.xml exists and is up to date
      const drawablePath = path.join(drawableDir, 'splashscreen_logo.xml');
      const drawableContent = `<?xml version="1.0" encoding="utf-8"?>
<!-- Android 12+ splash screen için logo drawable -->
<!-- Doğrudan bitmap kullanarak logo'nun tamamını gösteriyoruz -->
<bitmap
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@drawable/modli_logo"
    android:gravity="center"
    android:tileMode="disabled" />`;
      // Always update to ensure correct format
      fs.writeFileSync(drawablePath, drawableContent, 'utf8');
      console.log('[withAndroidSplashScreen] (Manifest hook) Created/Updated splashscreen_logo.xml');
    } catch (error) {
      console.error('[withAndroidSplashScreen] (Manifest hook) Error:', error.message);
    }
    
    return config;
  });

  return config;
};

module.exports = withAndroidSplashScreen;

