// Rendszer-linkek átírása (natív): a megosztási bővítmény (expo-share-intent, iOS) „kezjegy://dataUrl=…” címmel nyitja
// az appot – ezt a Feltöltés képernyőre irányítjuk; a fizetés utáni visszatérés (kezjegy://elofizetes/eredmeny) marad.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    if (path.includes('dataUrl=')) return '/feltoltes?megosztas=1';
    return path;
  } catch {
    return '/';
  }
}
