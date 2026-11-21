# landing_v2_proba4 – VÉGLEGES, ÉLESÍTVE

- **Jóváhagyta a tulaj:** 2026-11-21 („Jó lesz így a weboldal, kiteheted.”) – a 4f kör (4. kör, 4b, 4e, 4f blokkok) és a 4g
  KOZEPRE ikon-javítás állapota.
- **Élesítve:** 2026-11-21 10:48, https://adozz.hu/ (csak a landing; `kod/deploy/landing-csere.sh`).
- **Az élő oldal forrása MÁR NEM EZ A MAPPA**, hanem `kod/landing/` (`oldal.sablon.html` = az itteni `_eszkoz/index.sablon.html`
  a build jelölőivel, `stilus.css`, `mozgas.js`, `kepek/`, `fontok/`, `vendor/`, `ikonok.json`). Ha a dizájn változik, a
  változást ott kell átvezetni (`node kod/landing/build.mjs`, `node --test kod/landing/meres.test.mjs`).
- **Eltérések ettől a mappától az élőn:**
  - mérés és linkek (SPEC §31): `js/meres.js`, Umami `/m/script.js`, `data-kj-esemeny` események, UTM-továbbadás, „Visszahívást
    kérek” gomb a záró panelen, Süti-tájékoztató link és mérés-sor a láblécben;
  - a `stilus.css` és a `mozgas.js` megjegyzések nélkül megy ki (a viselkedés és a látvány ugyanaz);
  - szövegek (őszinteség, élesítés előtt): „bankkártyával” a „kártyával vagy átutalással” helyett (3×); „A könyvelési irataidat a
    könyvelőd kezeli. Rajta kívül csak a cégünk vezetése férhet hozzájuk, naplózva.” (2×); a bemutató alatti jegy: „Az app képei
    bemutató adatokkal és az app új, bevezetés alatt álló kinézetével készültek. Gépen az app ma még telefonos elrendezésben
    nyílik meg.” (és a hős aria-labelje).
- Élő képernyőképek (390 és 1440): a munkamenet scratchpadjében (`elesites/elo/`), lásd a jelentést.
