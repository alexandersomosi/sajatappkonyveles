# Kézjegy – végleges színpaletta (kék, 2026-11-18)

**Döntés:** a tulaj 11-18 17:50-kor a kék próbát választotta („Ez jó lesz”): a márkaszín az élénk kék **#1428DB** a
korábbi tintakék #17284A helyett. Minta: `C3_zold/03_fooldal_kek.png`, tokenek: `C3_zold/kek.css` (a
`C2_modern/app_v2/tokens.css` fölé töltve). Szerkezet, betű (Geist), ikonok (3D), térközök **változatlanok** – csak a
színek cserélődtek. A token NEVE a kódban (`tintakek`, `--tintakek`) a stabilitás miatt maradt; az értéke kék.

## Végleges tokenek

| Token (app / panel) | Régi | **Új** | Mire |
|---|---|---|---|
| `tintakek` / `--tintakek` | #17284A | **#1428DB** | fejlécsáv, elsődleges gomb, saját buborék, aktív fül + 4 pt-os aláhúzás, Fotózás-gyűrű (3 pt), lépésjel, mérősáv, app-ikon |
| `tintakekSzoveg` / `--tintakek-szoveg` | #22396A | **#1226B8** | link, másodlagos gomb felirata |
| `gombMAlap` / `--gomb-m-alap` | #D6E0F0 | **#DFE4FD** | másodlagos gomb (csak az övé) |
| `gombMNyomott` / `--gomb-m-nyomott` | #C3D0E8 | **#C9D2FB** | másodlagos gomb lenyomva |
| `alap` / `--alap` | #DDE3EC | **#E4E8F3** | háttér (a fehér lapok alatt) |
| `tinta` / `--tinta` | #151C2A | **#10152B** | szöveg |
| `halvany` / `--halvany` | #535D72 | **#505873** | másodlagos szöveg fehér lapon |
| `halvanyAlapon` / `--halvany-alapon` | #4A5468 | **#4A5270** | másodlagos szöveg az alapon |
| `fejlecHalvany` / `--fejlec-halvany` | #B4C0D6 | **#C9D2FF** | másodlagos szöveg a kék sávon; panel: inaktív fül |
| `tollkekSavon` / `--tollkek-savon` | #8FB0F4 | **#C9D2FF** | a kézvonás a kék sávon (szóvédjegy, app-ikon) |
| `keret` / `--keret` | #C5CEDD | **#C9D0E4** | keretek |
| `hajszal` / `--hajszal` | #E1E6EE | **#E2E6F1** | elválasztó vonalak |
| `kek` / `--kek` | #2A55B5 | **#1428DB** | „+ Fájl hozzáadása” |
| `fulAktiv` / `--ful-aktiv` | #17284A / #2450C0 | **#1428DB** | aktív fül |
| `szegmensFelirat` (app) | #D0D8E6 | **#D3DAFB** | szegmensválasztó inaktív felirata a sávon |
| árnyék | rgba(23,40,74,…) | **rgba(16,21,60,…)** (#10153C) | papír- és lebegő árnyék – sötét tengerészkék, NEM a márkakék (különben kéken derengene) |
| panel `.gomb-e:hover` | #0F1D38 | **#0E1FAE** | elsődleges gomb fölött |
| app: a mostani hónap oszlopa | #8B97B0 | **#7C89E4** | „a világosabb oszlop a mostani hónap” (3,2:1 a fehéren) |

**Nem változott:** `tollkek` #2546A6 (a könyvelő aláírása fehér papíron), `mezoKeret` #7D879B, `mezoAlap` #F5F7FA,
`nyomott` #EEF1F6, `papir` #F4EFE4, `veszely` #B42318 (piros), `borostyan` #845300 / `borostyanAlap` #F7E8C6 (a „még 3
nap” címkék), `kesz` #7A62D9 (az ibolya „kész” pecsét), `kamera` #0F1B33, a sötét fotónéző (#0D1628), a függöny.

## Mért kontrasztok (WCAG 2.x, relatív fénysűrűség)

| Előtér | Háttér | Arány | Követelmény |
|---|---|---|---|
| fehér | #1428DB (sáv, fő gomb, saját buborék) | **8,91:1** | AA/AAA szöveg ✓ |
| #C9D2FF (másodlagos szöveg a sávon) | #1428DB | **6,00:1** | AA ✓ |
| #D3DAFB (inaktív szegmens) | #1428DB | **6,45:1** | AA ✓ |
| #F7E8C6 (borostyán címke alapja) | #1428DB | 7,35:1 | elkülönül ✓ |
| #1428DB (aktív fül, link-szerű szöveg) | fehér | **8,91:1** | AAA ✓ |
| #1428DB | #E4E8F3 (alap) | 7,27:1 | AAA ✓ |
| #1226B8 (másodlagos gomb felirata) | #DFE4FD | **8,35:1** | AAA ✓ |
| #1226B8 (link) | fehér / alap | 10,53 / 8,59:1 | AAA ✓ |
| #10152B (szöveg) | fehér / alap | **18,04 / 14,72:1** | AAA ✓ |
| #505873 (másodlagos) | fehér / alap | **7,04 / 5,74:1** | AA ✓ |
| #4A5270 (másodlagos az alapon) | #E4E8F3 | 6,27:1 | AA ✓ |
| #7D879B (mező kerete) | fehér | 3,61:1 | nem szöveges elem ≥ 3:1 ✓ |
| #7C89E4 (mostani hónap oszlopa) | fehér | 3,20:1 | grafika ≥ 3:1 ✓ |
| fehér | #0E1FAE (panel gomb hover) | 11,50:1 | ✓ |
| #845300 / #5E3B00 | #F7E8C6 | 5,38 / 8,24:1 | AA ✓ (változatlan) |
| #B42318 (piros) | fehér | 6,57:1 | AA ✓ (változatlan) |
| #7A62D9 (ibolya pecsét) | fehér | 4,59:1 | grafika ✓ (változatlan) |
| fehér lap | #E4E8F3 alap | 1,23:1 | a jóváhagyott minta szerint (a régi 1,29); a lapokat a forma és az árnyék választja el |

