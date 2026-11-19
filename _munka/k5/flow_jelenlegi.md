# A bekötés jelenlegi folyamata (felmérés, 2026-11-19)

Mit néztem: a helyi harnessen (valódi backend, DEMO mód, PGlite memóriában, demo seed + 11-18-as kiegészítés; az app
éles webes buildje), 390×844 @2x, fej nélküli Chrome, három kitalált személy szemével. Kódot nem változtattam.
Minden kép: `C:/Users/UpgradePC/konyvelo_app/_munka/k5/felmeres/` (196 kép; `_g1`, `_g2` … = ugyanaz a képernyő lejjebb görgetve).

- Backend: `kod/backend` mostani forrásából fordítva egy saját pillanatképbe (a közös `dist/` érintetlen); app: a `kod/app/dist`
  (07:53-as éles export, a forrásnál nem régebbi) másolata. Harness: `scripts/jav1/harness.mjs` másolata, 8871/8872-es port.
- Személyek: **P1 Marika** (52, első vállalkozás, lassan olvas) – a regisztrációtól a „csak a számlák bekötése van hátra”
  állapotig; **P2 Dávid** (már EV, könyvelőt vált) – a szerződésig; **P3 Peti** (véletlenül „Még nincs”, majd vissza, majd fordítva).
- A DEMO kártyás fizetés a helyi http-címen nem fut végig („Érvénytelen fizetési cím”, `src/lib/simplepay.ts:20` https-t vár) –
  ez a harness sajátja, nem termékhiba.

## 1. Áttekintő térkép

```
Belépés ─► Regisztráció ─► E-mail-kód ─► FŐOLDAL (bekötés)
                                           │  „Van már egyéni vállalkozásod?”  (csak amíg business_status = NULL)
                                           │  + alatta MÁR OTT a „Most ez jön · Adataid – Kitöltöm” (a „van” út űrlapja!)
                   ┌───────────────────────┴───────────────────────┐
           „Igen, van” (van)                               „Még nincs, most indítanám” (inditas)
                   │                                               │
   Adataid 3 lap (adószámmal) ──┐                     Rólad (1 lap) ─► Vállalkozás-központ („Készítsd elő” 8 tétel)
   Szerződés (3 irat)           │                                   ─► Adatlap 1–5 ─► „Kérem az útmutatót”
   Előfizetés (bármikor nyitva) │                                   ─► [VÁR: tevékenység sora, csapat, ~1 munkanap]
   NAV-meghatalmazás (szerződés │                                   ─► Útmutató 14 lépés (NAV Vállalkozói Ügysegéd, kívül)
     után nyílik)               │                                   ─► Igazolás feltöltése (PDF/fotó)
   Igazolványok (KYC)           │                                   ─► [VÁR: csapat átnézi, ~1 munkanap]
                                │                                   ─► [VÁR: adószám a NAV-tól – idő nincs megadva]
                                │                                   ─► adószám beírása ─► „Elindult a vállalkozásod!”
                                │                                       (+ kamarai regisztráció 5 munkanapon belül – csak megjegyzés)
                                │                                   ─► Szerződés ─► Meghatalmazás ─► Igazolványok ─► Előfizetés
                                └──────────────► közös vég ◄────────┘
   [VÁR: Bence átnézi a KYC-t ~1 munkanap] [VÁR: meghatalmazás – Bence ellenőrzi 1–2 munkanap, vagy Bence beküldi → ügyfél
   4 napon belül jóváhagyja az ONYA-ban] [VÁR: számlák bekötése – Bence, idő nincs megadva] ─► lifecycle = aktív, rendes Főoldal
```

Visszaváltás: inditas → van: (a) piros „Leállítom a bejelentést” a központ alján + ok-választó lap → business_status = NULL,
a kérdés újra megjelenik; (b) „Mégis van vállalkozásom” link az adatlap 1. lapján (csak a „Rólad” kitöltése után érhető el).
van → inditas: **a felületen sehol** (csak visszahívás). Részletek: 4. pont.

