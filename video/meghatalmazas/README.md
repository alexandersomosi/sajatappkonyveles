# Útmutató-videó: NAV-meghatalmazás (SPEC §26.7, tulaj-kérés 8)

60–100 s, függőleges, a meghatalmazás-útmutató tetején. A szöveg: `forgatokonyv.json`. A motor és a leírás a
bejelentés-videó mappájában van: `../vallalkozas_bejelentes/README.md`, `../vallalkozas_bejelentes/eszkoz/`.

```
python C:/Users/UpgradePC/konyvelo_app/video/vallalkozas_bejelentes/eszkoz/epit.py meghatalmazas          # hanggal
python C:/Users/UpgradePC/konyvelo_app/video/vallalkozas_bejelentes/eszkoz/epit.py meghatalmazas --nema   # hang nélkül
```

A képek a 16 valódi NAV-képernyőből jönnek (`utmutato_kepek/meghatalmazas/`). A videó 15-öt mutat (01–15): a 10-es
(Képviselt) benne van, a 16-os (lista) kimarad, mert az app-lépés lefedi. Költségnapló: `koltseg.jsonl`. A régi kimenetek a
`_regi/` mappában vannak.

**Állapot (2026-11-19, a független ellenőrzés utáni javító kör):** KÉSZ, narrálva a végleges közös hanggal (Umbriel):
97,4 s, 13,82 MB, BT.709 (a sáv #1428DB-nek dekódolódik), -16,3 LUFS, a csúcs -2,2 dBTP a kész fájlban. A `hang/`
mappában a valódi felvételek vannak (soronként, `hang/takek/` minden take-kel, `hang/VAK.md` a vak ellenőrzéssel: mind a
21 sor rendben). A részletek a bejelentés-videó README-jében.

Ami a javító körben változott (a régi: `_regi/forgatokonyv_elotte_javitas_20261119_0700.json`, `_regi/kimenet_*`):
- **Jelölések ideje:** az „adóügyek” jelölése (m18) a mondat elejétől 2,9 s-ig látszik (eddig 0,6 s); „Tovább” (m10) 1,5 s,
  „Ezeket ne jelöld” (m19) 1,3 s, „Koppints: Tovább” (m20) 1,4 s, „Szervezet: hagyd üresen” (m12) 1,2 s – a kész fájlban mérve.
- **Levágott szöveg a NAV-képeken:** a 08, 10, 11, 12, 13, 14 kép újrajelölve (`utmutato_kepek/README.md`): a keret már
  nem lóg rá a feliratokra („Képviselt”, „Képviseleti jogosultság kezdete”, „ADÓÜGYEK”, „Egyéni vállalkozói…”), a
  „Meghatalmazás benyújtása!” ablak „Ha folytatja, …” sora egészben látszik (a NAV saját ábrája volt levágva; a
  forráskép kiegészítve), és az 1. jelölés kerete nem takarja.
- **Olvashatóság telefonon:** szorosabb nézet a felugró ablak két választógombjára, a „Szervezet” és a „Képviselt”
  rovatra, a dátummezőkre és az ügycsoportokra; a nézet széle mindenhol két mező / két szó közé esik (nincs félbevágott
  felirat vagy gomb). A két párbeszédablak (14, 15) teljes szélességben marad: a soraik a kép teljes szélességét kitöltik.
- **Hang:** a sorok eleji kattanás levágva (m04, m08, m16, m21 – és az üres felvezetés az m14-ben); az m04 új felvétel
  (t2: a régiben a vak ellenőrzés „Nézd meg”-et hallott a „Nyisd meg” helyett). A felirat 0,05–0,15 s-mal a hang előtt jár.
- **Felirat = hang:** m09 „Nyisd le a Meghatalmazásokat, …” (eddig a felirat „»Meghatalmazások« csoportot” volt).

**2. javító kör (2026-11-19 délelőtt) – a MOSTANI állapot:** 97,3 s, 14,08 MB, mono, csatornánként -16,3 LUFS, a csúcs -2,2 dBTP.
A régi: `_regi/forgatokonyv_elotte_r2_20261119_r2.json`, `_regi/kimenet_*`. Ami változott:
- **Profil (m07):** az 1. jelölés korongja a keret FÖLÖTT van (a 03-as kép újrajelölve), nem takarja a „Hátralévő idő”
  feliratot; a nézet a homokórától a lap jobb széléig tart (a csengő és a kilépés ikonja egészben).
- **Új nyomtatvány (m08–m09):** a csempe nézete nem vágja félbe a „Főoldal” szót; a „Meghatalmazások” sor kerete a sor
  bal részét fogja körbe (05-ös kép újrajelölve), a nézetben a keret és az UJEGYKE leírása egészben látszik; a
  „Kiválaszt” gombnál a korábbi jelölés eltűnik (nincs üres keret a kép tetején).
- **Meghatalmazó (m10):** a választógomb kerete csak a gombot és a feliratát fogja körbe (06-os kép újrajelölve); a nézet
  jobb széle a fenti mondat két szava közé esik; a „Tovább” közelijében nincs üres borostyán sáv.
- **A könyvelőd adatai (m12–m16):** az 1. jelölés kerete és a két mező egészben (a nézet széle a mezők és az EORI-rovat
  közé esik), a „Szervezet” és a jogcímlista a kép teljes szélességében (a lista hosszú sorai így nem vágódnak félbe –
  kisebb betűvel, de egészben), a „Képviselt” kerete is egészben.
- **Benyújtás (m20–m21):** a két párbeszédablak ikonjának köre teljes (`utmutato_kepek/_eszkoz/ikon_teljes.py`); az
  „Ellenőrzés és benyújtás” gombról nincs kép (a belépés nélküli nézetben más gomb áll ott), ezért a mondat elején
  szám nélküli pirula mondja meg, hol van („Az űrlap alján: „Ellenőrzés és benyújtás””), az 1. jelölés a „gombra”
  szónál jön „Ezután ezt látod: nincs hiba” felirattal.
- **Felirat:** „A vegyes ügyeknél jelöld / az egyéni vállalkozói nyilvántartást is.” és külön „A többit ne.”; a többi
  sor is a mondat tagolása szerint törik (`../felirat_tores.py`).
- **Hang:** az m03 eleji kattanása levágva; új felvétel nem készült. A részletek a bejelentés-videó README-jében.

**Tulaj-kérések 11-19 délután – a MOSTANI állapot (élesben 14:18 óta):** 98,0 s, 14,06 MB, mono, -16,2 LUFS, csúcs -2,0 dBTP.
Új m26 „Ha egyedül nem megy, megcsináljuk helyetted: te csak jóváhagyod.” (3. kérés) + kiemelt „Megcsináljuk helyetted”
kártya a záróképen (fehér lap márkakék kerettel, „Ha egyedül nem megy” jelvény, „Te csak jóváhagyod az ONYA-ban.”); az m03
kimaradt (a 100 s-os sáv miatt). Új felvétel csak az m26 (első take, 3 vak átirat hibátlan, 0,0020 USD). A régi:
`_regi/forgatokonyv_elotte_20261119_tulaj1119.json`. Részletek: `../vallalkozas_bejelentes/README.md`.

**11-19 javító kör (16:00 körül):** az m26 újravéve („Ha egyedül nem megy, megcsináljuk helyetted: te csak jóváhagyod.”,
t2, kb. 127 Hz a korábbi kb. 154 Hz helyett; 0,0020 USD). A videó **99,3 s** (a 60–100 s-os sáv felső szélén, 0,7 s
tartalékkal), 14,0 MB, közeli vágással a záróképen.

**11-19 javító kör 2 (este; új hangfelvétel NINCS, 0 USD):** az m11 („Lent koppints az Új bejelentés gombra.”) nézete
közelebb áll a gombsorhoz (`nezet` + `skala 1,45`), hogy ne a nagy, elmosott minta-lista töltse ki a képet. Újrarenderelve a
meglévő hanggal (`utmutato_kepek/_eszkoz/video_ujra.py`): 99,3 s, `ellenoriz.py` RENDBEN. A régi forgatókönyv:
`_regi/javito2_1119/forgatokonyv.json`.
