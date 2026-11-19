// Expo-konfiguráció. A termék neve EGYETLEN helyről jön: kod/shared/brand.json → src/_shared/brand.json
// (a `npm run shared` másolja; SPEC §3.4). A technikai azonosítók (séma, csomagnév) szándékosan NEM a névből jönnek.
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Brand = {
  name: string;
  tagline: string;
  ids: { appScheme: string; androidPackage: string; iosBundleId: string; expoSlug: string };
};

function brand(): Brand {
  const p = join(__dirname, 'src', '_shared', 'brand.json');
  return JSON.parse(readFileSync(p, 'utf8')) as Brand;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const b = brand();
  const kamera = 'A kamerával a nyugtáidat, számláidat és az igazolványaidat fotózod le, hogy a könyvelőd megkapja őket.';
  const fotok = 'A galériából választott képet (például egy nyugta fotóját) feltöltheted a dossziédba.';
  const arc = 'Az arcoddal nyitod meg az appot, hogy más ne lássa a pénzügyi adataidat.';

  const plugins: ExpoConfig['plugins'] = [
    'expo-router',
    'expo-font',
    ['expo-secure-store', { faceIDPermission: arc }],
    ['expo-local-authentication', { faceIDPermission: arc }],
    ['expo-camera', { cameraPermission: kamera, microphonePermission: false, recordAudioAndroid: false }],
    ['expo-image-picker', { photosPermission: fotok, cameraPermission: kamera, microphonePermission: false }],
    ['expo-notifications', { color: '#1428DB' }],
    'expo-web-browser',
    'expo-sharing',
    'expo-apple-authentication',
    [
      'expo-splash-screen',
      { backgroundColor: '#1428DB', image: './assets/splash-ikon.png', imageWidth: 160, resizeMode: 'contain' },
    ],
    // Megosztás más appból (pl. e-mail-melléklet PDF, fotó) → Feltöltés képernyő (FUNKCIOK 13)
    [
      'expo-share-intent',
      {
        iosActivationRules: {
          NSExtensionActivationSupportsImageWithMaxCount: 10,
          NSExtensionActivationSupportsFileWithMaxCount: 5,
        },
        androidIntentFilters: ['image/*', '*/*'],
        androidMultiIntentFilters: ['image/*', '*/*'],
      },
    ],
    // Iratfotózás automatikus élkereséssel és kiegyenesítéssel (Android ML Kit / iOS VisionKit)
    'react-native-document-scanner-plugin',
    // Bemutató és útmutató videók streamelve (SPEC §26.7.3); háttérben és kép-a-képben nem játszik.
    ['expo-video', { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
  ];
  // Google-belépés natívan: a plugin csak akkor kell (és csak akkor fut le), ha a tulaj megadta az iOS kliens URL-sémáját.
  const googleIosScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  if (googleIosScheme) plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosScheme }]);

  return {
    ...config,
    name: b.name,
    slug: b.ids.expoSlug,
    scheme: b.ids.appScheme,
    version: '1.0.7',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    backgroundColor: '#E4E8F3',
    ios: {
      bundleIdentifier: b.ids.iosBundleId,
      supportsTablet: false,
      usesAppleSignIn: true,
      infoPlist: {
        NSCameraUsageDescription: kamera,
        NSPhotoLibraryUsageDescription: fotok,
        NSFaceIDUsageDescription: arc,
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: b.ids.androidPackage,
      // Bump with every test APK so a phone accepts it as an update (1.0.1 = review round 1 fixes).
      // 1.0.7 (8) = 11-19 javító kör 1-2; 1.0.6 (7) = SPEC §27 (tulaj 11-19); 1.0.5 (6) volt a kék szín + 1. kör (apk/README.md).
      versionCode: 8,
      // k3_kor2 biztonság 13: az app adatai (igazolványfotók, adóadatok) ne kerüljenek rendszer- / felhőmentésbe.
      allowBackup: false,
      adaptiveIcon: { foregroundImage: './assets/android-ikon-eloter.png', backgroundColor: '#1428DB' },
      permissions: ['android.permission.CAMERA', 'android.permission.USE_BIOMETRIC', 'android.permission.USE_FINGERPRINT'],
      // SYSTEM_ALERT_WINDOW comes from the Expo template (dev overlay); a financial app has no use for it.
      blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.SYSTEM_ALERT_WINDOW'],
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/favicon.png',
      name: b.name,
      shortName: b.name,
      lang: 'hu',
      themeColor: '#1428DB',
      backgroundColor: '#E4E8F3',
      description: b.tagline,
    },
    plugins,
    experiments: { typedRoutes: false },
    extra: { brandName: b.name },
  };
};