## 2. Lépésenként

Jelölés: **ki lép** (Ü = ügyfél, Cs = csapat/admin, B = könyvelő, NAV = külső), koppintás ≈ gombnyomás (gépelés nélkül), képek.

| # | Képernyő / útvonal | Ki | Koppintás | Mit lát, mit kell tennie | Képek |
|---|---|---|---|---|---|
| 0 | `/belepes` | Ü | 1 | „Még nem vagy ügyfél? Pár perc, és bekötünk. Regisztrálok” | p1_01 |
| 1 | `/regisztracio` | Ü | 1 (+4 mező) | név, e-mail, jelszó, ajánlókód; „Egyéni vállalkozóknak, havi 20 000 Ft” | p1_02, p1_03 |
| 2 | `/email-megerosites` | Ü | 1 (+kód) | 6 jegyű kód (DEMO: postafiók a panelben) | p1_04 |
| 3 | `/bekotes` (Főoldal, kérdés nyitva) | Ü | 1 | sáv „Még 4 dolog kell tőled” (fülsor-jelvény: 5); videó kártya; **„Van már egyéni vállalkozásod?”** 2 válasz; alatta „Most ez jön · Adataid – Név, adószám… – Kitöltöm”; „A lépések” 7 sor (Adataid, Szerződés, Igazolványok „Most te jössz”; Előfizetés zárva „Előbb válaszolj…”; Meghatalmazás zárva); „Hol tartunk” 5 pont (1. „Add meg a meghatalmazást”); visszahívás-kártya | p1_05–p1_08, „Mi ez?” p1_09, videó p1_10 |
| 3x | ugyanitt „Kitöltöm” a kérdés megválaszolása NÉLKÜL | Ü | 1 | a „van” út 3 lapos űrlapja indul, 2. lapon kötelező adószám → Marikának zsákutca; mentéskor a háttér csendben `van`-ra állítana (`routes/client.ts:233`) | p1x_01, p1x_02 |
| **INDÍTÁS ÚT (P1 Marika)** |||||| 
| 4 | „Még nincs, most indítanám” → `/bekotes/adatok?utana=vallalkozas` („Rólad”) | Ü | 1 + 5 mező + 1 | név, telefon, adóazonosító jel, lakcím; vissza csak „Vissza a Főoldalra” (nincs „mégis van”) | p1_11–p1_15 |
| 5 | `/bekotes/vallalkozas` (központ, kitöltés) | Ü | 1 (3 képernyőnyi görgetés után) | fejléc: „Még nem küldted el az adataidat” (épp most küldte el a Rólad-ot); „Te jelented be…”, **Készítsd elő** 8 tétel (Ügyfélkapu+/DÁP, személyi, lakcímkártya, adóigazolvány, TAJ, „Anyád születési neve…”, székhely jogcím, tevékenységek) pipákkal, mind „Mi ez?”-vel; „Kitöltöm az adatlapot”; „Elakadtál?”; piros „Leállítom a bejelentést” | p1_16–p1_18, p1b_05 |
| 5f | Főoldal az indítás-úton | Ü | – | kérdés eltűnt; „Most ez jön · Vállalkozás bejelentése – Készítsd elő” gomb; Szerződés is „Most te jössz”; Meghatalmazás/Igazolványok zárva „Ha beküldted a bejelentést…”; Előfizetés zárva „ha már megvan az adószámod… addig ingyenes”; Hol tartunk 6 pont | p1b_01–p1b_04 |
| 6 | Adatlap 1/5 „Mielőtt elkezded” | Ü | 4 | 10 soros kizáró-ok szöveg, 2 pipa, „Mégis van vállalkozásom” link, bevételsáv (20 M felett stop + visszahívás) | p1b_06–p1b_10 |
| 7 | Adatlap 2/5 tevékenység | Ü | 3 (+keresés) | kereső, teljes lista, szabad szöveg; költséghányad-tipp (80%); képesítés-figyelmeztetés | p1b_11–p1b_14 |
| 8 | Adatlap 3/5 székhely | Ü | 3 | „A székhely címe nyilvános lesz”; lakcím / másik / székhelyszolgáltató; telephely | p1b_15–p1b_18 |
| 9 | Adatlap 4/5 munkavégzés | Ü | 3–4 | fő/mellék/tanuló/nyugdíjas (+ járulék-tájékoztató 101 682 Ft), EU-partner, külön számla | p1b_19–p1b_22 |
| 10 | Adatlap 5/5 kezdés + összefoglaló | Ü | 2 | „Minél előbb / adott napon”, összefoglaló „Módosítom” linkekkel, „Kérem az útmutatót” | p1b_23, p1b_24 |
| 11 | `/bekotes/vallalkozas/utmutato` | Ü (vár) | – | sárga sáv: „a tevékenységed pontos sorát még megírjuk, ~1 munkanap… a NAV-os bejelentést még ne kezdd el”; mégis alatta a 14 lépés „Megnyitom a Vállalkozói Ügysegédet” gombokkal; **18 714 px hosszú (~22 képernyő)**; 13 kép rajzolt „Illusztráció” | p1b_25–p1b_32, p1c_06 |
| 11w | **VÁR: tevékenység sora** | Cs | – | Cs beírja az ÖVTJ-kódot → értesítés „Megírtuk, melyik sort válaszd”; a Főoldal ezalatt „Kész a személyre szabott útmutatód… Megnyitom az útmutatót” (a várakozásról nem szól) | p1c_01–p1c_05, p1c_07–p1c_09 |
| 12 | NAV Vállalkozói Ügysegéd (kívül) | Ü + NAV | – | 14 lépés, kb. 10–15 perc, Ügyfélkapu+/DÁP kell; a végén kamarai regisztráció (5 munkanap) | p1c_06 |
| 13 | `/bekotes/vallalkozas/feltoltes` | Ü | 4 | PDF vagy fotó, mikor, hogyan (Ügyfélkapu+/DÁP/személyesen), adószám ha van → „Megkaptuk. Átnézzük, és szólunk.” | p1c_10–p1c_16 |
| 13w | **VÁR: átnézzük** | Cs | – | Főoldal: „Beküldted, átnézzük”, Hol tartunk „Általában 1 munkanap”; közben nyitva: Szerződés, Igazolványok | p1c_17–p1c_22 |
| 14w | **VÁR: adószám** | NAV → Ü vagy Cs | – | „Rendben van a bejelentésed. Várjuk az adószámodat. Ha megjött, írd be te is.” – mikor, hol jön, ki írja be: nincs megmondva | p1c_23–p1c_28 |
| 15 | adószám beírása (központ) | Ü | 1 (+mező) | „Elindult a vállalkozásod!” + sárga: kamarai regisztráció 5 munkanapon belül, 5 000 Ft/év (nem lépés, nincs emlékeztető) | p1c_29–p1c_33 |
| **KÖZÖS VÉG (mindkét út)** |||||| 
| 16 | `/bekotes/szerzodes` | Ü | 4 | ÁSZF (kiemelt pontokkal), adatkezelés, megbízási szerződés; 3 pipa → „Rendben, tovább” | p1d_01–p1d_06, p2_21–p2_23 |
| 17 | `/bekotes/meghatalmazas` | Ü | önálló: kívül 8 ONYA-lépés + 1; „Bence küldi be”: 2 | videó, 8 lépéses ONYA-útmutató valódi képekkel (**10 667 px**), legalul „Más módon is lehet”: „Bence küldi be, én jóváhagyom” | p1d_07–p1d_14, p2_24 |
| 17w | **VÁR: meghatalmazás** | B → Ü → B | 1 (Jóváhagytam) | Bence beküldi (UJEGYKE) → ügyfél 4 napon belül jóváhagyja az ONYA-ban → Bence ellenőrzi (1–2 munkanap). A Főoldal ezalatt rossz teendőt mutat (lásd 3.) | p1d_15–p1d_17, p1e_11–p1e_17 |
| 18 | `/bekotes/azonositas` | Ü | ~16 | okmánytípus, 3 fotó, 7 adatmező („Anyja születési neve”), 4 nyilatkozat, „Elküldöm” | p1d_18–p1d_22, p1e_01–p1e_05 |
| 18w | **VÁR: KYC** | B | – | „Bence átnézi az igazolványaidat – Általában 1 munkanap” | p1e_08–p1e_10 |
| 19 | `/bekotes/elofizetes` | Ü | 3 + SimplePay | DEMO fizetés; „Mit kapsz ezért?” 6 pont; 2 nyilatkozat; „Kártyás fizetés”. A van-úton az első perctől nyitva (a szerződés előtt is) | p1d_23, p1d_24, p1e_06, p2_26 |
| 20w | **VÁR: számlák bekötése** | B | – | „Számlák bekötése – Bence dolgozik rajta.” (idő nincs) → minden kész → aktív | p1e_18–p1e_20 |
| **MEGLÉVŐ VÁLLALKOZÁS (P2 Dávid)** |||||| 
| 4v | „Igen, van” | Ü | 1 | ugyanazon a Főoldalon marad, a kérdés eltűnik, visszajelzés nincs | p2_01–p2_05 |
| 5v | `/bekotes/adatok` 1/3 Rólad | Ü | 1 (+5 mező) | „Telefonszám (nem kötelező)” | p2_06, p2_07 |
| 6v | 2/3 Vállalkozásod | Ü | 2 (+4 mező) | adószám (kötelező), EV-szám, székhely település, tevékenység + 3 kategória, mióta | p2_08–p2_13 |
| 7v | 3/3 Helyzeted | Ü | 3 | fő/mellék/nyugdíjas, külön számla, „Eddigi könyvelőd (ha volt)” – a váltásról (régi meghatalmazás, idei bevallások) semmi | p2_14–p2_17 |
| 8v | Főoldal | Ü | – | „Most ez jön · Szerződés”; 4 sor egyszerre „Most te jössz” | p2_18–p2_20 |

