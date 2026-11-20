# Adózz.hu közös e-mail-sablon

Egyetlen sablon minden rendszerlevélhez (ZeptoMail): kék fejléc a felirat-logóval, fehér lekerekített kártya szürke háttéren, sárga gomb sötét felirattal, lábléc a kártyán kívül.

## Fájlok
- `sablon.html` – a közös váz helyőrzőkkel.
- `elemek.md` – az építőelemek (kódblokk, kulcs-érték táblázat, tipp- és infódoboz, linkek, gomb).
- `01..06_*.html` – hat kitöltött példalevél; `*_asztali.png` (680 px) és `*_mobil.png` (390 px) képek, 2x, teljes magasság.
- `logo_feher@2x.png` – 340×92 px, átlátszó, fehér-sárga felirat-logó a kék fejlécre (a levélben 170×46). A felirat BALRA igazított, hogy egy vonalba essen a szöveggel.
- `epit_peldak.cjs` (példák + elemek), `kep_level.cjs` (PNG-k), `logo_keszit.cjs` (logó; a Poppins 800-at a Node tölti le és ágyazza be).
- Újragyártás: `node epit_peldak.cjs && node kep_level.cjs` (a logó: `node logo_keszit.cjs`).
- `_regi/` – az ellenőrzés előtti változat (nem kell, de nem töröltük).

## Helyőrzők
| Helyőrző | Mi ez |
|---|---|
| `{{elonezet}}` | rejtett előnézeti sor (a levéllistában a tárgy mellett látszik) |
| `{{cim}}` | címsor és `<title>` |
| `{{tartalom}}` | az építőelemekből összerakott törzs (`elemek.md`) |
| `{{gomb_szoveg}}` + `{{gomb_link}}` | fő gomb a `{{#gomb}}…{{/gomb}}` blokkban; ha nincs gomb, a blokk kimarad |
| `{{link_szoveg}}` + `{{link_cel}}` | másodlagos link a gomb alatt a `{{#link}}…{{/link}}` blokkban; elhagyható |
| `{{lablec_ok}}` | miért kapja a levelet (pl. „Ezt a levelet azért kaptad, mert az Adózz.hu-n van fiókod.”) |

Minden szöveges helyőrzőt HTML-escape-elve kell betenni (a linkeket is: `&` → `&amp;`); a `{{tartalom}}` már kész HTML.

## Levelezőkliens-szabályok (betartva)
- Táblázatos váz (`role="presentation"`), minden stílus inline, max. 600 px, Outlookhoz „ghost table”.
- A `<style>` csak a mobilos finomítást (16 px oldalmargó, kisebb cím és kód, egymás alá törő kulcs-érték sorok), az Apple adatfelismerés semlegesítését és a sötét módú lábléc-színt tartalmazza. Ha a Gmail kidobja, a levél akkor is jó (ellenőrizve 360 px-en, `<style>` nélkül).
- Nincs flex/grid/position, külső CSS vagy webfont; betű: `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`.
- „Bulletproof” gomb: háttérszínes cella + Outlookhoz VML `roundrect` (300×48 px).
- Lekerekítés csak `border-radius`-szal; az Outlook ezt nem ismeri, ott szögletes kártya és gomb lesz, ami szintén rendben van.
- `color-scheme: light` + `supported-color-schemes`, `format-detection` (a dátum és a telefonszám ne váljon kék linkké).

## Beépítéskor a teendők
1. A logót ki kell tenni a `https://adozz.hu/email/logo_feher@2x.png` címre (a webszerver statikus fájlja). Addig a levelekben az alt-szöveg („Adózz.hu”) látszik.
2. A `mailer.ts` `htmlOf(subject, text)` helyett ez a sablon töltődik: a sablon beolvasása, a blokkok (`gomb`, `link`) kezelése, a helyőrzők cseréje escape-elve. A töltés mintája az `epit_peldak.cjs` `tolt()` függvénye.
3. A sima szöveges változat (`text`) marad a levél `text/plain` részeként.
4. Levéltípusonként kell: előnézet, cím, tartalom-elemek, `lablec_ok`, ahol van, gomb és másodlagos link.
5. A díjszámla és a díjbekérő PDF-je csatolmány marad.
6. Élesítés előtt tesztküldés a ZeptoMailen át valódi kliensekbe (Outlook asztali, Outlook.com, Gmail web + app, Apple Mail iOS).
