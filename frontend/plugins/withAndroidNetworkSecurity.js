const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to add Android Network Security Config
 */
const withAndroidNetworkSecurity = (config) => {
  // First, modify AndroidManifest.xml to reference the network security config
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    // Add networkSecurityConfig attribute to application tag
    if (!mainApplication.$) {
      mainApplication.$ = {};
    }
    mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    
    return config;
  });

  // Then, create the network_security_config.xml file
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/xml'
      );
      
      // Create xml directory if it doesn't exist
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }

      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">cgbyhxployzpxwixgqzs.supabase.co</domain>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </domain-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">modli.mekanizma.com</domain>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </domain-config>
</network-security-config>`;

      const xmlPath = path.join(xmlDir, 'network_security_config.xml');
      fs.writeFileSync(xmlPath, xmlContent, 'utf8');
      
      return config;
    },
  ]);

  return config;
};

module.exports = withAndroidNetworkSecurity;