Fülsor a bekötés alatt (P1): Főoldal (jelvény = szerver todoCount), Dosszié és Fotózás zárt lap („– hamarosan”, „Még N lépés…
Ebből M a tiéd”, „Mi kell még?”, „Kérdésed van? Kérj visszahívást.”), Üzenetek nyitva (a fülsor itt eltűnik; 4 zárt gyorskérés),
Fiók nyitva (Ajánld ismerősnek, Díjszámlák, Határidők zárva). Képek: p1d_25–p1d_30.

Visszahívás belépési pontjai: sáv-kapszula (Főoldal), Főoldal alsó kártya, „Elakadtál? Kérj visszahívást” minden lépés alján és
minden útmutató-lépésnél, a „Mi ez?” lapok alján, zárt lapok, Üzenetek „Visszahívást kérek”, Fiók (2×). Űrlap: telefon (maszkolva),
téma (8), megjegyzés, idősáv, ígéret + csalás elleni figyelmeztetés (p1d_31–p1d_33). „Intézzük helyetted” lehetőség: **sehol**.

## 3. Várakozó állapotok – mit lát az ügyfél

| Állapot | Ki dolgozik | Mit mond a Főoldal | Hiány |
|---|---|---|---|
| tevékenység sorára vár | Cs | „Kész a személyre szabott útmutatód… Megnyitom az útmutatót” | a várakozást csak a központ/útmutató mondja („~1 munkanap, még ne kezdd el”) |
| igazolás átnézése | Cs | „Átnézzük a bejelentésedet – Általában 1 munkanap” | rendben |
| adószámra vár | NAV | „Várjuk az adószámodat – Ha megjött, írd be te is.” | honnan jön (tárhely/levél), mennyi idő, ki írja be (Ü vagy Cs) |
| Bence beküldi a meghatalmazást | B | lépéssor: „Beküldted, Bence ellenőrzi a NAV-nál” | az ügyfél nem küldött be semmit; „Bence beküldi, utána jóváhagyod” kellene |
| jóváhagyásra vár (4 nap!) | Ü | „Most ez jön · Jelentsd be Bencét a NAV-nál… Az ONYA-ban kb. 5 perc… Megmutatod, hogyan?”; Hol tartunk visszaesik „Add meg a meghatalmazást”-ra | a valódi teendő („Hagyd jóvá … -ig”) csak a meghatalmazás-képernyőn látszik, dátum nélkül |
| jóváhagyás után | B | „Beküldted, Bence ellenőrzi a NAV-nál”; Hol tartunk még „Az ONYA-ban hagyd jóvá, amikor szól.” | elavult mondat |
| KYC átnézése | B | „Bence átnézi az igazolványaidat – Általában 1 munkanap” | rendben |
| számlák bekötése | B | „Bence dolgozik rajta.” | idő, mi történik |

