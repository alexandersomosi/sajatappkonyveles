# kod/shared/v2 – az Adózz.hu v2 közös dizájn-alapja (ALAP-D, k8)

Egy forrás, két célplatform: a tulaj által 11-20/21-én jóváhagyott v2 dizájn (dizajn/C5_v2) tokenjei, ikonjai és
alapelemei az ügyfél-apphoz (React Native: telefon + app.adozz.hu web) és a panelhez (webes React: könyvelői felület +
konzol). A platformfüggetlen rész (`*.ts`, React nélkül) mindkét helyen fordul; a komponensek külön `rn/` és `web/` mappában.

**Az export-lista (lent) a k8 F1 végén FAGYASZTVA.** A FELÜLET-A és -P ebből dolgozik, a `kod/shared/v2/`-t nem írja;
új ikon/token kérése: `_munka/k8/v2_keres.md` (D-utókör vagy az integrátor végzi).

## Szerkezet

```
index.ts               platformfüggetlen exportok (tokenek, ikonadatok, nevek, megfeleltetés, logóméret)
tokenek.ts             szín, gradiens, sugár, térköz, elrendezés, árnyék, betű, tipográfia, csempe, ikonméret, nav, mozgás, töréspont, fókusz, kontraszt
ikon/tipusok.ts        IkonElem, IkonAdat, VezerloAdat, IkonValtozat
ikon/emoji-adat.ts     GENERÁLT – 45 Fluent Emoji Flat rajz (KOZEPRE-val), SZURKE_TABLA, VILAGOS_TABLA
ikon/material.ts       GENERÁLT – 20 vezérlő-ikon (Material Icons + saját chev), GOOGLE_G
ikon/kozepre.ts        a KOZEPRE-táblázat (viewBox-eltolás), küszöb, forrás; ikon/kozepre.json (GENERÁLT, CommonJS-nek)
ikon/kozep-meres.json  GENERÁLT – Chrome getBBox()-mérés mind a 45 ikonra (eredeti és javított)
ikon/nevek.ts          NAV_IKONOK (az app öt füle)
ikon/megfeleltetes.ts  régi 3D ikon / tárgykép → új ikon (IKON3D_UJ, TARGYKEP_UJ), javasoltCsempe()
logo/                  logo.png, logo_feher.png (4×, 30 px-es betűre), meret.ts (LOGO_KEP, logoMeret, LOGO_ALT)
rn/                    Ikon, VezerloIkon, Csempe, Kartya, Logo, GoogleG, a11yKep  (react-native + react-native-svg 15)
web/                   Ikon, VezerloIkon, Csempe, Kartya, Logo, GoogleG + v2.css (GENERÁLT)
scripts/               gen-ikonok.mjs, meres-kozep.mjs, gen-css.mjs, gen-minta.mjs, logo-kep.cjs, sync-v2.mjs, ellenoriz.mjs
teszt/                 v2.test.mjs (+ utvonal.mjs: útvonal-elemző és befoglaló doboz, forditas.mjs: komponens-betöltő)
minta/ikonok.html/.png GENERÁLT ikon-katalógus szemrevételezéshez (csempében 36/42/64, szürke és világos változat, színek, logó)
tsconfig.rn.json, tsconfig.web.json   típusellenőrzés az app, ill. a panel node_modules-ával (csak olvasva)
LICENCEK.md, licencek/ Fluent Emoji (MIT), Material Icons (Apache-2.0), Geist (OFL 1.1)
```

## Bekötés (FELÜLET-A / -P végzi, ez a mappa nem nyúl az apphoz és a panelhez)

A fogyasztó MÁSOLATOT kap (mint a `sync-shared.mjs`-nél): a Metro és a Vite a csomagon kívülre nem lát jól.
A másolat a meglévő `src/_shared/` alá kerül, így a forrás-szkennelő tesztek (amelyek a `_shared`-et kihagyják) nem látják.

