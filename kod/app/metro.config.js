// Metro: az éles buildből a MINTA-szerver és a mintaképek KIMARADNAK (üres helyettesítő modul), csak
// EXPO_PUBLIC_API_MODE=minta buildben kerülnek be. Így demóadat soha nem jut éles csomagba.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const minta = process.env.EXPO_PUBLIC_API_MODE === 'minta';
const csere = {
  'minta/szerver': path.join(__dirname, 'src/api/minta/ures.ts'),
  'minta/kepek': path.join(__dirname, 'src/api/minta/kepek_ures.ts'),
};
const eredeti = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, moduleName, platform) => {
  if (!minta) {
    for (const [veg, fajl] of Object.entries(csere)) {
      if (moduleName.endsWith(veg)) return { type: 'sourceFile', filePath: fajl };
    }
  }
  return eredeti ? eredeti(ctx, moduleName, platform) : ctx.resolveRequest(ctx, moduleName, platform);
};

module.exports = config;