## 4. Az elágazás zárja (ORDER 2) – hol nem változtatható

- **UI – Főoldal:** `kod/app/src/app/bekotes/index.tsx:229` – `{d.path == null ? <ElagazasKartya …/> : null}`: a kérdés csak
  addig létezik, amíg `business_status` NULL. Válasz után a Főoldalon, a Fiókban, a „Rólad” lapon semmi nem kínál váltást
  (P3: p3_01, p3_02–p3_05, p3_10–p3_11; minden szöveg-kereséssel ellenőrizve).
- **UI – inditas → van csak két rejtett úton:**
  `kod/app/src/app/bekotes/vallalkozas/index.tsx:220` piros „Leállítom a bejelentést” (a központ alján, 3 képernyő görgetés
  után, ok-választó lappal; p3_12, p3_13) → `POST /client/business-registration/withdraw` → `business_status = NULL`
  (`kod/backend/src/routes/client-bekotes.ts:268-279`), a kérdés újra megjelenik (p3_14);
  `kod/app/src/app/bekotes/vallalkozas/adatlap.tsx:353` „Mégis van vállalkozásom” (adatlap 1. lap) → lap (`:573-592`) →
  `PUT business-status 'van'` (p3b_01–p3b_05). Az adatlap a „Rólad” nélkül a kaput mutatja (`adatlap.tsx:306-325`, p3_09),
  ott nincs ilyen link → Peti előbb az adóazonosító jelét és lakcímét adja meg, hogy visszacsinálhasson egy mellékoppintást.