- **App** (`kod/app/package.json`, `shared` szkript – így a `start`, `web`, `export:web` is mindig friss másolatot kap):
  `node ../shared/scripts/sync-shared.mjs src/_shared && node ../shared/v2/scripts/sync-v2.mjs src/_shared/v2 --rn && node scripts/jogi-szovegek.mjs`
- **Panel** (`kod/panel/package.json`, `sync` szkript – a `predev`/`prebuild` futtatja):
  `node ../shared/scripts/sync-shared.mjs src/_shared && node ../shared/v2/scripts/sync-v2.mjs src/_shared/v2 --web && node scripts/sync-assets.mjs`
  és a `src/main.tsx`-ben az `app.css` ELŐTT: `import './_shared/v2/web/v2.css';`

A `kod/shared/package.json`-t és `tsconfig.json`-t a v2 nem változtatja (nem kell): a v2-nek saját tsconfigja van, a
meglévő `npm run typecheck` továbbra is csak a `src/**/*.ts`-t nézi.

## Használat – app (React Native)

```tsx
import { Text, View } from 'react-native';
import { Csempe, Ikon, Kartya, Logo, VezerloIkon, betu, sorMagassag, szin, tipo } from '@/_shared/v2/rn';

<Logo meret={28} feher />                          {/* a kék fejlécben; felolvasó: „Adózz.hu” */}
<Kartya sor>                                        {/* fehér, r 20, kártyaárnyék; sor = csempe + szöveg egy sorban */}
  <Csempe nev="dosszie" />                          {/* #F1F3F9, 42-es csempe, 34-es ikon, díszítés (rejtett) */}
  <View style={{ flex: 1 }}>
    <Text style={{ fontFamily: betu.rn(tipo.kartyaCim.suly), fontSize: tipo.kartyaCim.meret,
                   lineHeight: sorMagassag(tipo.kartyaCim), color: szin.sotet }}>Dosszié</Text>
  </View>
  <VezerloIkon nev="chev" pt={18} szin={szin.dekorNyil} />
</Kartya>
<Ikon nev="fiok" pt={28} />                         {/* alsó sáv: MINDEN ikon színes, 28 pt */}
<Ikon nev="naptar" pt={20} valtozat="szurke" style={{ opacity: 0.6 }} />   {/* beviteli mezőben */}
```

A nevek típusosak: tartalmi ikon csak `EmojiNev`, vezérlő csak `VezerloNev` lehet (pl. a `kereses` vezérlő, `<Ikon nev="kereses" />`
fordítási hiba – helyesen `<VezerloIkon nev="kereses" />`).

## Használat – panel (webes React)

```tsx
import { Csempe, GoogleG, Kartya, Logo, VezerloIkon } from '../_shared/v2/web';

<Logo meret={30} />                                 {/* <img alt="Adózz.hu" width=138 …> */}
<Kartya as="section" sor aria-labelledby="h-hatarido">
  <Csempe nev="naptar" />
  <div><h2 id="h-hatarido" className="v2-kartya-cim">Határidők</h2></div>
</Kartya>
<Kartya asztali racsban jelzo="var(--v2-narancs)">…</Kartya>   {/* figyelmeztetés: telt bal sáv, NEM pasztell doboz */}
<button className="v2-gomb">Elküldöm</button>                    {/* sárga főgomb – képernyőnként legfeljebb egy */}
<button className="v2-gomb-masod"><VezerloIkon nev="masol" pt={20} />Másolom</button>
<button className="v2-gomb-masod"><GoogleG />Belépés Google-lel</button>
<span className="v2-cimke v2-cimke-var">Vár</span>
```

A régi ikonhívások átállítása egy helyen (A0: `src/ui/kepek.tsx` `Ikon3d`/`Targykep`; P1: `src/ui/Icon3d.tsx` `I3`),
az aláírás marad:

