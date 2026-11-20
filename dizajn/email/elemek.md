# Építőelemek (a {{tartalom}} helyére kerülnek)

A kész HTML-ek az `epit_peldak.cjs` `E` objektumában vannak (minden stílus inline). Beépítéskor ezeket kell TypeScript segédfüggvényekké alakítani.

| Elem | Függvény | Mire való | Példa |
|---|---|---|---|
| Bekezdés | `E.p(szöveg)` | 16 px, #10152B | mind |
| Kis szürke bekezdés | `E.kicsi(szöveg)` | 14 px, #5B6478, megjegyzésekhez („Ha nem te kérted…”, „A PDF csatolva…”) | 01, 02, 03, 04, 06 |
| Kódblokk | `E.kod('482&nbsp;913')` | 6 jegyű kód: 36 px, félkövér, ritkított, kék számok világos (#F3F5FB) dobozban; mobilon 32 px | 01, 02 |
| Kulcs-érték táblázat | `E.kv([[kulcs, érték, kiemel?], ...])` | Összeg / Számlaszám / Határidő; a 3. elem 1 = nagyobb, vastag sor (pl. összeg). Mobilon a kulcs és az érték egymás alá kerül | 03, 04, 05, 06 |
| Tippdoboz | `E.tipp(szöveg)` | sárga (#FFF6DB), sárga bal sáv, „Tipp:” előtaggal | 04 |
| Infódoboz | `E.info(szöveg)` | kék (#EAEDFC), kék bal sáv | 05 |
| Másodlagos link | sablon `{{#link}}` blokk (`link_szoveg` + `link_cel`), a gomb ALATT; tartalmon belül `E.link(szöveg, url)` | 14 px, kék, aláhúzott; a fő gomb mellett a „kisebb” teendő | 03 |
| Szövegen belüli link | `E.a(szöveg, url)` | pl. e-mail-cím egy mondatban | 06 |
| Egyben tartás | `E.egyben(szöveg)` | ne törjön szét (dátumtartomány, „október–decemberi”) | 03, 05 |
| Fő gomb | sablon `{{#gomb}}` blokk (`gomb_szoveg` + `gomb_link`) | sárga #FFC93C, sötét #10152B felirat; Outlookban VML-gomb | 03, 04, 05 |

Szabályok:
- Egy levélben legfeljebb EGY fő gomb. A gomb felirata egyes szám első személy: „Letöltöm a számlát”, „Megnézem az utalási adatokat”.
- A blokkok közti térköz cellapadding (nem táblázat-margó), mert az Outlook a táblázat margóját nem mindig veszi figyelembe.
- A felhasználói adatot minden elemben HTML-escape-elni kell (`esc`).
- A `ty()` függvény (magyar tipográfia) az „a/az” névelő után és a szám + mértékegység (Ft, óra, percig) közé nem törő szóközt tesz; a bekezdés-, tipp-, infó- és linkszövegekre, a címre és a láblécre fut le.