- **UI – van → inditas: nincs.** `kod/app/src/app/bekotes/adatok.tsx:93` (`e.adoszam = adoszamHiba(u.adoszam)`) kötelező
  adószám, „Még nincs adószámom” lehetőség nélkül (p3_19–p3_21); Főoldal (p3_22–p3_25), Fiók: semmi. Egyetlen kiút a visszahívás.
- **Shared:** `kod/shared/src/enums.ts:48-65` `BUSINESS_STATUSES`, `ONBOARDING_STEP_ORDER/REQUIRED_STEPS` útvonalanként;
  `:391-396` `REGISTRATION_WITHDRAW_REASON_LABELS` (`mar_van_vallalkozasa` = „Mégis van már vállalkozásom”); `:358`
  `REGISTRATION_OPEN_STATUSES` (kitoltes, utmutato, beadva, javitas, ellenorizve). Állapotgép-zár a shared-ben nincs.
- **Backend – API (a háttér NEM zár, amíg bekötés alatt és nincs beküldve):** `PUT /client/onboarding/business-status`
  (`kod/backend/src/routes/client-bekotes.ts:100-126`) mindkét irányba 200 (helyben kipróbálva: van→inditas, inditas→van).
  409-ek: `lifecycle != 'bekotes_alatt'` → „A bekötés után ezt már nem kell megadnod.” (kata, aktív); beküldött vagy kész
  bejelentés (`FILED_OR_LATER` = beadva, javitas, ellenorizve, kesz – `services/registration.ts:36`) → „A bejelentésedet már
  beküldted. Ha mégsem kell, írj nekünk.” (levente, beadva). DE a `withdraw` ugyanezekben az állapotokban (beadva, javitas,
  ellenorizve; `canWithdraw = OPEN_REG`, `registration.ts:306`) 200-at ad és NULL-ra állítja az utat → a „nem váltható”
  szabály megkerülhető, a két végpont ellentmond egymásnak.
  `PUT /client/business-registration` van-úton 409 `step_locked` „Előbb válaszd: Még nincs…” (`client-bekotes.ts:131`).
  Mellékhatások: inditas→van: nyitott bejelentés → `elallt` (`mar_van_vallalkozasa`), `adatok` lépés vissza `ugyfelre_var`-ra,
  ha nincs adószám; van→inditas: új `business_registrations` sor (`kitoltes`) + `vallalkozas_inditas` = `ugyfelre_var`; a teljes
  van-profil (adószámmal) után az `adatok` `kesz` marad → adószámos ügyfél az indítás-úton. Minden váltás új regisztrációs sort
  nyit (Petinek kettő `elallt` sora lett).
  `kod/backend/src/routes/client.ts:233` – a teljes (van) profil mentése NULL útnál csendben `business_status = 'van'`-t állít.