```tsx
import { IKON3D_UJ, TARGYKEP_UJ, javasoltCsempe } from '../_shared/v2/web';   // appban: '@/_shared/v2/rn'
const uj = IKON3D_UJ[n];                    // n: a régi név (Ikon3dNev / Icon3dName)
return uj.fajta === 'emoji' ? <Ikon nev={uj.nev} pt={s} label={alt || undefined} /> : <VezerloIkon nev={uj.nev} pt={s} label={alt || undefined} />;
// tárgykép: <Csempe nev={TARGYKEP_UJ[nev]} meret="nagy" />;  csempébe tett régi ikon: <Csempe nev={…} meret={javasoltCsempe(s)} />
```

## Exportok (FAGYASZTVA)

**Platformfüggetlen** (`index.ts`, és az `rn/index.ts` meg a `web/index.ts` is továbbadja):
- tokenek: `szin` (+ `SzinNev`), `fejGradiens`, `sugar`, `ter`, `elrendezes`, `arnyek` (`.css` és `.rn`), `betu` (`web`, `rn(suly)`, `sulyok`),
  `Suly`, `SzovegStilus`, `tipo`, `sorMagassag()`, `betukozPt()`, `csempe`, `CsempeMeret`, `ikonMeret`, `nav`, `mozgas`, `torespont`, `fokusz`,
  `fenysuruseg()`, `kontraszt()`, `KONTRASZT_PAROK`
- ikonok: `EMOJI_NEVEK`, `EmojiNev`, `EMOJI_ADAT`, `SZURKE_TABLA`, `VILAGOS_TABLA`, `VEZERLO_NEVEK`, `VezerloNev`, `VEZERLO_VB`, `VEZERLO_ADAT`,
  `GOOGLE_G`, `IkonElem`, `IkonAdat`, `VezerloAdat`, `IkonValtozat`, `KOZEPRE`, `KOZEPRE_KUSZOB`, `NAV_IKONOK`
- megfeleltetés: `IKON3D_UJ`, `RegiIkonNev`, `TARGYKEP_UJ`, `RegiTargykepNev`, `UjIkon`, `javasoltCsempe()`
- logó: `LOGO_KEP`, `logoMeret()`, `LOGO_ALT`

**React Native** (`rn/index.ts`): `Ikon` (`nev`, `pt`=34, `label?`, `valtozat?`, `style?`), `SvgRajz`, `VezerloIkon` (`nev`, `pt`=24, `szin`=sötét,
`label?`), `Csempe` (`nev`, `meret`='alap'|'kicsi'|'nagy', `label?`, `valtozat?`), `csempeStilus()`, `Kartya` (`asztali?`, `sor?`, `tomor?`,
`margo`=true, `jelzo?` + View-propok), `kartyaStilus()`, `Logo` (`meret`=30, `feher?`, `label?`), `GoogleG` (`pt`=20), `a11yKep()`; típusok:
`IkonProps`, `VezerloIkonProps`, `CsempeProps`, `KartyaProps`, `KartyaOpciok`, `LogoProps`, `A11yKepProps`.

