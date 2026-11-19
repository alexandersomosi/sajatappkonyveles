// Megosztás más appból (FUNKCIOK 13): PDF vagy kép érkezik pl. egy e-mail mellékletéből → Feltöltés képernyő.
// Natív modul kell hozzá (fejlesztői/áruházi build); Expo Go-ban és weben ki van kapcsolva.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface BejovoFajl {
  uri: string;
  nev: string;
  mime: string;
  meret: number | null;
}

let varakozo: BejovoFajl[] = [];
/** A Feltöltés képernyő egyszer kiveszi a megosztott fájlokat. */
export function megosztottFajlok(): BejovoFajl[] {
  const f = varakozo;
  varakozo = [];
  return f;
}

const elerheto = Platform.OS !== 'web' && !!requireOptionalNativeModule('ExpoShareIntentModule');

function Figyelo() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ disabled: !elerheto, resetOnBackground: true });
  useEffect(() => {
    if (!hasShareIntent || !shareIntent.files?.length) return;
    varakozo = shareIntent.files
      .filter((f) => /^(image\/(jpeg|png|heic|heif)|application\/pdf)$/i.test(f.mimeType))
      .map((f) => ({ uri: f.path.startsWith('file:') || f.path.startsWith('content:') ? f.path : `file://${f.path}`, nev: f.fileName, mime: f.mimeType, meret: f.size }));
    resetShareIntent();
    router.push(varakozo.length ? '/feltoltes?megosztas=1' : '/feltoltes?megosztas=rossz');
  }, [hasShareIntent, shareIntent, resetShareIntent]);
  return null;
}

export function MegosztasFigyelo() {
  return elerheto ? <Figyelo /> : null;
}
