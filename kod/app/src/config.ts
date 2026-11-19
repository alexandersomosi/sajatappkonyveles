// Futásidejű beállítások. Az API címe build-időben jön (EXPO_PUBLIC_API_URL); a webes build ugyanazon a hoston hív
// (/api/v1, Caddy továbbítja), a natív app az api. hostot (SPEC §3.1, §13.2).
import { Platform } from 'react-native';
import brandJson from './_shared/brand.json';

export const brand = brandJson as {
  name: string;
  tagline: string;
  subline: string;
  priceHufMonthlyGross: number;
  provider: { legalName: string; seat: string; taxNumber: string; registryNumber: string; supportEmail: string };
  ids: { appScheme: string; androidPackage: string; iosBundleId: string; expoSlug: string };
};

const NATIV_ALAP = 'https://api.45-94-65-74.sslip.io/api/v1';

export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'web' ? '/api/v1' : NATIV_ALAP)).replace(/\/$/, '');

/**
 * MINTA mód: szerver nélkül, beépített kitalált adatokkal fut (képernyőképek, kattintható bemutató).
 * Csak akkor kapcsol be, ha a build kifejezetten így készült (EXPO_PUBLIC_API_MODE=minta). Az app ilyenkor minden
 * képernyőn „MINTA” jelzést mutat, és semmit nem küld sehova.
 */
export const MINTA_MOD = process.env.EXPO_PUBLIC_API_MODE === 'minta';

export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

/** A biometrikus zár ennyi háttérben töltött idő után kér újra azonosítást (SPEC §4.1). */
export const ZAR_UTAN_MS = 5 * 60 * 1000;

export const SEMA = brand.ids.appScheme; // kezjegy://