**Web** (`web/index.ts`): `Ikon` (`nev`, `pt`=34, `label?`, `valtozat?`, `className?`, `style?`), `SvgRajz`, `svgA11y()`, `VezerloIkon` (`nev`,
`pt`=24, `szin`=currentColor, `label?`), `Csempe` (`nev`, `meret`, `label?`, `valtozat?`), `Kartya` (`as`='div', `asztali?`, `sor?`, `tomor?`,
`racsban?`, `jelzo?` + HTML-propok), `kartyaOsztaly()`, `Logo` (`meret`=30, `feher?`, `alt`='Adózz.hu'), `GoogleG` (`pt`=20); típusok: `IkonProps`,
`SvgA11y`, `VezerloIkonProps`, `CsempeProps`, `KartyaProps`, `LogoProps`.
**web/v2.css:** `--v2-<szín>` (pl. `--v2-kek`, `--v2-kek-vil`, `--v2-szurke`), `--v2-fej-gradiens`, `--v2-r-<sugár>`, `--v2-t1…t11`,
`--v2-arnyek-<név>`, `--v2-betu`, `--v2-mozgas-*`, `--v2-gorbe`; osztályok: `.v2-kartya` (+`-sor`, `-tomor`, `-asztali`, `-racsban`),
`.v2-kartya-cim`, `.v2-ikon`, `.v2-vezerlo`, `.v2-csempe` (+`-kicsi`, `-nagy`), `.v2-logo`, `.v2-gomb`, `.v2-gomb-masod`, `.v2-gomb-veszely`,
`.v2-gomb-kis` (+`.v2-gomb-kis-masod`), `.v2-link`, `.v2-cimke` (+`-ok`, `-var`, `-hiba`, `-info`, `-szurke`), `.v2-szakasz-cim`,
`.v2-szoveg2`, `.v2-masodlagos`, `.v2-betu`, `.v2-pont`, `.v2-fokusz`. Globális reset nincs.

**Ikonnevek.** Tartalmi (45): fooldal, dosszie, kamera, uzenet, fiok, csengo, telefon, naptar, naptar-sz, irat, irat-toll, lakat, level, pipa-kor,
info, figyelem, kerdes, pajzs, kartya, nyugta, feltolt, ora, beallitas, kilep, epulet, igazolvany, toll, emberek, cimke, valtozas, kuka, bank,
jogi, kep, vaku, kulcs, mobil, lejatszas, kerdoiv, emelkedes, oszlop, oszlopok, tarca, buborek, szamologep.
Vezérlő (20): vissza, bezar, plusz, kuld, letolt, szem, pipa, kereses, gemkapocs, csillag, zaszlo, chev, chev-le, chev-fel, chev-bal,
masol, kulso, frissit, szuro, tobb.

## Szabályok, amelyeket az alap betart (és a felületeknek is kell)

- **Akadálymentesség:** címke nélkül minden ikon díszítés (RN: `aria-hidden`; web: `aria-hidden="true" focusable="false"`), címkével
  `role="img"` + `aria-label`. A logó felolvasói neve „Adózz.hu”. Fókusz (web): 2 px #1428DB körvonal, 2 px eltolás (`.v2-fokusz`, gombok, link).
  Érintési cél ≥ 44 pt (`elrendezes.erintesiCel`). Szöveg csak a `KONTRASZT_PAROK` párjaival – mind ≥ 4,5:1 (nagy szöveg, nem-szöveg ≥ 3:1).
  A v2.css `--halvany` #8A93A8 (fehéren 3,08:1) csak `szin.dekorHalvany` néven van meg, szövegre nem való; az inaktív fül-felirat `#5B6478`.
- **Nincs nagy, halvány pasztell doboz:** a `Kartya` mindig tiszta fehér; kiemelés `jelzo` (4 px telt bal sáv) vagy színes ikon.
  A világos jelzőszínek (`zoldVil`, `narancsVil`, `pirosVil`, `kekVil`) csak kis címkére és aktív menüelemre valók.
- **Ikon:** a tartalmi ikon csempében mindig a semleges #F1F3F9-en (a minta `.t-*` színes csempéit a 11-20-i döntés felülírta).
- **Mozgás** (`mozgas`): csak az ügyfél-appban; panelben és konzolban nincs.

## KOZEPRE (ikonok a csempe közepén)

Mérés: `node scripts/meres-kozep.mjs` (Chrome getBBox, mind a 45 ikon) → `ikon/kozep-meres.json`. Szabály: ahol a rajz közepe ≥ 0,75
egységgel tér el a 32×32-es mező közepétől, a viewBox a mért eltéréssel tolódik (`ikon/kozepre.ts`). A landing (epit.cjs) öt sora
(igazolvany, kamera, emberek, cimke, irat-toll) változatlanul benne van; a 11-21-i újramérés még négyet talált: **kartya** (dy +5),
**figyelem** (dy +1,3), **dosszie** (dy +1), **fiok** (dx −1). A javítás után minden ikon eltérése < 1 egység, a táblázatbelieké < 0,01
(Chrome és a teszt saját számítása szerint is). A landing majd a `ikon/kozepre.json`-ra állhat át (integrátor; az élő landinghoz most nem nyúltunk).