- **DB:** `clients.business_status text NULL`, CHECK `in ('van','inditas')` (`kod/backend/src/db/schema.ts:311, 315`);
  `business_registrations.status` (+ `withdrawn_at`, `withdraw_reason`); `onboarding_steps(step='vallalkozas_inditas'|'adatok')`.
  Nincs „zárolt” oszlop: a zár tisztán a felületen van. Az útváltás után a lépésállapotok a fenti mellékhatások szerint mozognak
  (DB-állapotok: `_munka/k5/felmeres` P3 futás naplója a jelentésben).
- **MINTA szerver** ugyanígy (`kod/app/src/api/minta/szerver.ts:493-498, 535-537`).

## 5. Számok, nevek – ugyanaz a dolog több néven

- „Még 4 dolog kell tőled” ↔ fülsor-jelvény 5 ↔ zárt lap „Még 4 lépés… Ebből 2 a tiéd” (a jelvény a szerver todoCount-ja, a
  sáv az app saját számolása: `bekotes/index.tsx:180`).
- NAV-meghatalmazás ↔ Meghatalmazás ↔ „Add meg a meghatalmazást” ↔ „Jelentsd be Bencét a NAV-nál” ↔ „Bence bejelenti magát a
  NAV-nál könyvelődként” ↔ UJEGYKE.
- Vállalkozás bejelentése ↔ „Töltsd ki az adatlapot” ↔ „Jelentsd be a vállalkozásodat” ↔ „Készítsd elő” (gomb) ↔ adatlap ↔ útmutató.
- Adataid ↔ Rólad ↔ „Mondj magadról pár dolgot” ↔ „Még nem küldted el az adataidat” (ez az adatlapra vonatkozik).
- Igazolványok ↔ Azonosítás ↔ „Fotózd le az igazolványaidat”.
- Számlák bekötése ↔ „A számláid maguktól jönnek”.
- NAV Ügyfélportál ↔ Vállalkozói Ügysegéd ↔ NAV ÜPO ↔ kau.gov.hu (az útmutató 1. lépésében mind).
- anyád (Készítsd elő, Mi ez?, videó) ↔ édesanyád (hibaüzenet, app-szöveg) ↔ anyja (azonosítás mezőcímke, útmutató-sor).