Összevetésül a régi: fehér a tintakéken 14,60:1, #B4C0D6 a tintakéken 7,96:1. Minden szövegpár AA felett maradt.

**Hunyorítás-próba** (PIL GaussianBlur 6, `kod/_qa/kek_squint_*.png`): a sáv, a fő gomb, a fehér lapok és az alsó fülsor
elmosva is egyértelmű sorrendet ad; semmi fontos nem olvad bele a környezetébe.

## Mi hol változott (11-18 este)

- **Ügyfél-app** (`kod/app`): `src/theme/tokens.ts` + a kézzel írt színek (fotónéző Bezár gombja, saját buborék linkje,
  szaggatott keretek, talajárnyék, push-értesítés színe, webes külső háttér #CCD2E4); aktív fül aláhúzása 24×4 pt,
  Fotózás-gyűrű 3 pt; a videó-kártya bélyegképe 1,5 pt-os fehér (45%) keretet kapott, mert a kék poszter a kék
  kártyán különben beleolvadt. `app.config.ts`: indítókép, adaptív ikon háttere, értesítés színe #1428DB, alap #E4E8F3.
  App-ikon, adaptív előtér, favicon, indítókép újrarajzolva (`scripts/eszkozok.mjs`), `android/` újragenerálva
  (`expo prebuild`).
- **Panel** (`kod/panel`): `src/styles/tokens.css`, `app.css` (hover, letiltott, szegmens, info-sáv, kijelölt sor,
  fülek: inaktív = `--fejlec-halvany`, aktív aláhúzás 4 px), logó (`src/ui/kozos.tsx`), favicon, 2FA-QR sötét színe.
- **E-mail sablon** (`backend/src/notify/mailer.ts`): kék felső csík, #E4E8F3 háttér, #10152B szöveg.
  **DEMO fizetési oldal** (`backend/src/routes/public.ts`): kék gombok. **Backend PDF-ek** (`backend/src/lib/pdf.ts`):
  szöveg #10152B, másodlagos #505873.
- **Jogi PDF-ek** (`kod/jogi/src/pdf.ts`): kék fejlécsáv és címek; `pdf_minta/` újragenerálva (33 teszt zöld).
- **Jelölt NAV-képek** (`utmutato_kepek/annotate.py`): kék jelölőkeret, számkorong, nyíl; az árnyék sötét tengerészkék;
  a tömör keret belül **fehér hajszálvonalat** kapott, mert a #1428DB a NAV saját sötétkék gombjaival (pl. „TOVÁBB”)
  szinte azonos világosságú (1,05:1) – a fehér vonal választja el. Mind a 34 kép újrajelölve, az app jegyzéke
  (`kod/media/utmutato/`) frissítve.
- **Videók** (TTS-költés nélkül, a meglévő időzítéssel, némán, mint eddig): `video/bekotes/remotion/src/elemek.tsx`
  és `video/vallalkozas_bejelentes/eszkoz/kozos.py` (+ `render.py`, `kepek.py`) tokenjei; mindhárom videó, poszter és
  felirat újrarenderelve, másolatuk `kod/media/`-ban, `videok.json` frissítve.

Régi értékek: `kod/_regi/szinvaltas_kek_elotte_1817/`, `video/bekotes/_regi/remotion_src_elotte_kek_1817/`,
`video/bekotes/_regi/kimenet_elotte_kek_1817/`, `video/vallalkozas_bejelentes/_regi/eszkoz_elotte_kek_1817/`,
`utmutato_kepek/_regi/annotate.py_elotte_kek_1817` (a régi képek: `utmutato_kepek/_regi/`, `kod/media/utmutato/_regi/`).

## Szabályok a további munkához

1. Új színt ne írj kézzel: a tokenekből dolgozz (`tintakek` = #1428DB).
2. Árnyékhoz soha ne a márkakéket használd, hanem rgba(16,21,60,…).
3. Kék felületen ülő kék kép/poszter kapjon halvány fehér keretet; kék jelölés kék gombon belső fehér vonallal.
4. A piros, a borostyán és az ibolya „kész” pecsét marad – a kék mellett a pecsét ✓-jele és a „Kész” szó is jelzi az
   állapotot (a két szín világossága közel van: 1,94:1).