## Parancsok

```
node kod/shared/v2/scripts/ellenoriz.mjs        # minden egyben: generált fájlok naprakészek + teszt + tsc (RN, web) – 0 = zöld
node --test kod/shared/v2/teszt/v2.test.mjs      # csak a teszt (Node ≥ 22.18 / 23.6; a mappát a Node 23 nem fogadja el, a fájlt kell megadni)
node kod/shared/v2/scripts/gen-ikonok.mjs        # ikonadat újragenerálása a dizajn/C5_v2/v2.js-ből (+ KOZEPRE)
node kod/shared/v2/scripts/meres-kozep.mjs       # KOZEPRE-mérés Chrome-mal → ikon/kozep-meres.json
node kod/shared/v2/scripts/gen-css.mjs           # web/v2.css a tokenek.ts-ből
node kod/shared/v2/scripts/gen-minta.mjs --kep   # minta/ikonok.html + .png
node kod/shared/v2/scripts/logo-kep.cjs          # logó újragyártása (csak ha a logó változik; a Poppint a Google Fonts adja)
node ../shared/v2/scripts/sync-v2.mjs src/_shared/v2 --rn|--web    # másolat a fogyasztóba (az app/panel mappájából)
```

Tokent, ikont mindig itt változtass, utána: gen-ikonok / gen-css → meres-kozep (ha ikon változott) → gen-minta → ellenoriz → a fogyasztókban sync.

## Jegyzet a k8-hoz (D) – eltérések a tervtől, nyitott pontok

- **Logó:** egyetlen 4×-es kép (nem @1x/@2x/@3x): az Expo webes exportja csak az alapfájlt hivatkozza, így a 4× mindenhol éles
  (38 px-es betűig 3×-os kijelzőn is). A `logo-kep.cjs` a landing `logo_kep.cjs` módszerével, 4× felbontásban gyártotta.
- **chev-le / chev-fel / chev-bal:** a saját `chev` vonalas rajzának elforgatottjai (nem a Material expand_more), hogy a lenyíló és a
  sor-nyíl egyforma legyen.
- **Megfeleltetés:** `videohivas_laptop` → `telefon` (laptop-rajz nincs a készletben); `hataridok`/`tepnaptar` → `naptar` a terv szerint
  (a minták határidő-kártyáin a narancs `naptar-sz` is előfordul – a felület képernyőnként dönthet).
- **Árnyék RN-ben:** a `Kartya` a `boxShadow`-t használja (RN 0.88, react-native-web 0.21); Android 9 alatt ez nem látszik – ott az
  `arnyek.*.rn` tartalék tehető (egy elemre csak az egyik).
- **web/Csempe, web/Kartya** a v2.css osztályaival méretez – a panelben a `v2.css` betöltése kötelező (P0).
- **Nyitott, szemrevételezésre:** a `figyelem` háromszög a befoglaló doboz szerint került középre (1,3 egységgel feljebb); a katalógus
  (minta/ikonok.png) szerint rendben van, de ha a tulaj „fent ülőnek” látja, a táblázatból kivehető (akkor a teszt küszöbét is igazítani kell).
- **SPEC-javaslat (integrátor):** a SPEC §3.2 („shared”) mellé: „kod/shared/v2 – a v2 dizájn-alap (tokenek, Fluent/Material ikonok,
  Csempe, Kártya, logó); másolat: scripts/sync-v2.mjs `--rn` (app) / `--web` (panel), a `src/_shared/v2/` alá; licencek: v2/LICENCEK.md”.
