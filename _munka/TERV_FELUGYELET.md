# Felügyelet és riasztás – építésre kész terv (Adózz.hu / kezjegy)

Készült: 2026-11-21. Állapot: TERV. A tulaj 11-21-én jóváhagyta a felügyeletet (HIANYLISTA 1.17); az építés a marketing-kör után jön.
Kapcsolódik: `_munka/HIANYLISTA_2026-11-21.md` 1.17, 1.8, 2.19, 3.11; `kod/SPEC.md` §15 (háttérfeladatok), §18 (panel), §20 (telepítés), §24, §28.K.4 (emlékeztetők).
A SPEC-be új fejezet kerül: **§32 Felügyelet és riasztás**. Ennek a forrása ez a fájl.

A tulaj kérése (11-21): ha leáll valami, azonnal szóljon. Legyen valami, ami minden funkciót néz, és ha bármi rossz, pontosan megmondja, mi nem jó.

**Jelölések**
- [TULAJ]: a tulaj dönt.
- [DÁVID]: könyvelői szakmai döntés.
- [KÓD]: kódváltozás kell.
- [ellenőrizendő]: építéskor vagy telepítéskor igazolni kell.

Ez a terv adószabályt nem állapít meg. Ahol határidő szerepel, azt az adómotor (`kod/ado-motor`, `deadlinesFor()`) és a SPEC adja. A hivatalos forrásuk a 9. pontban van.

---

## 0. Röviden

**Mai helyzet (olvasva, 11-21)**
- Semmi nem figyel kívülről. Nincs Uptime Kuma, nincs riasztás telefonra.
- A `/api/v1/health` csak egy `select 1` (routes/public.ts:28-38).
- A háttérfeladatok hibája, kimaradása, a mentés, a lemez, az e-mail, a push és a NAV-hibák többsége senkinek nem jelez.
- A meglévő riasztólevelek (NAV-hiba, invoice_failed, payment_disputed, staff digest) az app saját levélútján mennek. A DEMO szerveren ezek a DEMO-postafiókba kerülnek.

**A terv öt része**
- (a) Új **rendszerellenőr** konténer (`kezjegy-ellenor`). 15 mp–24 óra gyakorisággal kb. 90 ellenőrzést futtat, az eredményt az adatbázisba írja, ő küldi a riasztást.
- (b) **Uptime Kuma**: a nyilvános címek, valamint az ellenőr életének figyelése.
- (c) Óránkénti **szintetikus böngészős próba** egy tesztügyféllel (`is_test`).
- (d) **Riasztás**: ntfy push a telefonra, e-mail (ZeptoMail), ismétlés-elnyomás, „megjavult” üzenet, reggeli összefoglaló.
- (e) **Külső figyelő**, ha az egész szerver leáll. Ajánlás: Healthchecks.io + UptimeRobot, 0 Ft/hó. [TULAJ]

**Alapelvek**
1. **Egy riasztó „agy”.** Minden riasztást a rendszerellenőr küld, egyetlen szövegkatalógusból. Két kivétel van:
   - ha maga az ellenőr áll le, azt a Kuma jelzi közvetlenül;
   - ha az egész szerver vagy a Kuma áll le, azt a külső figyelő jelzi.
2. **Egy hibáról egy üzenet,** és amikor helyreáll, egy „megjavult” üzenet. A nyitott hibákat minden reggel felsorolja az összefoglaló.
3. **Pontos szöveg.** Minden üzenet részei: Mi nem jó, Mióta, Hatás, Lehetséges ok, Teendő, link a panelre.
4. **A riasztásban nincs személyes adat:** se ügyfélnév, se e-mail, se adószám, se összeg. Csak darabszám és hibakód szerepel; a nevek a panelen látszanak, belépés után.
5. **Új nyilvános felület csak az ntfy-nak kell,** zárt témákkal. A Kuma és az ellenőr kívülről nem érhető el.
6. **Nem törlünk.** Az előzmények megmaradnak. A próbafájlt felülírjuk, nem töröljük.
7. **A titkokat a szerver generálja,** és sehol nem írjuk ki őket.
8. **Minden háttérfeladatnak kötelező figyelési adatlapja van.** Ha hiányzik, a teszt elbukik. Így az új funkciók (havi KATA-követés, éves SZJA-ciklus, NAV-folyószámla egyeztetése) is automatikusan figyelés alá kerülnek.

```
              ┌──────────────────────── appok-1 (/srv/kezjegy) ───────────────────────────┐
 telefon ◄─── jelzes.adozz.hu ── kezjegy-proxy ── kezjegy-ntfy ◄──────────┐               │
 (ntfy app)                                                               │ riasztás      │
 e-mail  ◄──────────────── ZeptoMail SMTP ◄───────────────────────────────┤               │
              │                                                           │               │
              │  kezjegy-kuma ── /metrics (60 mp) ──────────────► kezjegy-ellenor ◄─► DB  │
              │   │ HTTP/kulcsszó/JSON a nyilvános címekre                 ▲    ▲          │
              │   └ K12 „él-e az ellenőr?” → ha nem: KÖZVETLEN ntfy+e-mail │    │          │
              │  host-allapot.sh (cron, 2 percenként) → host_allapot.json ─┘    │          │
              │  szintetikus próba (cron :17, Playwright) → eredmény ───────────┘          │
              └──────────────┬──────────────────────────────────────┬────────────────────┘
                             │ életjel-pingek (HC1–HC4)             │ HTTPS kívülről
                      Healthchecks.io                       UptimeRobot (opcionális)
                             └──── e-mail + ntfy.sh külső téma ──► telefon
```

---

## 1. Felépítés

### 1.1 Rétegek és felelősség

| Réteg | Hol fut | Mit lát | Ki riaszt |
|---|---|---|---|
| Rendszerellenőr (`kezjegy-ellenor`) | appok-1, saját konténer | Belülről mindent: DB, háttérfeladatok, NAV, levél, push, Stripe, Számlázz.hu, fájltár, PDF, mentés. A szerver állapotát a host-szkript fájljából olvassa, a Kumáét a metrikáiból. | önmaga (ntfy + e-mail) |
| Uptime Kuma (`kezjegy-kuma`) | appok-1 | A nyilvános címeket a proxyn és a TLS-en át, valamint az ellenőr életét | az ellenőr a Kuma metrikáiból; a K12-t (az ellenőr halála) a Kuma maga |
| Szerver-adat (`host-allapot.sh`) | appok-1, host cron | Konténerek, lemez, memória, óra, frissítések, mentésfájlok, Storage Box | ellenőr |
| Szintetikus próba (Playwright) | appok-1, óránként `docker run --rm` | Az ügyfél szemével: belépés → főoldal → határidők → dosszié → üzenetek | ellenőr |
| Külső figyelő | Healthchecks.io (+ UptimeRobot) | Él-e a szerver, a Kuma és az ellenőr; elérhetők-e kívülről a címek | önmaga (e-mail + ntfy.sh) |

### 1.2 (a) Rendszerellenőr – `kezjegy-ellenor`

**Döntés: külön konténer, ugyanabból a képből** (`kezjegy/api:latest`, `node dist/ellenor.js`). Miért nem a worker része:
- A worker köre soros. Egy hosszú `nav_sync` alatt percekig nem jut szóhoz, ügyfelenként legalább 1,1 mp-ig (worker.ts:105-120, navsync.ts:223-243). A figyelésnek ilyenkor is futnia kell.
- A worker leállását valakinek kívülről kell észrevennie.
- Egy hibás ellenőrzés nem akaszthatja meg a díjszámlázást vagy a NAV-letöltést.
- Ugyanaz a kód marad: közös config, DB-séma, Mailer, FileStorage és a nav-kliens hibatérképe (`NAV_ERROR_MAP`).

**Compose** (`deploy/docker-compose.yml`, új szolgáltatás a fő projektben). Így telepítéskor együtt frissül a kóddal.

```yaml
  kezjegy-ellenor:
    image: kezjegy/api:latest
    container_name: kezjegy-ellenor
    restart: unless-stopped
    command: ["node", "dist/ellenor.js"]
    user: "${KEZJEGY_UID:-1001}:${KEZJEGY_GID:-1001}"
    env_file:
      - path: ../.env              # SMTP, Stripe, Számlázz.hu, NAV-kereső, FILE_ENC_KEY – amit a worker is lát
        required: true
      - path: ../nyilvanos.env
        required: false
      - path: ../.env.figyelo      # UTOLSÓ: felülírja a DATABASE_URL-t a kezjegy_figyelo szerepre + a figyelő titkai
        required: true
    environment: { FILES_DIR: /data/files, FONT_DIR: /app/fonts, LEGAL_DIR: /app/legal, SKIP_MIGRATIONS: "1" }
    volumes:
      - ../data/files:/data/files                 # csak a _figyelo/proba fájlt írja (T01)
      - ../figyelo/host:/run/figyelo:ro           # host_allapot.json (S, M csoport)
      - ../figyelo/szintetikus:/run/szintetikus:ro
    read_only: true
    tmpfs: [/tmp]
    security_opt: [no-new-privileges:true]
    cap_drop: [ALL]
    networks: [kezjegy_edge, kezjegy_internal]    # internal: DB; edge: kimenet (SMTP, NAV, Stripe…), ntfy, Kuma
    depends_on: { kezjegy-db: { condition: service_healthy } }   # az API-tól NEM függ: akkor is fut, ha az API áll
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8090/elo').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
    mem_limit: 256m
    pids_limit: 128
    logging: *logging
```

**Ütemező**
- 15 mp-enként végignézi, melyik ellenőrzés esedékes. Ellenőrzésenként van gyakoriság, véletlen eltolás (±10%) és időkorlát (alapból 10 mp, legfeljebb 60 mp).
- Egyszerre legfeljebb 4 ellenőrzés fut, ugyanaz az ellenőrzés soha nem fut kétszer egyszerre.
- A „kör” frissességét (`frissMp`) a K12 Kuma-monitor és a konténer healthcheckje nézi.

**Saját állapot memóriában is**
- Ha az adatbázis leáll, az ellenőr akkor is riaszt („Az adatbázis nem válaszol”), mert a döntéshez a memóriabeli állapotot használja.
- A DB-be akkor ír, amikor az elérhető.
- Induláskor a DB-ből tölti vissza az állapotot. A már kiküldött hibát nem küldi újra.

**Adatmodell** (új Drizzle-migráció) [KÓD]

- `felugyelet_allapot`: egy sor ellenőrzésenként.
  - Azonosítás és állapot: `kod` (PK, pl. `H01`, `S02-worker`); `allapot` (`ok` | `figyel` | `hiba` | `ismeretlen` | `nincs`); `uzenet` (a kész „Mi nem jó” szöveg); `reszletek` (jsonb: számok és azonosítók, név nélkül); `ota` (az állapot kezdete).
  - Futások: `utolso_futas`, `utolso_ok`, `kovetkezo_futas`, `hiba_sor`, `ok_sor`, `ms`.
  - Riasztás és némítás: `riasztva_at`, `riasztott_szint`, `nemitva_eddig`, `nemitas_oka`, `nemitotta`, `ingadozik`, `frissitve`.
- `felugyelet_esemenyek`: csak hozzáírás, minden állapotváltás és minden kiküldés.
  - Mezők: `id` (bigserial), `kod`, `at`, `regi`, `uj`, `uzenet`, `forras` (`ellenor` | `kuma` | `szintetikus` | `kezi`).
  - `csatornak` (jsonb): `{ntfy: 'elment' | 'hiba: …' | 'nem kellett', email: …}`.
  - `elnyomva` (null, vagy az ok: `karbantartas` | `nemitva` | `fugg:D01` | `csendes` | `vihar`).
- `felugyelet_napok`: (`kod`, `nap`) PK, `futas`, `figyel`, `hiba`, `ismeretlen`, `leghosszabb_hiba_perc`. A panel 30 napos csíkjához; évente kb. 33 000 apró sor.
- `felugyelet_keresek`: a „Most ellenőrizd” gombhoz. Mezők: `id`, `kod`, `kerte`, `kert_at`, `kesz_at`, `eredmeny`.
- `felugyelet_beallitasok`: (`kulcs`, `ertek`) – karbantartás, a reggeli jelentés utolsó kiküldése, a Kuma utolsó jelzése.
- `accountants.is_test` (boolean, alapból false): a szintetikus könyvelőhöz (1.4).

**Adatbázis-szerep** (`deploy/db-roles.sh` kiegészítése) [KÓD]
- Új szerep: `kezjegy_figyelo`. Jogai:
  - `LOGIN`, `CONNECTION LIMIT 5`;
  - `SELECT` minden app-táblára;
  - `INSERT/UPDATE` csak a `felugyelet_*` táblákra;
  - `GRANT pg_monitor` a `pg_stat_activity`-hez.
- Törlési joga nincs. Az ellenőr nem írhat ügyféladatot.
- A jelszó `KEZJEGY_FIGYELO_DB_PASSWORD` a `.env.db`-ben; a `.env.figyelo` `DATABASE_URL`-je ezzel a szereppel csatlakozik.

**Belső végpontok** (a 8090-es port csak a Docker-hálókon él; a Caddy nem enged ki rá útvonalat)

| Végpont | Védelem | Ki hívja | Válasz |
|---|---|---|---|
| `GET /elo` | nincs (csak „ok”) | a konténer healthcheckje | 200, ha 60 mp-en belül körbeért |
| `GET /allapot` | `Authorization: Bearer FIGYELO_TOKEN_ALLAPOT` | Kuma K12 | `{el, frissMp, verzio, osszkep:{ok,figyel,hiba,ismeretlen}, hibak:[{kod,szint,cim,ota}]}`, személyes adat nélkül |
| `GET /kuma-jel` | `Bearer FIGYELO_TOKEN_KUMA` | Kuma K13 | 204; feljegyzi, hogy a Kuma köre fut (R03) |
| `POST /szintetikus` | `Bearer FIGYELO_TOKEN_SZINT` | a szintetikus próba | 204; lépésenkénti eredmény (X csoport) |

**„Most ellenőrizd”**
- A panel kérésére az API beszúr egy `felugyelet_keresek` sort, és `NOTIFY felugyelet_keres`-t küld.
- Az ellenőr `LISTEN`-nel figyel, és 15 mp-enként a táblát is megnézi. Az ellenőrzést soron kívül lefuttatja, és beírja az eredményt.
- A panel 1 mp-enként kérdez, legfeljebb 15 mp-ig.
- A szerver-adatból dolgozó ellenőrzéseknél (S, M) a gomb a host-fájlt olvassa újra, és kiírja, hány perce frissült (a host-szkript 2 percenként fut).

**Kód** [KÓD]: `kod/backend/src/figyelo/`
- `ellenor.ts`: belépési pont, ütemező, HTTP-szerver, LISTEN.
- `katalogus.ts`: az összes ellenőrzés adatai és szövegei (2. pont).
- `allapotgep.ts`: tiszta függvény az állapotváltásokhoz (1.5).
- `kuldo.ts`: ntfy- és SMTP-küldés, csendes órák, vihar-összevonás, szövegszűrő.
- `osszefoglalo.ts`: a reggeli jelentés.
- `feladatok.ts`: a háttérfeladatok figyelési adatlapja (2.4).
- `ellenorzesek/*.ts`, csoportonként: `kuma.ts`, `szerver.ts`, `mentes.ts`, `hatter.ts`, `adatbazis.ts`, `api.ts`, `nav.ts`, `level.ts`, `push.ts`, `stripe.ts`, `szamlazas.ts`, `fajl.ts`, `belepes.ts`, `beallitas.ts`, `gdpr.ts`, `ugyfel.ts`, `szintetikus.ts`, `lanc.ts`, `umami.ts`.
- `routes/admin-felugyelet.ts`: a panel végpontjai (3. pont).
- `services/szintetikus.ts`: a tesztfiók őrei (1.4).

**Kötelező figyelési adatlap minden háttérfeladathoz** [KÓD]
- A `figyelo/feladatok.ts` `FELADAT_ADATLAP` rekordja minden `jobDefs()`-beli névhez tartalmazza: magyar név, ütemezés szövege, ablak, türelmi idő, súlyosság hibánál és elmaradásnál, várható maximális futásidő, hatás, teendő.
- Egy vitest-teszt elbukik, ha bármelyik feladatnak nincs adatlapja; ennek része a csak bekapcsolva létező `ad_conversions` is.
- Így egy új feladat (pl. a KATA havi követése vagy a folyószámla-egyeztetés) figyelés nélkül nem kerülhet be.

### 1.3 (b) Uptime Kuma

**Változat és kép**
- `louislam/uptime-kuma:2.5.12-rootless` digestre rögzítve. Ez nem root felhasználóval fut. A 2.5.12 a legfrissebb stabil (2026-11-17).
- [ellenőrizendő telepítéskor] A rootless kép Chromium nélküli-e és mekkora. Ha a teljes képre épül, a `2.5.12-slim` kell, `no-new-privileges` és `cap_drop: ALL` mellett.
- Böngészős monitort nem használunk: a szintetikus próbát a Playwright végzi.
- Adatbázis: SQLite (az első indításkor kell kiválasztani).
- Licenc: MIT.

**Külön compose-projekt** (`kezjegy-figyelo`, helye: `/srv/kezjegy/figyelo/docker-compose.yml`). A proxyhoz hasonlóan a `deploy/` mappán kívül van, így a `feltolt.sh` és az `up.sh` nem hozza létre újra.

```yaml
name: kezjegy-figyelo
services:
  kezjegy-kuma:
    image: louislam/uptime-kuma:2.5.12-rootless@sha256:<telepítéskor rögzítve>
    container_name: kezjegy-kuma
    restart: unless-stopped
    ports: ["127.0.0.1:3001:3001"]     # KIZÁRÓLAG loopback: SSH-alagúton éri el a tulaj; kívülről nem látszik
    volumes: ["./kuma-data:/app/data"] # helyi lemez (NFS nem jó: SQLite-zár)
    security_opt: [no-new-privileges:true]
    cap_drop: [ALL]
    networks: [kezjegy_edge]
    mem_limit: 512m
    pids_limit: 256
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }
  kezjegy-ntfy:
    image: binwiederhier/ntfy:v2.38.1@sha256:<telepítéskor rögzítve>
    container_name: kezjegy-ntfy
    command: ["serve"]
    restart: unless-stopped
    user: "1001:1001"
    volumes:
      - ./ntfy/server.yml:/etc/ntfy/server.yml:ro
      - ./ntfy-data:/var/lib/ntfy
      - ./ntfy-cache:/var/cache/ntfy
    read_only: true
    security_opt: [no-new-privileges:true]
    cap_drop: [ALL]
    networks: [kezjegy_edge]
    mem_limit: 128m
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }
networks:
  kezjegy_edge: { external: true, name: kezjegy_edge }
```

A fő compose szabálya: „NO ports:”. Ez alól a `127.0.0.1:3001` az egyetlen tudatos kivétel. A loopback-kötés kívülről nem érhető el, a ufw-t sem kerüli meg.

**Elérés a tulajnak**
- `D:/Atvitel/adozz_figyelo.cmd` [KÓD]: `ssh -N -L 3001:127.0.0.1:3001 appok-1`, majd megnyitja a böngészőben a `http://localhost:3001` címet.
- Első belépéskor a tulaj maga hozza létre az admin felhasználót, erős jelszóval (jelszókezelőből), és bekapcsolja a 2FA-t.

**Beállítások**
- Időzóna: Europe/Budapest. „Trust proxy”: ki.
- Egy API-kulcs, csak a `/metrics` olvasásához. A tulaj hozza létre, és a `figyelo_kulcsok.ps1` viszi a szerverre.
- Tanúsítványlejárat-értesítés: KI. Ezt a T05 végzi, pontos szöveggel.

**Monitorok** (a név pontosan így kezdődjön: az ellenőr a kódelőtagból ismeri fel)
- Közös beállítás, ahol mást nem írunk: újrapróba 1 (két hiba után DOWN), újrapróba-köz 30 mp, időkorlát 20 mp.
- Értesítés csak a K12-n van; a többit az ellenőr jelzi.

| Kód és név | Típus | Cím / beállítás | Gyakoriság | Elvárás |
|---|---|---|---|---|
| K01 – Nyitóoldal | HTTP kulcsszó | `https://adozz.hu/` | 60 mp | 200 és `id="arak"` |
| K02 – www átirányítás | HTTP | `https://www.adozz.hu/`, Max. átirányítás: 0 | 5 perc | 301 |
| K03 – Ügyfél-webapp | HTTP kulcsszó | `https://app.adozz.hu/` | 60 mp | 200 és a gyökérelem [ellenőrizendő: stabil kulcsszó a webes buildben] |
| K04 – Webapp régi cím | HTTP | `https://app.45-94-65-74.sslip.io/` | 5 perc | 200 |
| K05 – Könyvelői panel | HTTP kulcsszó | `https://konyvelo.adozz.hu/` | 60 mp | 200 és kulcsszó [ellenőrizendő] |
| K06 – Panel régi cím | HTTP | `https://konyvelo.45-94-65-74.sslip.io/` | 5 perc | 200 |
| K07 – API | JSON-lekérdezés | `https://api.adozz.hu/api/v1/health` | 60 mp | `ok = true and db = "ok"` → `true` |
| K08 – API régi cím (APK) | JSON-lekérdezés | `https://api.45-94-65-74.sslip.io/api/v1/health` | 60 mp | mint K07 |
| K09 – sslip.io névfeloldás | DNS | `api.45-94-65-74.sslip.io`, A rekord | 10 perc | `45.94.65.74` |
| K10 – Stripe-webhook cím | HTTP POST | `https://api.adozz.hu/api/v1/webhooks/stripe`, üres törzs | 10 perc | elfogadott kód: 400 (`bad_signature`, services/payments.ts:1645) |
| K11 – ntfy kívülről | JSON-lekérdezés | `https://jelzes.adozz.hu/v1/health` [TULAJ: név] | 60 mp | `healthy = true` |
| K12 – A FIGYELŐ NEM VÁLASZOL | JSON-lekérdezés | `http://kezjegy-ellenor:8090/allapot`, fejléc: `Authorization: Bearer …` | 60 mp | `frissMp < 180` → `true`; értesítés: **közvetlen ntfy + e-mail** |
| K13 – Ellenőr-jel | HTTP | `http://kezjegy-ellenor:8090/kuma-jel`, fejléc: token | 60 mp | 204; értesítés nincs (R03 eteti) |
| K14 – Külső életjel | HTTP | `https://hc-ping.com/<HC2 uuid>` | 60 mp | 200; értesítés nincs (a Healthchecks figyeli) |

**A K12 közvetlen értesítése két csatornán megy**
- ntfy: szerver `http://kezjegy-ntfy:2586`, téma `riasztas`, prioritás 5, a `kuma` felhasználó tokenjével;
- SMTP: ZeptoMail, címzett a riasztási e-mail.

A K12 monitor teljes neve maga az üzenet, mert a Kuma ntfy-üzenetében a név látszik: „K12 – A FIGYELŐ (kezjegy-ellenor) NEM VÁLASZOL – a többi riasztás most nem működik. ssh appok-1 → docker logs --tail 200 kezjegy-ellenor”.

**Ellenőr ← Kuma**
- Az ellenőr 60 mp-enként lekéri a `GET http://kezjegy-kuma:3001/metrics` végpontot (Basic auth, a jelszó a Kuma API-kulcsa) [ellenőrizendő: a 2.5.12 metrikanevei, pl. `monitor_status{monitor_name=…}`].
- A `monitor_status` értelmezése:
  - 0: hiba;
  - 1: rendben;
  - 2 (pending): az előző állapot marad;
  - 3 (karbantartás): ismeretlen.
- Így a Kuma állapota a panelen is látszik.
- A riasztás szövege a katalógusból jön (2.1). Webhookra nincs szükség, ezért egy elveszett webhook sem okozhat elcsúszott állapotot.

**Monitorok létrehozása**
- A Kuma v2-ben nincs hivatalos REST API monitor létrehozására, és nincs JSON-import.
- A monitorokat ezért kézzel vesszük fel, a `deploy/figyelo/KUMA_MONITOROK.md` táblázata szerint. Ez kb. 30 perc.
  - Felveheti a tulaj, vagy az ügynök a felületen, miután a tulaj maga belépett. Jelszót az ügynök nem gépel be.
- Az AutoKuma később választható [TULAJ]; a 2.5.12-vel való működése nincs igazolva.

### 1.4 (c) Szintetikus böngészős ellenőrzés

**Futtatás**
- A deploy felhasználó crontabja: `17 * * * * /bin/bash /srv/kezjegy/deploy/figyelo/szintetikus.sh >> /srv/kezjegy/figyelo/szintetikus/futas.log 2>&1`.
- Óránként „gyors” kör fut, a 04:17-es futás „teljes” kör.
- Az időpont úgy van választva, hogy elkerülje a :05-ös mentést, a :35-ös resticet és az egész órás feladatcsúcsot.

**Kép**
- `kezjegy/szintetikus:1`. Forrása a `deploy/figyelo/szintetikus/Dockerfile`: `FROM mcr.microsoft.com/playwright:v1.65.1-noble@sha256:…`, rá `npm ci`, a `playwright` csomag pontosan 1.65.1-es verziójával (meg kell egyeznie a kép verziójával), és a `proba.mjs`.

**Indítás**
```
timeout 180 docker run --rm --init --ipc=host --network kezjegy_edge --memory 1536m --pids-limit 512 \
  --read-only --tmpfs /tmp -e HOME=/tmp --env-file /srv/kezjegy/.env.szintetikus \
  -v /srv/kezjegy/figyelo/szintetikus/hibak:/hibak kezjegy/szintetikus:1 node /proba/proba.mjs <gyors|teljes>
```
- A nyilvános címeken át megy, tehát a DNS-t, a TLS-t, a proxyt, a webet és az API-t is végigpróbálja.
- [ellenőrizendő] A konténerből a nyilvános IP visszafelé (hajtűkanyarral) elérhető-e. Ha nem, `--add-host` a proxy belső címére.

**Lépések**

| Kód | Lépés | Siker feltétele | Kör |
|---|---|---|---|
| X01 | Nyitóoldal: `https://adozz.hu/?utm_source=figyelo-proba`. Előtte `localStorage.setItem('umami.disabled','1')` (Umami-doksi), a `*proba*` forrást az `isTestSource` (accounts.ts:74) kiszűri. | 200, az `#arak` látszik, nincs konzolhiba (CSP-sértés, JS-kivétel) | gyors |
| X02 | Webapp: `https://app.adozz.hu/` | a belépő űrlap mezői megjelennek | gyors |
| X03 | Belépés a szintetikus ügyféllel (e-mail + jelszó) | 10 mp-en belül a Főoldal; futásonként egyszer, újrapróba nélkül (a belépési korlát: auth.ts:304-305) | gyors |
| X04 | Főoldal | a fő összeg kártyája kitöltve; nincs hibasáv; egyik `/api/` válasz sem 5xx | gyors |
| X05 | Határidők | a lista betölt, legalább 1 tétel, a „Másolom” gombok látszanak | gyors |
| X06 | Dosszié + irat | a rögzített minta-PDF aláírt linkje 200-at ad, a fájl `%PDF`-fel kezdődik | gyors |
| X07 | Üzenetek | a szálak listája betölt | gyors |
| X08 | Kijelentkezés | sikeres; a munkamenet bontva | gyors |
| X09 | Feltöltés: 1 KB-os fix PDF (`figyelo-proba-ÉÉÉÉ-HH-NN.pdf`) a Dossziéba | megjelenik a listában | teljes |
| X10 | Üzenet a szintetikus könyvelőnek | megjelenik a szálban | teljes |
| X11 | Panel belépő oldala: `https://konyvelo.adozz.hu/` | az űrlap betölt (belépés NINCS; a 2. fázis döntése [TULAJ]) | teljes |
| X12 | Regisztrációs képernyő | megnyílik; NEM küldjük be | teljes |

**Eredmény küldése**
- A futás végén a próba ezt küldi: `POST http://kezjegy-ellenor:8090/szintetikus`, tartalma `{tipus, kezd, vege, lepesek:[{kod, ok, ms, hiba, utvonal}], kepernyokep}`.
- Az `utvonal` csak az útvonal, lekérdezőszöveg nélkül. A `hiba` rövid, és átmegy a szövegszűrőn.
- Ha egy lépés hibás, az utána következő, tőle függő lépések állapota „ismeretlen” lesz.
- Képernyőkép csak hibánál készül, ide: `/srv/kezjegy/figyelo/szintetikus/hibak/<idő>/<kód>.png`. Nem törlünk.
- Az X00 ellenőrzés (az ellenőrben) azt nézi, hogy 75 percen belül volt-e futás.

**A tesztfiók és a „nem szennyez” szabályok**

*Létrehozás: egyszer, a `deploy/figyelo/szintetikus-fiok.sh` futtatja* [KÓD]
- Mit csinál:
  - Egy egyszeri `node dist/figyelo/szintetikus-seed.js` konténert futtat az API képéből.
  - Létrehozza a `FIGYELO_SZINT_EMAIL` felhasználót [TULAJ: pl. `figyelo@adozz.hu` alias a tulaj postafiókjára]. Ha egy hiba miatt mégis levél menne ki, a tulaj látja.
  - A jelszót a szerveren generálja, a `.env.szintetikus` fájlba (600-as jog), és nem írja ki.
- A beállított ügyfél:
  - `clients.is_test = true` (az `APP_ENV`-től függetlenül);
  - `lifecycle = 'aktiv'`, minden bekötési lépés kész;
  - átalányadós profil az aktuális évre;
  - néhány kézi bevételi tétel, egy minta-PDF a Dossziéban, egy üzenetszál.
- Könyvelője: „Teszt Figyelő” szintetikus könyvelő (`accountants.is_test = true`).
  - Használhatatlan, véletlen jelszót kap, az 1. fázisban nem lép be.
  - Valódi könyvelőhöz (Dávidhoz) a tesztügyfél soha nem kerül.

*Kódőrök (egy helyen: `services/szintetikus.ts`; minden tesztfiókra érvényes)* [KÓD]
1. **`notify()`:**
   - a tesztügyfélnek csak appon belüli sor keletkezik (`wantPush = false`, `wantEmail = false`);
   - a tesztügyfélről munkatársnak szóló értesítés (új üzenet, feltöltés, visszahívás) nem jön létre.
   - Az emlékeztetők így is létrejönnek az appban, ezt a próba látja.
2. **`sendTemplateMail`, `sendCodeEmail`, `mailer.send`:** teszt-címzettnek nem küld. Napló: `synthetic skipped`.
3. **Pénz:**
   - a `billing`, `predebit`, `suspension_warning`, `service_lock_check`, `termination_effective` és `invoices_issue` feladat kihagyja a tesztügyfelet;
   - minden fizetésindító végpont 403-at ad (`synthetic_no_payment`);
   - Stripe-, SimplePay- és Számlázz.hu-hívás soha nincs.
4. **NAV:** a tesztügyfélnek nincs `nav_credentials` sora, így a `nav_sync` kihagyja (navsync.ts:225-229). NAV-hívás nincs.
5. **Kimutatások:**
   - a KPI-k már kiszűrik (`isTest`, admin.ts:121,134, konzol.ts:229, marketing.ts:250);
   - ugyanígy ki kell szűrni: `staff_digest` és `k28DigestLines`, a hirdetési konverziók, a könyvelői kapacitás, a könyvelőválasztó listák.
6. **Panel:** az ügyféllistákban alapból rejtve, egy „Tesztfiókok mutatása” kapcsolóval (csak adminnak) [DÁVID: látszódjon-e neki].
7. **Statisztika:** Umami-kizárás (X01).
8. **Belépési korlát:** óránként egy belépés, a végén kijelentkezés. Hibánál nincs újrapróbálás.

*Elfogadási ellenőrzés 48 óra futás után (SQL, csak olvasás)*: a tesztügyfélhez
- 0 `payments`, 0 `fee_invoices`, 0 `stripe_events` és 0 `nav_sync_runs` sor;
- 0 kiküldött e-mail és push (`email_sent_at` / `push_sent_at` csak `want_* = false` mellett);
- 0 munkatársi értesítés;
- 0 találat a DEMO-postafiókban és a ZeptoMail-naplóban a tesztcímre.

**Ha jön az ügyfél kétlépcsős belépése** (K8_TERV: e-mailes kód)
- A próba nem olvashat kódot az adatbázisból.
- Ilyenkor a próba egy hosszú életű munkamenettel (refresh cookie a próba kötetében) dolgozik, és csak a napi teljes körben lép be jelszóval.
- A kódos lépést a szintetikus fiók nem kapja meg. A „megbízható eszköz” szabály része legyen a K8-tervnek [KÓD].
- Ha a munkamenet lejár, SÁRGA jelzés megy: „egyszeri kézi belépés kell”.

### 1.5 (d) Riasztás

**Csatornák**

| Csatorna | Mire | Hogyan | Ha nem megy |
|---|---|---|---|
| ntfy, saját szerver, téma `riasztas` | PIROS (mindig), SÁRGA (nappal), JAVULT | `POST http://kezjegy-ntfy:2586/riasztas`, `Authorization: Bearer <ellenor token>`, fejlécek: `Title`, `Priority`, `Tags`, `Click` | 3 próba (10, 30, 90 mp), utána e-mail + R01 |
| ntfy, téma `jelentes` | reggeli összefoglaló (rövid) | `Priority: 2` | e-mail |
| E-mail (ZeptoMail SMTP) | PIROS, a PIROS utáni JAVULT, a reggeli összefoglaló (hosszú) | Saját nodemailer-kapcsolat a `.env` `SMTP_*` adataival. Feladó: `MAIL_FROM`; címzett: `FIGYELO_EMAIL_TO`. **Az app `MAIL_MODE`-jától független**, így a DEMO szerveren is valódi levél megy, de csak a tulajnak. Óránként legfeljebb 30 levél. | ntfy + R02 |
| Kuma közvetlen | csak K12 (az ellenőr halott) | ntfy (`kuma` felhasználó) + SMTP | – |
| Külső (Healthchecks, UptimeRobot) | Leállt a szerver, a Kuma vagy az ellenőr; elmaradt a reggeli jelentés. | Ezek levelező szolgáltatása, valamint az ntfy.sh véletlen nevű témája | – |

**Az ntfy prioritásai és címkéi**
- PIROS: 5 (sürgős; a telefon „Ne zavarjanak” módját csatornánként felülírhatja), `rotating_light`.
- SÁRGA: 3, `warning`.
- JAVULT: 2, `white_check_mark`.
- Jelentés: 2, ha minden rendben; 3, ha van nyitott hiba.

**Az üzenet borítéka** (minden riasztás így néz ki; a katalógus a Mi / Hatás / Ok / Teendő részt adja)

```
Cím:  [PIROS] Leállt a háttérfolyamat (worker)
Mi nem jó: A háttérfolyamat 7 perce nem jelentkezett (utolsó jel: 11-21 05:41).
Mióta: 11-21 05:43 óta (5 perce)
Hatás: nem mennek ki az értesítések és emlékeztetők, nem fut a NAV-letöltés, a havidíj-terhelés és a díjszámlázás.
Lehetséges ok: a kezjegy-worker konténer leállt vagy újraindulási hurokban van; elfogyott a memóriakerete (512 MB); nem éri el az adatbázist.
Teendő: 1) Rendszer fül → Szerver → Konténerek. 2) ssh appok-1, majd: docker logs --tail 200 kezjegy-worker. 3) Újraindítás: $DC up -d kezjegy-worker.
Részletek: https://konyvelo.adozz.hu/admin/rendszer#H01
Ha nem tudod megoldani: másold be ezt az üzenetet egy Claude-munkamenetbe.
```
- A megjavult hibáról ilyen üzenet megy: `[JAVULT] Leállt a háttérfolyamat (worker)`, „Újra rendben. A hiba 23 percig tartott (05:43–06:06).”
- Az e-mail tárgya: `[Adózz figyelő] PIROS – {cím} ({tartam})`. A szövege ugyanez, kiegészítve a panelen látható előzmények linkjével.
- Rövidítések a teendőkben:
  - `$DC` = `cd /srv/kezjegy/deploy && docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml`;
  - `$FC` = `cd /srv/kezjegy/figyelo && docker compose -f docker-compose.yml`;
  - `$PC` = `docker compose -p kezjegy-proxy -f /srv/kezjegy/proxy/docker-compose.yml`.

**Szövegszűrő** [KÓD]
- Minden kimenő szöveg (ntfy, e-mail, `/allapot`) átmegy rajta. Ezeket takarja ki:
  - e-mail-cím;
  - adószám (`\d{8}-\d-\d{2}`);
  - 10 jegyű adóazonosító;
  - IBAN és bankszámlaszám;
  - URL-ek lekérdezőszövege, tokenek (`tk_…`, `sk_…`, `whsec_…`).
- Unit-teszt fedi.

**Állapotgép** (`allapotgep.ts`, tiszta függvény)

| Most | Eredmény | Mi történik |
|---|---|---|
| ok | nem ok, de a hibasor < megerősítés | semmi (a panelen „gyanús” szürkés jelzés) |
| ok | a hibasor eléri a megerősítést | átvált FIGYEL vagy HIBA állapotba; esemény; riasztás (ha nincs elnyomva) |
| FIGYEL | HIBA | átvált; riasztás „súlyosbodott” címmel |
| HIBA | FIGYEL | átvált csendben (esemény igen, push nem) |
| nem ok | ok, és az oksor eléri a javulási megerősítést | átvált OK-ra; JAVULT üzenet, ha erről a hibáról ment riasztás |
| bármi | kivétel az ellenőrzés kódjában | ISMERETLEN; 3 egymás utáni után meta-riasztás (R06) |
| bármi | a szülő ellenőrzés hibás | ISMERETLEN, „függ: {szülő}”; nincs külön riasztás |
| bármi | 60 percen belül legalább 4 váltás | `ingadozik`: egy „ingadozik” üzenet, utána csend, amíg 30 percig stabil OK nem lesz |

**Megerősítés (hány egymás utáni rossz eredmény kell)**
- ≤ 1 perces gyakoriságnál 2.
- 2–30 percesnél 2.
- Óránkéntinél és ritkábbnál 1.
- A javulás megerősítése ugyanennyi. Kivétel, ahol a 2. pont mást ír.

**Ismétlés-elnyomás**
- Egy hibáról egy üzenet megy. Nincs ismétlés; a nyitott hibákat a reggeli jelentés újra felsorolja.
- [TULAJ] Kérjen-e 12 óránként emlékeztetőt a még nyitott PIROS hibáról? Alapból nem.

**Elnyomások, erősségi sorrendben**
1. **Karbantartás.**
   - Bekapcsolható:
     - a panelen;
     - a `deploy/figyelo/karbantartas.sh be 20 "telepítés"` paranccsal;
     - és az `up.sh` az elején magától bekapcsolja, a végén kikapcsolja [KÓD].
   - Legfeljebb 4 óráig tart.
   - Közben új riasztás nem megy ki. A végén ami még hibás, az azonnal riaszt.
2. **Némítás.** Ellenőrzésenként adható, 1, 4 vagy 24 órára, vagy „amíg meg nem javul”. Kötelező megadni az okát, és auditnaplóba kerül.
3. **Függőség.** Ha a szülő hibás, a gyerekek nem riasztanak (2.20).
4. **Csendes órák** [TULAJ]: alapból 22:00–07:00. Ilyenkor a SÁRGA nem csörög, hanem a reggeli jelentésbe kerül. A PIROS mindig csörög.
5. **Vihar.** Ha 10 percen belül több mint 8 riasztás lenne, egyetlen összevont üzenet megy: „{n} hiba egyszerre; valószínű közös ok: {legfelső hibás szülő}”.

**Reggeli összefoglaló** (07:30 Budapest; ntfy `jelentes` rövid, e-mail hosszú)
- Akkor is kimegy, ha minden rendben. Ha elmarad, az maga is jelzés: R05, külsőleg HC4.
- Tartalma (csak darabszámok, név nélkül):
  - **Összkép:** „Minden rendben”, vagy „{n} nyitott hiba, {m} figyelmeztetés”, a kezdetükkel.
  - **Az elmúlt 24 óra:** a megjavult hibák időtartammal; az éjjel visszatartott SÁRGA jelzések.
  - **Háttérfeladatok:** tegnap {n} lefutott, {m} hibás vagy elmaradt.
  - **NAV:** a reggeli letöltés {ok}/{összes} ügyfélnél sikerült; {h} hibás kapcsolat.
  - **Kiküldés:** e-mail {n} elment, {m} sikertelen; push {n}/{m}.
  - **Pénz:** díjszámla {n} kiállítva, {m} hibás; fizetés {n} sikeres, {m} sikertelen; vitatott terhelés {d}.
  - **Mentés:** az utolsó helyi és külső mentés ideje; a Storage Box telítettsége (%).
  - **Szerver:** szabad lemez és RAM.
  - **Tanúsítvány:** a legközelebbi lejárat ({host}, {nap} nap).
  - **Szintetikus próba:** {n}/24 sikeres.
  - **A következő 7 nap adóhatáridői** (`deadlinesFor()`): hány ügyfelet érint, hány emlékeztető van ütemezve.
  - **Üzleti figyelmeztetések** (2.16), csak itt: visszahívás-késés, ügyfélre váró tételek, hibás NAV-kapcsolatok.

### 1.6 (e) Külső figyelő – ha az egész szerver leáll

| Lehetőség | Költség | Előny | Hátrány | Javaslat |
|---|---|---|---|---|
| **A) Healthchecks.io Hobbyist + UptimeRobot Free** | 0 Ft/hó | Független hálózat, nincs mit üzemeltetni. Személyes adat nem megy ki, csak ping és a nyilvános URL-ek. A Healthchecks ntfy-, Telegram- és e-mail-integrációval tud riasztani. | Külső fiókot kell nyitni. Az ingyenes UptimeRobot 5 percenként néz. | **AJÁNLOTT** |
| B) Második kis VPS egy második Kumával vagy Gatusszal | A kutatás szerint a Hetzner legkisebb felhőgépe 5,49 €/hó + ÁFA Helsinkiben, 6,49 € Németországban [ellenőrizendő vásárlás előtt]. | Teljes kontroll | Üzemeltetés, frissítés, mentés | Csak ha az A) kevés |
| C) A tulaj gépe (Feladatütemező) | 0 | – | Nincs mindig bekapcsolva | nem |
| D) Better Stack Free | 0 | – | „Free for personal projects”: cégnél bizonytalan | nem |

**Healthchecks** (20 ellenőrzés ingyen, 4 kell)

| Kód | Név | Ki pingel | Periódus | Türelmi idő |
|---|---|---|---|---|
| HC1 | appok-1 él (host-szkript) | `host-allapot.sh`, 5 percenként | 5 perc | 10 perc |
| HC2 | Uptime Kuma él | a Kuma K14 monitorja, percenként | 1 perc | 5 perc |
| HC3 | Ellenőr él | `kezjegy-ellenor`, 5 percenként | 5 perc | 10 perc |
| HC4 | Reggeli jelentés elment | az ellenőr a jelentés után | 1 nap | 2 óra |

**Csatornák:** e-mail a tulaj címére (a Healthchecks saját levelezőjén, a ZeptoMailtől függetlenül) és ntfy.sh. Az ntfy.sh témája `adozz-kulso-<32 véletlen hex>`; a szerver generálja, és csak a tulaj konzolján jelenik meg (6. pont). [TULAJ] A Telegram is választható.

**UptimeRobot** (opcionális; ez az egyetlen igazán „kívülről nézett” réteg: DNS, útvonal, TLS)
- U1: `https://app.adozz.hu/`;
- U2: `https://konyvelo.adozz.hu/`;
- U3: `https://api.adozz.hu/api/v1/health`, kulcsszó `"ok":true`.
- Riasztás e-mailben és az UptimeRobot appjában.
- Az ÁSZF szerint az ingyenes csomag üzleti célra is használható (a kutatás szerint az oldal 2026-06-24-i változata).

---

## 2. Az ellenőrzések tételes listája

### 2.0 Közös szabályok

**Súlyosság**
- **PIROS:** azonnal, éjjel is; ntfy (prioritás 5) + e-mail.
- **SÁRGA:** nappal azonnal ntfy, éjjel a reggeli jelentésben.
- **INFO:** csak a panelen és a reggeli jelentésben.
- **„nincs”:** az adott környezetben nem vonatkozik rá. Ilyen például a DEMO szerveren egy csak éles üzemben értelmes ellenőrzés, vagy egy még meg nem épült funkció. A panelen halványan látszik, a mellette lévő szöveg megmondja, miért.

**Rendszerhiba vagy üzleti jelzés**
- A riasztás arról szól, hogy **a rendszer nem végezte el a dolgát**. Ilyen az el nem küldött emlékeztető, a le nem futott feladat vagy az elérhetetlen szolgáltatás.
- Az, hogy **egy ügyfél vagy a könyvelő nem lépett** (nem fizetett, nem töltött fel, késik a zárással), üzleti jelzés. Ez a könyvelői felületre és a reggeli jelentésbe tartozik, éjjel nem csörög.

**Tételformátum**
- Fejléc: **Kód · név** — súlyosság · gyakoriság · megerősítés · függ.
- Utána: Mit néz / Küszöb / Mi nem jó / Hatás / Ok / Teendő.
- A „Mióta” és a link a borítékból jön.

### 2.1 K – Kívülről (Kuma-monitorok; az ellenőr a metrikákból riaszt)

**K01 · Nyitóoldal (adozz.hu)** — PIROS · 60 mp · Kuma: 2 hiba
- Mit néz: 200, és a lapon szerepel az `id="arak"`.
- Mi nem jó: „A nyitóoldal (adozz.hu) nem tölt be: {kumaHiba}.”
- Hatás: „Az érdeklődők és a hirdetésekből érkezők hibás oldalt látnak. Az app és a panel ettől még működhet.”
- Ok: „Leállt a kezjegy-web vagy a kezjegy-proxy; hiányos landing-feltöltés (index.html vagy js/meres.js nélkül); tanúsítvány- vagy DNS-hiba.”
- Teendő: „Rendszer fül → Szerver → Konténerek (kezjegy-web, kezjegy-proxy). Ha mind fut, a legutóbbi landing-feltöltés hibás lehet: node kod/landing/build.mjs, majd feltolt.sh. Proxy-napló: docker logs --tail 100 kezjegy-proxy.”

**K02 · www átirányítás** — SÁRGA · 5 perc · 2
- Mit néz: `https://www.adozz.hu/` → 301 a `https://adozz.hu/` címre.
- Mi nem jó: „A www.adozz.hu nem irányít át az adozz.hu-ra (válasz: {kód}).”
- Hatás: „Aki www-vel írja be a címet, hibát lát.”
- Ok: „Változott az adozz.caddy www-blokkja; nem sikerült a tanúsítvány a www névre.”
- Teendő: „/srv/kezjegy/proxy/caddy/sites/adozz.caddy, www.adozz.hu blokk; atallas.sh frissit.”

**K03 · Ügyfél-webapp (app.adozz.hu)** — PIROS · 60 mp · 2
- Mi nem jó: „Az ügyfél-webapp (app.adozz.hu) nem tölt be: {kumaHiba}.”
- Hatás: „Az ügyfelek gépről és böngészőből nem tudnak belépni. A telefonos app az API-n át működhet.”
- Ok: „Leállt a kezjegy-web; üres vagy hiányos a /srv/kezjegy/web/app; proxy- vagy tanúsítványhiba.”
- Teendő: „Rendszer fül → Konténerek; ls /srv/kezjegy/web/app/index.html; szükség esetén töltsd fel újra a webappot (feltolt.sh); $DC up -d kezjegy-web.”

**K04 · Webapp régi címe (app.45-94-65-74.sslip.io)** — SÁRGA · 5 perc · 2
- Mi nem jó: „A webapp régi címe (sslip.io) nem tölt be: {kumaHiba}.”
- Hatás: „Akinek a régi cím van a könyvjelzőjében, az nem éri el az appot.”
- Ok: „Elfogyott a sslip.io Let's Encrypt-kerete, vagy nem sikerült a megújítás (az sslip.io nincs a Public Suffix Listen, ezért a keretet minden felhasználója megosztja); a sslip.io DNS-hibája (K09).”
- Teendő: „A proxy naplójában keresd a tanúsítványhibát: docker logs kezjegy-proxy 2>&1 | grep -i sslip | tail.”

**K05 · Könyvelői panel (konyvelo.adozz.hu)** — PIROS · 60 mp · 2
- Mi nem jó: „A könyvelői panel (konyvelo.adozz.hu) nem tölt be: {kumaHiba}.”
- Hatás: „Dávid és a csapat nem tud dolgozni, és a Rendszer fül sem érhető el.”
- Ok: „Leállt a kezjegy-web; hiányos a /srv/kezjegy/web/panel; proxy- vagy tanúsítványhiba.”
- Teendő: „$DC up -d kezjegy-web; ls /srv/kezjegy/web/panel/index.html; docker logs --tail 100 kezjegy-proxy.”

**K06 · Panel régi címe (sslip.io)** — SÁRGA · 5 perc · 2. Szövege a K04-ével azonos, „könyvelői panel” névvel.

**K07 · API (api.adozz.hu/api/v1/health)** — PIROS · 60 mp · 2 · **szülő:** W, X, B03
- Mit néz: JSON `ok = true` és `db = "ok"`.
- Mi nem jó: „Az API nem válaszol, vagy adatbázis-hibát jelez (válasz: {kód}, db={db}).”
- Hatás: „Az app, a panel és a telefonos app nem működik; a Stripe-webhookok sem érkeznek meg. A Stripe újrapróbálja őket, a 15 perces egyeztetés pedig pótolja.”
- Ok: „Leállt a kezjegy-api vagy kifogyott a memóriából (1280 MB); nem éri el a DB-t (D01); proxyhiba.”
- Teendő: „Rendszer fül → S02-api és D01; docker logs --tail 200 kezjegy-api; $DC up -d kezjegy-api.”

**K08 · API régi címe a telepített APK-nak (api.45-94-65-74.sslip.io)** — PIROS · 60 mp · 2 · függ: K09
- Mi nem jó: „Az API régi címe (sslip.io) nem érhető el: {kumaHiba}.”
- Hatás: „A már telepített Android-app ezt a címet hívja, ezért most nem tud csatlakozni. Ezt az ügyfél „nincs kapcsolat” hibaként látja.”
- Ok: „Tanúsítványhiba a sslip-névre (K04 ok), vagy kiesett a sslip.io névfeloldása (K09).”
- Teendő: „docker logs kezjegy-proxy | grep sslip. Tartósan: új APK az api.adozz.hu címmel (HIANYLISTA 2.18).”

**K09 · sslip.io névfeloldás** — PIROS · 10 perc · 2
- Mit néz: `api.45-94-65-74.sslip.io` A rekordja = `45.94.65.74`.
- Mi nem jó: „A sslip.io nem oldja fel a régi API-nevet (válasz: {dnsValasz}).”
- Hatás: „A telepített Android-app nem éri el a szervert. Ez külső szolgáltatás, nem a mi hibánk, de az ügyfeleinket érinti.”
- Ok: „A sslip.io üzemzavara.”
- Teendő: „Nincs azonnali javítás a mi oldalunkon. Írj a telefonos ügyfeleknek; gyorsítsd fel az api.adozz.hu-s APK kiadását.”

**K10 · Stripe-webhook cím** — SÁRGA, 60 perc után PIROS · 10 perc · 2
- Mit néz: üres `POST` → 400 (`bad_signature`).
- Mi nem jó: „A Stripe-webhook címe nem a várt választ adja ({kód}, várt: 400).”
- Hatás: „A kártyás fizetések állapota késve frissül. A 15 perces Stripe-egyeztetés pótolja, de a díjszámla és a feloldás csúszhat.”
- Ok: „Megváltozott a proxy body-korlátja vagy útvonala; hiányzik a STRIPE_WEBHOOK_SECRET (akkor a válasz nem 400); áll az API.”
- Teendő: „Rendszer fül → Fizetés és számlázás (webhook-titok). Nézd meg az adozz.caddy kezjegy_api blokkját.”

**K11 · Telefonos riasztás kívülről (jelzes.adozz.hu)** — PIROS · 60 mp · 2 · **csak e-mail** (az ntfy maga a hibás)
- Mi nem jó: „Az ntfy-szerver kívülről nem érhető el ({kumaHiba}).”
- Hatás: „A telefonodra most nem érkeznek riasztások; addig csak e-mailben kapod őket.”
- Ok: „Leállt a kezjegy-ntfy (S02-ntfy); hiányzik vagy hibás a proxy jelzes-blokkja; nem sikerült a tanúsítvány.”
- Teendő: „$FC up -d kezjegy-ntfy; docker logs --tail 100 kezjegy-ntfy; adozz.caddy jelzes-blokk.”

**K12 · A figyelő nem válaszol** — PIROS · 60 mp · 2. **A Kuma maga riaszt** (1.3). A szöveg a monitor neve: „A FIGYELŐ (kezjegy-ellenor) NEM VÁLASZOL – a többi riasztás most nem működik. ssh appok-1 → docker logs --tail 200 kezjegy-ellenor → $DC up -d kezjegy-ellenor. Addig a Kuma felületén nézd az állapotot (adozz_figyelo.cmd).”

**K13 · Kuma → ellenőr jel** és **K14 · Kuma → Healthchecks**: maguk nem riasztanak. Az R03-at, illetve a HC2-t táplálják.

### 2.2 S – Szerver (host-szkript, 2 percenként; az ellenőr a fájlt 1 percenként olvassa)

**`deploy/figyelo/host-allapot.sh`** [KÓD]
- A deploy felhasználó futtatja, cronból: `*/2 * * * *`.
- Csak olvas, és atomikusan írja a `/srv/kezjegy/figyelo/host/host_allapot.json` fájlt.
- Mit gyűjt:
  - `docker inspect` (Status, Health, RestartCount, OOMKilled, ExitCode, StartedAt) a megnevezett konténerekre;
  - `docker stats --no-stream` (memória és CPU a kerethez képest);
  - `df -P /`, `/proc/meminfo`, `/proc/loadavg`, `nproc`;
  - `timedatectl show -p NTPSynchronized --value`, a `/var/run/reboot-required`, a függő biztonsági frissítések száma [ellenőrizendő: apt-check elérhető-e];
  - a legfrissebb `db_*.dump.gpg` és `files_*.tar` ideje és mérete, a `backup.log` utolsó sora;
  - a `restic_allapot.json` mezői (a hiba-szöveggel együtt);
  - óránként `ssh storagebox df` (a resticé);
  - naponta `docker system df` (build cache), a `_regi` és a `backups/regi` mérete.
- 5 percenként pingeli a HC1-et.
- Titkot nem olvas, és nem ír ki.

**S01 · Szerver-adat friss** — SÁRGA · 1 perc · 1 · **szülő:** S02–S10, M01–M07
- Küszöb: a fájl 6 percnél régebbi.
- Mi nem jó: „A szerver állapotát gyűjtő szkript (host-allapot.sh) {perc} perce nem futott.”
- Hatás: „A konténerek, a lemez, a memória és a mentések állapota most nem látszik (szürke). Ha közben baj van, nem szólok.”
- Ok: „Megváltozott a deploy felhasználó crontabja; a szkript hibára fut; áll a cron.”
- Teendő: „crontab -l (deploy): benne kell lennie a */2 … host-allapot.sh sornak; tail -50 /srv/kezjegy/figyelo/host/futas.log.”

**S02-{konténer} · Konténer fut** — PIROS (umami: SÁRGA) · 2 perc · 1
- Konténerenként külön tétel: api, worker, db, proxy, web, ellenor, kuma, ntfy, umami, umami-db.
- Mi nem jó: „A(z) {konténer} nem fut (állapot: {status}, kilépési kód: {exit}, leállt: {ido}).”
- Hatás konténerenként:
  - api: „az app, a panel és minden API-hívás leállt”;
  - worker: „nem mennek ki az értesítések, nincs NAV-letöltés, terhelés és díjszámla”;
  - db: „minden leállt”;
  - proxy: „semmi nem érhető el kívülről, a telefonos riasztás sem”;
  - web: „a nyitóoldal, a webapp és a panel nem tölt be”;
  - ellenor: „a figyelés áll” (ilyenkor a K12 riaszt, nem ez);
  - kuma: „a nyilvános címek figyelése szünetel”;
  - ntfy: „a telefonos riasztás nem megy, csak az e-mail”;
  - umami: „a látogatottsági statisztika szünetel; az appot nem érinti”.
- Ok: „Kilépési kód 137: memória-kifogyás (S03); 1: programhiba (napló); 0: valaki leállította.”
- Teendő:
  - „docker logs --tail 200 {konténer}”;
  - indítás a fő stackben: „$DC up -d {szolgáltatás}”;
  - a proxyt: „$PC up -d”;
  - a kumát és az ntfy-t: „$FC up -d {név}”.

**S03 · Újraindulás vagy memória-kifogyás** — SÁRGA; 1 órán belül 3-nál több újraindulásnál PIROS · 2 perc · 1
- Mi nem jó: „A(z) {konténer} újraindult ({n}× az elmúlt órában; memória-kifogyás: {igen/nem}).”
- Hatás: „Rövid kiesés; hurok esetén tartós leállás.”
- Ok: „Kevés a memóriakeret (api 1280m, worker 512m, db 1g); programhiba induláskor; beállítási hiba (ConfigError: »Beállítási hiba: …« a naplóban).”
- Teendő: „docker logs --tail 200 {konténer} | grep -i -E 'hiba|error|fatal'; memória: Rendszer fül → S06.”

**S04 · Konténer-egészség (api, db)** — PIROS · 2 perc · 2
- Mi nem jó: „A(z) {konténer} fut, de a saját egészség-ellenőrzése szerint beteg (unhealthy) {perc} perce.”
- Hatás: „Az API vagy a DB hibásan válaszol. A Docker ilyenkor magától nem indítja újra [ellenőrizendő a Docker-doksiban].”
- Ok: „Az adatbázis túlterhelt vagy betelt a lemez (S05); az API nem éri el a DB-t.”
- Teendő: „docker inspect --format '{{json .State.Health}}' {konténer}; $DC restart {szolgáltatás}.”

**S05 · Lemez** — SÁRGA 20% szabad hely alatt, illetve ha 14 napon belül betelne; PIROS 10% vagy 10 GB alatt · 2 perc · 2
- Mi nem jó: „Fogy a lemez: {GB} GB ({%}) szabad; a mostani ütemmel kb. {nap} nap múlva betelik.”
- Hatás: „5 GB szabad hely alatt az app nem fogad feltöltést (files/quota.ts:33, MIN_FREE_DISK_MB=5120). Betelt lemeznél leáll az adatbázis és a mentés.”
- Ok: „Nő a backups/regi (nem törlünk); Docker build cache (11-20-án 10,65 GB); régi képek; naplók; feltöltések.”
- Teendő: „Rendszer fül → S10 (miből mennyi); a backups/regi archiválása a Storage Boxra (archív terv); docker builder prune CSAK a tulaj jóváhagyásával.”

**S06 · Memória** — PIROS 1 GB rendelkezésre álló alatt; SÁRGA 2 GB alatt, vagy ha egy konténer 10 percig a kerete 85%-a fölött van · 2 perc · 2
- Mi nem jó: „Kevés a memória: {MB} MB érhető el a szerveren.” Vagy: „A(z) {konténer} a memóriakerete {%}-át használja.”
- Hatás: „A konténert a rendszer leállíthatja (S03).”
- Ok: „Párhuzamos nagy feltöltések; a szintetikus próba (legfeljebb 1,5 GB) egybeesett egy csúccsal; memóriaszivárgás.”
- Teendő: „docker stats --no-stream; a tartósan magas konténert indítsd újra; ha visszatér, szólj a fejlesztőnek.”

**S07 · Terhelés** — SÁRGA · 2 perc · ha 15 percig fennáll
- Küszöb: a 15 perces terhelés > 12 (2 × 6 vCPU).
- Mi nem jó: „A szerver tartósan túlterhelt (terhelés: {load15}, {nproc} mag).”
- Hatás: „Lassú app és panel; a feladatok csúszhatnak.”
- Ok: „Elszabadult folyamat; restic check; képépítés.”
- Teendő: „top -o %CPU; docker stats --no-stream.”

**S08 · Óra szinkronban (NTP)** — PIROS · 2 perc · 2
- Mi nem jó: „A szerver órája nincs szinkronban (NTP: nem).”
- Hatás: „A NAV a kéréseket időbélyeg-hibával utasíthatja el (INVALID_TIMESTAMP), és a Stripe-webhook aláírás-tűrése is csak 5 perc.”
- Ok: „Leállt a systemd-timesyncd; az NTP-forgalom blokkolva van.”
- Teendő: „timedatectl; sudo systemctl restart systemd-timesyncd.”

**S09 · Frissítés és újraindítás** — SÁRGA · naponta · 1
- Mi nem jó: „Biztonsági frissítés vár {nap} napja ({n} csomag)”, vagy: „Frissítés után a szerver újraindítást kér.”
- Hatás: „Ismert sebezhetőség maradhat nyitva.”
- Ok: „Kimaradt a kézi frissítés.”
- Teendő: „Csendes időben, karbantartás bekapcsolva: sudo apt upgrade, majd sudo reboot. Utána a Rendszer fül mindent zöldre vált.”

**S10 · Helyfoglalók** — INFO · naponta
- Mit néz: Docker build cache, `_regi` és `backups/regi` mérete; a jelentésben, ha 20 GB, 10 GB, illetve 10 GB fölött van.
- Szöveg: „A Docker build cache {GB} GB, a _regi {GB} GB, a backups/regi {GB} GB.”

### 2.3 M – Mentés

**M01 · Óránkénti adatbázis-mentés** — PIROS · 5 perc · 1
- Mit néz: a `backup.last` és a legfrissebb `db_*.dump.gpg` 75 percnél nem régebbi, és nem 0 bájtos.
- Mi nem jó: „Az óránkénti adatbázis-mentés {perc} perce nem futott le sikeresen. A napló utolsó sora: {backupLogUtolso}.”
- Hatás: „Baj esetén {perc} percnyi adat veszhet el.”
- Ok: „Áll a cron; a pg_dump hibára fut (DB-hiba, D01); nincs hely (S05); hiányzik a .backup_pass.”
- Teendő: „tail -20 /srv/kezjegy/backups/backup.log; kézi futtatás: bash /srv/kezjegy/deploy/backup.sh.”

**M02 · Napi fájl-pillanatkép** — SÁRGA · óránként · 1
- Küszöb: a legfrissebb `files_*.tar` 26 óránál régebbi.
- Mi nem jó: „A napi irat-pillanatkép (files_*.tar) {óra} órája nem készült el.”
- Hatás: „A helyi irat-visszaállítás régebbi állapotra esne vissza. A külső mentés (restic) ettől még óránként viszi a fájlokat.”
- Ok: „A 03:05-ös futás hibára futott; nincs hely.”
- Teendő: „grep 'files snapshot' /srv/kezjegy/backups/backup.log | tail -3; FILES=1 bash /srv/kezjegy/deploy/backup.sh.”

**M03 · Külső mentés (restic → Storage Box)** — PIROS · 5 perc · 1
- Mit néz:
  - `eredmeny == "ok"`, és az `utolso_sikeres_mentes` 75 percen belül van;
  - címkénként: `db` és `files` 75 percen belül, `config` és `app` 26 órán belül [ellenőrizendő: a `--skip-if-unchanged` frissíti-e az `utolso_siker_cimkenkent` mezőt].
- Mi nem jó: „A külső mentés hibás: {hibaMezo}. Utolsó teljesen sikeres: {ido}. Lemaradt címkék: {cimkek}.”
- Hatás: „Ha a szerver elveszne, a legutóbbi sikeres külső mentésig tudnánk visszaállni.”
- Ok: „Nem érhető el a Storage Box (ssh-kulcs, hálózat); betelt (M04); restic-zár maradt egy megszakadt futás után.”
- Teendő: „tail -40 /srv/kezjegy/backups/restic.log; kézi futtatás: bash /srv/kezjegy/deploy/restic-mentes.sh. Zárnál: restic unlock (csak ha biztosan nem fut más).”

**M04 · Storage Box helye** — SÁRGA 80%, PIROS 90% fölött · óránként · 1
- Mi nem jó: „A Storage Box {%}-a foglalt ({GB} GB szabad; közös a többi archívummal).”
- Hatás: „Betelt tárhelynél leáll a külső mentés.”
- Ok: „Nő a restic-tár és a többi archívum (Hetzner-archív).”
- Teendő: „Nagyobb Storage Box-csomag, vagy a régi archívumok rendezése [TULAJ]. Törlés csak a tulaj kifejezett döntésével.”

**M05 · Mentés épsége (heti `restic check`)** — PIROS hibánál, SÁRGA ha 8 napja nem futott · naponta · 1 · [TULAJ jóváhagyás]
- Futás: vasárnap 04:40, `deploy/figyelo/restic-check.sh`, `--read-data-subset=n/7`. Az `n` hetente forog, így 7 hét alatt minden adat sorra kerül.
- Mi nem jó: „A külső mentés ellenőrzése hibát talált: {kimenetRovid}.”
- Hatás: „Lehet, hogy a mentésből nem tudnánk visszaállni.”
- Ok: „Sérült adatcsomag a Storage Boxon; megszakadt mentés.”
- Teendő: „restic check teljes futtatása (hosszú); restic repair csak fejlesztővel együtt.”

**M06 · Visszaállítási próba** — SÁRGA, ha 35 napja nem volt sikeres · naponta · 1
- A `deploy/restore-proba.sh` a végén ír egy `/srv/kezjegy/figyelo/host/restore_proba.json` fájlt [KÓD]. Havi cron, a hónap első vasárnapján 05:10 [TULAJ].
- Mi nem jó: „{nap} napja nem volt sikeres visszaállítási próba (utolsó eredmény: {eredmeny}).”
- Hatás: „Nem tudjuk biztosan, hogy a mentés visszaállítható.”
- Teendő: „bash /srv/kezjegy/deploy/restore-proba.sh.”

**M07 · Statisztika-mentés (Umami, napi)** — SÁRGA · naponta · 1 · csak ha az Umami fut
- Mi nem jó: „Az Umami napi mentése (umami_*.dump.gpg) {óra} órája nem készült el.”
- Hatás: „Csak a látogatottsági statisztikát érinti.”
- Teendő: „grep umami /srv/kezjegy/backups/backup.log | tail -3.”

### 2.4 H – Háttérfeladatok (worker)

**H01 · Háttérfolyamat él** — PIROS · 1 perc · 2 · függ: D01, S02-worker
- Mit néz: a `worker.heartbeat` 2 percen belül van.
  - Ehhez [KÓD] a szívverés külön 30 mp-es időzítőn fusson, ne a kör elején (worker.ts:105-120). Ma egy hosszú `nav_sync` alatt áll, és a panel 10 perc után hamisan pirosat mutat (Rendszer.tsx:183).
  - Átmenetileg, a javításig: 3 perc, VAGY van futó feladat 90 percnél frissebb `startedAt`-tal.
- Mi nem jó: „A háttérfolyamat {perc} perce nem jelentkezett (utolsó jel: {ido}).”
- Hatás: „Nem mennek ki az értesítések és az emlékeztetők, nem fut a NAV-letöltés, a havidíj-terhelés és a díjszámlázás.”
- Ok: „Leállt vagy hurokban van a kezjegy-worker (S02, S03); elfogyott a memóriája (512 MB); nem éri el a DB-t; nem futottak le a migrációk (a worker ilyenkor vár, majd 5 perc után kilép: worker.ts:42-46).”
- Teendő: „docker logs --tail 200 kezjegy-worker; $DC up -d kezjegy-worker.”

**H02 · Elakadt feladat** — SÁRGA a várható maximális futásidő fölött, PIROS a kétszerese fölött · 1 perc · 1
- Mit néz: `job.*.running = true`, és `startedAt` régebbi, mint az adatlap `futasMaxPerc` értéke. Ez a `nav_sync`-nél 90 perc, a többinél alapból 30 perc.
- Mi nem jó: „A(z) {feladatNeve} {perc} perce fut (várható: legfeljebb {max} perc).”
- Hatás: „A worker körében utána következő feladatok sem futnak, amíg ez véget nem ér.”
- Ok: „Lassú vagy nem válaszoló külső szolgáltatás (NAV, Stripe, Számlázz.hu, SMTP); hosszú DB-zár (D03); nagyon sok ügyfél.”
- Teendő: „docker logs --tail 200 kezjegy-worker; ha valóban áll: $DC restart kezjegy-worker (a slot ilyenkor lefoglalva marad; lásd H03 Újrafuttatás).”

**H03 · Hibával leállt feladat** — súlyossága az adatlap szerint (lásd a táblázatot) · 1 perc · 1
- Mit néz: a legutóbbi slot `ok = false`.
- Mi nem jó: „Hibával állt le: {feladatNeve} ({slot}). Hiba: {error}.”
- Hatás: „{adatlap.hatas}. A rendszer ugyanebben az időablakban nem próbálja újra (jobs.ts:399-423). A következő próba: {kovetkezo}.”
- Ok: „Lásd a hibaszöveget; gyakori: DB-hiba, külső szolgáltatás, programhiba egy új kiadás után.”
- Teendő: „Ha a hiba oka megszűnt: Rendszer fül → Háttérfeladatok → »Újrafuttatás« (felszabadítja a slotot, a worker 30 mp-en belül újra futtatja; a feladatok a slotjukra idempotensek, jobs.ts:1-2) [KÓD]. Ha programhiba: másold be ezt az üzenetet egy Claude-munkamenetbe.”

**H04 · Késő vagy elmaradt feladat** — súlyossága az adatlap szerint · 1 perc · 1
- Számítás:
  - Időszakos feladatoknál (perc, 5 perc, 15 perc, óra): ha a legutóbbi befejezés `at` régebbi, mint a periódus + türelmi idő, a feladat késik. A slot-szövegek nem rendezhetők betűrendben („T9:5”), ezért időt hasonlítunk.
  - Naptári feladatoknál: `vart = job.slot(most − türelem)`. Ha ez nem null, és a tárolt slot ≠ `vart`, akkor a feladat késik vagy elmaradt.
- Két változat van:
  - **késik** (az ablak még nyitva): „A(z) {feladatNeve} {perc} perce esedékes, de még nem futott le. Ma {ablakVege}-ig még lefuthat.”
  - **elmaradt** (az ablak bezárult): „A(z) {feladatNeve} {nap} napi futása elmaradt, és magától már nem pótlódik.”
- Hatás: `{adatlap.hatas}`.
- Ok: „A worker állt (H01) vagy elakadt (H02).”
- Teendő:
  - késésnél: „Nézd meg a H01–H02-t”;
  - elmaradásnál: „Rendszer fül → »Pótlás most« (a feladatot a mai slottal futtatja) [KÓD]; előtte nézd meg az adatlap pótlási megjegyzését.”

**H05 · Indítási adatlépés hibás** — SÁRGA · 5 perc · 1
- [KÓD] A worker induló adatlépései ma csak naplóba írnak (worker.ts:49-101). Ezentúl minden lépés eredménye bekerül a `system_state` `adatlepes.<név>` kulcsába.
- Mi nem jó: „Indításkor hibára futott a(z) {lepes} adatlépés: {error}.”
- Hatás: „Egy egyszeri adatjavítás nem ment végbe (pl. szövegek, jelölések).”
- Teendő: „docker logs kezjegy-worker | grep 'data step'; másold be egy Claude-munkamenetbe.”

**H06 · Futásidő-eltérés** — INFO · naponta. Ha egy feladat futásideje 60 mp felett van, és több, mint a 7 napos medián háromszorosa, bekerül a jelentésbe.

**A háttérfeladatok figyelési adatlapja** (a `jobDefs()` mai tartalma: jobs.ts:327-393, jobs-k28.ts:107-152, jobs-k29.ts, jobs-k29f.ts, jobs-tulaj1119.ts:217-245)

| Feladat | Magyar név | Mikor (Budapest) | Ablak | Késés-küszöb | Súly (hiba / elmaradás) | Hatás, ha nem fut |
|---|---|---|---|---|---|---|
| `nav_sync` | NAV-számlák napi letöltése | 05:30 (`NAV_SYNC_HOUR`) | aznap éjfélig | 06:30 | PIROS / PIROS | nem jönnek le az új számlák, a keret és az adó elavult |
| `billing` | havidíj-terhelés | 06:00 | aznap | 07:00 | PIROS / PIROS | nem terhelődik a havidíj |
| `termination_effective` | felmondások hatálybalépése | 06:10 | aznap | 07:10 | PIROS / PIROS | a felmondott ügyfél nem zárul le |
| `monthly` | havi indítás (dossziék, kivonatkérés) | hó 1. 06:10 | **csak hó 1.** | 07:10 | PIROS / PIROS | nincs havi dosszié és kivonatkérés |
| `service_lock_check` | díjtartozás miatti zárolás | 06:20 | aznap | 07:20 | PIROS / SÁRGA | késik a zárolás vagy a feloldás |
| `reminders` | adó- és kérés-emlékeztetők | 08:00 | aznap | 09:00 | PIROS / PIROS | az ügyfél nem kap befizetési emlékeztetőt |
| `reminders_k28` | emlékeztetők (kivonat, nyugta, KATA, HIPA, „vár rád”) | 08:00 | aznap | 09:00 | PIROS / PIROS | mint fent |
| `staff_digest` | a csapat napi levele | 08:00 | aznap | 09:00 | SÁRGA / SÁRGA | a csapat nem kap napi összesítőt |
| `assist_overdue` | „Intézzük helyetted”: késés | 09:00 | aznap | 10:00 | SÁRGA / SÁRGA | elmarad a késés-jelzés |
| `annual_reminders` | éves zárás emlékeztetői | 09:00 | aznap | 10:00 | PIROS / PIROS | az éves kérdőív és határidő-emlékeztető elmarad |
| `allowance_check_monthly` | havi keret-ellenőrzés | hó 1. 09:00 | **csak hó 1.** | 10:00 | SÁRGA / PIROS | elmarad a keret-figyelmeztetés |
| `checkin_open` | havi check-in megnyitása | a hónap első munkanapja, 09:00 | **csak aznap** | 10:00 | PIROS / PIROS | nem nyílik meg a havi check-in |
| `registration_reminders` | vállalkozásindítás-emlékeztető | 10:00 | aznap | 11:00 | SÁRGA / SÁRGA | elmarad az emlékeztető |
| `kamara_reminders` | kamarai regisztráció emlékeztető | 10:00 | aznap | 11:00 | SÁRGA / SÁRGA | elmarad az emlékeztető |
| `predebit` | terhelés előtti értesítő | 10:00 | aznap | 11:00 | PIROS / PIROS | előzetes értesítés nélkül jönne a terhelés |
| `suspension_warning` | felfüggesztés előtti figyelmeztetés | 10:05 | aznap | 11:05 | PIROS / PIROS | figyelmeztetés nélkül jönne a felfüggesztés |
| `gdpr` | GDPR-határidők (törlés, lejárat) | 03:30 | aznap | 04:30 | SÁRGA / SÁRGA | késik az esedékes törlés |
| `new_year` | évnyitás (adóprofilok) | jan. 1. 00:10 | **csak jan. 1.** | 01:10 | PIROS / PIROS | nincs új évi adóprofil |
| `allowances_new_year` | éves keretek nyitása | jan. 1. 00:20 | **csak jan. 1.** | 01:20 | PIROS / PIROS | nincs új évi keret |
| `allowance_check_yearly` | éves keret-ellenőrzés | jan. 5. 09:00 | **csak jan. 5.** | 10:00 | SÁRGA / PIROS | elmarad az éves ellenőrzés |
| `annual_open` | éves zárás megnyitása | jan. 5. 09:00-tól | jan. 31-ig (a slot az év) | jan. 5. 10:00 | PIROS / PIROS | nem nyílik meg az éves zárás |
| `invoices_issue` | díjszámlák kiállítása | percenként | – | 3 perc | PIROS / PIROS | a befolyt díjról nem készül számla |
| `gdpr_export` | adatexport-kérések | percenként | – | 3 perc | SÁRGA / SÁRGA | késik az export |
| `every5` | kiküldés + jelölések + visszahívás-SLA | 5 percenként | – | 10 perc | PIROS / PIROS | nem mennek ki az értesítések (`dispatchPending`) |
| `assist_approvals` | „Intézzük helyetted”: jóváhagyások | 15 percenként | – | 20 perc | SÁRGA / SÁRGA | késnek a jóváhagyások |
| `payments_reconcile` | Stripe-egyeztetés | 15 percenként | – | 20 perc | PIROS / PIROS | elveszett webhook pótlása elmarad |
| `hourly` | óránkénti kör (push-nyugták) | óránként | – | 70 perc | SÁRGA / SÁRGA | a hibás push-tokenek nem tiltódnak le |
| `ad_conversions` | hirdetési konverziók (csak ha be van kapcsolva) | 5 percenként | – | 10 perc | SÁRGA / SÁRGA | a hirdetési mérés hiányos |

**Kiegészítés a jövőre** [KÓD]: ha a KATA havi követése, az éves SZJA-ciklus és a NAV-folyószámla egyeztetése megépül (HIANYLISTA 1.8, KONYVELO_LEFEDETTSEG), minden új feladatuk ide kap sort. Különben a teszt nem engedi be őket.

### 2.5 D – Adatbázis

**D01 · Adatbázis válaszol** — PIROS · 30 mp · 2 · **szülő:** szinte minden belső ellenőrzés
- Mit néz: az ellenőr saját kapcsolatán egy `select 1` 2 mp-en belül válaszol.
- Mi nem jó: „Az adatbázis nem válaszol ({hiba}).”
- Hatás: „Minden leállt: app, panel, háttérfeladatok, mentés.”
- Ok: „Leállt a kezjegy-db (S02-db); betelt a lemez (S05); elfogytak a kapcsolatok (D02); memória-kifogyás.”
- Teendő: „docker logs --tail 100 kezjegy-db; df -h /; $DC up -d kezjegy-db.”

**D02 · Kapcsolatok** — SÁRGA · 5 perc · 2
- Küszöb: a `kezjegy_app` kapcsolatainak száma > 32 (a határ 40, db-roles.sh:32), vagy az összes kapcsolat > 80% a `max_connections`-hez képest.
- Mi nem jó: „Sok az adatbázis-kapcsolat: {n}/{max}.”
- Hatás: „Elfogyhatnak a kapcsolatok, ekkor az API hibázik.”
- Ok: „Kapcsolatszivárgás; beragadt kérések.”
- Teendő: „Rendszer fül → D03; az API újraindítása felszabadítja a kapcsolatokat.”

**D03 · Hosszú lekérdezés vagy beragadt tranzakció** — SÁRGA · 1 perc · 2
- Küszöb: 5 percnél régebben aktív lekérdezés, vagy 10 percnél régebben `idle in transaction` állapotú kapcsolat.
- Mi nem jó: „{perc} perce fut egy lekérdezés ({alkalmazas}, {allapot}).”
- Hatás: „Zárolhat táblákat, és lassíthatja vagy megállíthatja a feladatokat.”
- Teendő: „A Rendszer fülön a lekérdezés eleje és a pid látszik (csak adminnak); végső esetben pg_cancel_backend(pid) fejlesztővel.”

**D04 · Migrációk** — PIROS · 5 perc · 1
- Mit néz: a `drizzle.__drizzle_migrations` sorainak száma nem kisebb, mint a journal bejegyzéseinek száma (ugyanaz a szabály, mint a worker.ts:17-26-ban).
- Mi nem jó: „Az adatbázis-séma le van maradva: {n} migráció hiányzik.”
- Hatás: „Az új kód hibára futhat, a worker nem indul el.”
- Ok: „Nem futott le az up.sh migrációs lépése (kezjegy-migrate).”
- Teendő: „bash /srv/kezjegy/deploy/up.sh (a migrációt is lefuttatja).”

**D05 · Adatbázis mérete** — INFO · naponta. A méret és a 30 napos növekedés bekerül a jelentésbe.

### 2.6 W – API

**W01 · Belső hibák (5xx)** — SÁRGA 5 perc alatt legalább 10 esetnél; PIROS legalább 50 esetnél, vagy ha legalább 20 kérésből 20% hibás · 1 perc · 2 · függ: K07
- [KÓD] Egy API-middleware percenként beírja a `system_state` `api.forgalom` kulcsba:
  - a kérések számát;
  - az 5xx-ek számát;
  - az utolsó 10 hiba útvonal-mintáját (pl. `/api/v1/client/documents/:id`; azonosító és lekérdezőszöveg nélkül), a kódjával és az idejével.
- Mi nem jó: „Az API 5 perc alatt {n} belső hibát adott ({%}); leggyakoribb: {utvonalMinta} ({kod}).”
- Hatás: „Az ügyfelek egy része hibaüzenetet lát az adott funkciónál.”
- Ok: „Programhiba egy új kiadásban; külső szolgáltatás hibája; DB-hiba.”
- Teendő: „docker logs --tail 300 kezjegy-api | grep -E '\"level\":(50|60)'; másold be egy Claude-munkamenetbe.”

**W02 · Lassú válaszok** — SÁRGA · 1 perc · 10 percig fennálló p95 > 2 mp. 2. fázis, ugyanabból a számlálóból.

### 2.7 N – NAV

**N01 · NAV Online Számla elérhető** — SÁRGA · 5 perc · 2 · **szülő:** N02, N08
- Mit néz: `GET https://api.onlineszamla.nav.gov.hu/invoiceService/v3/queryTaxpayer`, elvárt válasz: 405. `NAV_MODE=test` esetén az `api-test` címet nézi.
- Mi nem jó: „A NAV Online Számla rendszere nem érhető el (válasz: {kod}).”
- Hatás: „A számlák letöltése és az adószám-lekérdezés most nem megy. A napi letöltés másnap pótolja: a kurzor csak siker után lép (navsync.ts:156).”
- Ok: „NAV-karbantartás (a NAV fejlesztői naplója); hálózati hiba.”
- Teendő: „https://onlineszamla.nav.gov.hu/fejlesztoi_naplo – ha tervezett karbantartás, nincs teendő.”

**N02 · Napi letöltés: NAV-oldali kiesés** — SÁRGA; ha 2 egymás utáni napon fennáll: PIROS · a letöltés után és óránként · 1
- Mit néz: a mai slot `nav_sync_runs` hibái, `error_code` szerint, a `NAV_ERROR_MAP` `unavailable` fajtája (nav-kliens/src/errors.ts). A darabszám szerepel, név nem.
- Mi nem jó: „A ma reggeli NAV-letöltés {n} ügyfélnél nem sikerült, mert a NAV nem volt elérhető ({kodok}).”
- Hatás: „Ezeknél az ügyfeleknél a mai számlák holnap jönnek le. A keret és az adó addig egy nappal elavult.”
- Teendő: „Nincs; ha 2. napja tart: Rendszer fül → N02 részletek (ügyfélnevek), és szólj Dávidnak.” [DÁVID D1: hány nap után kell kézzel beavatkozni egy határidő előtt]

**N03 · Napi letöltés: programhiba** — PIROS · a letöltés után · 1
- Mit néz: `bug` fajta (INVALID_REQUEST, SCHEMA_VIOLATION, *_VERSION, *_HASH_CRYPTO, BAD_QUERY_PARAM_* a `data` fajta kivételével), valamint INTERNAL.
- Mi nem jó: „Programhiba a NAV-lekérdezésben ({kodok}) {n} ügyfélnél.”
- Hatás: „Az érintett ügyfeleknek nem jönnek a számláik. Az ügyfél azt látja: »Szóltunk a fejlesztőknek« (errors.ts:40). Ez az üzenet mostantól igaz.”
- Ok: „Változott a NAV-séma vagy -verzió; hibás kérés egy kiadás után.”
- Teendő: „Rendszer fül → N03 részletek; másold be egy Claude-munkamenetbe a kóddal együtt.”

**N04 · NAV-elutasítás időbélyeg miatt** — PIROS · a letöltés után · 1 · függ: S08
- Mit néz: INVALID_TIMESTAMP (`clock` fajta).
- Mi nem jó: „A NAV a szerver órája miatt utasította el a kéréseket ({n} ügyfél).”
- Teendő: „Lásd S08.”

**N05 · Elakadt letöltés** — PIROS · óránként · 1
- Mit néz: `error_code = 'STALE'` (2 óránál régebbi futás, navsync.ts:115-119).
- Mi nem jó: „{n} NAV-letöltés 2 óránál tovább »fut« állapotban ragadt.”
- Ok: „A worker futás közben leállt.”
- Teendő: „Lásd H01–H02; a következő futás magától lezárja őket.”

**N06 · Hibás NAV-kapcsolatok** — üzleti jelzés: INFO a jelentésben. **SÁRGA** csak akkor, ha 24 órán belül legalább 3-mal nőtt a számuk (rendszerszintű ok gyanúja) · naponta 06:45 · 1
- Mi nem jó: „Ma {n} ügyfél NAV-kapcsolata vált hibássá (összesen {m}).”
- Hatás: „A napi letöltés kihagyja őket (navsync.ts:225-229). A k7b-levél ügyfelenként csak egyszer megy ki.”
- Ok: „Egyszerre sok: NAV-oldali változás, vagy a mi titkosítókulcsunk (NAV_CRED_KEY) körüli hiba. Egyenként: az ügyfél megváltoztatta a technikai felhasználó jelszavát.”
- Teendő: „Rendszer fül → N06 (nevek). Javítás: ügyfél adatlap → Bekötés → NAV-kapcsolat → Új adatok megadása.” [DÁVID D3: kapjon-e az ügyfél is jelzést]

**N07 · Régen frissült ügyfél** — SÁRGA · naponta 07:00 · 1
- Mit néz: `status = 'rendben'`, de `lastSyncAt` 48 óránál régebbi.
- Mi nem jó: „{n} ügyfélnél 48 óránál régebben volt sikeres NAV-letöltés, pedig a kapcsolata rendben van.”
- Hatás: „Elavult keret és adóelőleg.”
- Teendő: „Rendszer fül → N07 részletek; panel → ügyfél → »Lekérdezés most«.”

**N08 · Adószám-kereső (a saját NAV technikai felhasználónk)** — PIROS auth/permission hibánál, SÁRGA elérhetetlenségnél · 60 perc · 1 · csak éles üzemben (DEMO-ban „nincs”: a `NAV_LOOKUP_USER` üres)
- Mit néz: `queryTaxpayer` a saját törzsszámunkra (Somosi Kft., brand.json `provider.taxNumber`) [ellenőrizendő: a NAV gyakorisági korlátja].
- Mi nem jó: „A saját NAV technikai felhasználónk hibás (adószám-kereső): {messageHu}.”
- Hatás: „Az új ügyfelek nem tudják lekérni a cégadataikat a bekötéskor (503: lookup_not_configured, adoszam-kereso.ts:50-56, 88).”
- Ok: „Lejárt vagy megváltozott a technikai felhasználó jelszava vagy aláírókulcsa; visszavont jogosultság.”
- Teendő: „NAV Online Számla felület → Felhasználók → technikai felhasználó; az új adatokat a kezjegy_kulcsok.ps1-gyel add meg.”

### 2.8 E – E-mail

**E01 · Levélküldés módja** — PIROS · indításkor és naponta · 1 · DEMO-ban „nincs” („a levelek szándékosan a DEMO-postafiókba mennek”)
- Mit néz: éles üzemben `mail.mode == 'smtp'`. Ha nem, a levelek csendben `disabled` állapotúak (mailer.ts:70-73).
- Mi nem jó: „Éles szerveren ki van kapcsolva a levélküldés (mód: {mode}).”
- Hatás: „Nem mennek ki belépési kódok és értesítések (notify.ts:438: mail_not_configured).”
- Teendő: „SMTP_HOST és MAIL_FROM a .env-ben (kezjegy_kulcsok.ps1); a MAIL_MODE ne legyen demo.”

**E02 · SMTP-kapcsolat (ZeptoMail)** — PIROS · 15 perc · 2 · **szülő:** E03–E05
- Mit néz [KÓD]: `transport.verify()` (kapcsolat + STARTTLS + AUTH, levél nélkül) a `.env` `SMTP_*` adataival. A Mailerbe új `verify()` metódus kell (mailer.ts:46-58). DEMO-ban is fut, mert az adatok megvannak.
- Mi nem jó: „Az e-mail-küldő (ZeptoMail) nem fogadja a kapcsolódást: {smtpHiba}.”
- Hatás: „Nem mennek ki a belépési kódok, az értesítő levelek és a díjszámla-levelek. A telefonos riasztás (ntfy) ettől működik.”
- Ok: „535 = hibás vagy visszavont SMTP-jelszó; elfogyott a ZeptoMail-kredit vagy lejárt a csomag; a ZeptoMail üzemzavara; zárva a kimenő 587-es port.”
- Teendő: „ZeptoMail-fiók → Mail Agents → SMTP (él-e a jelszó) és a kreditegyenleg. Az új jelszót a kezjegy_kulcsok.ps1-gyel add meg.”

**E03 · Levél-lemaradás** — SÁRGA, ha 15 percnél régebben vár levél; PIROS, ha több mint 20 levél vár, vagy valamelyik 60 percnél régebben · 5 perc · 2
- Mit néz: a `want_email` értesítések közül azok, ahol az `email_sent_at` üres, és a sor 15 percnél régebbi.
- Mi nem jó: „{n} értesítő levél vár kiküldésre (a legrégebbi {perc} perce).”
- Hatás: „Az ügyfelek késve kapják a leveleket. Hiba esetén a rendszer 3 napig próbálkozik (notify.ts:367-380, 441-444).”
- Ok: „E02; áll a worker (H01, `every5`).”
- Teendő: „Lásd E02 és H01.”

**E04 · Sikertelen levelek** — SÁRGA óránként legalább 1, PIROS óránként legalább 5 · 5 perc · 1
- Mit néz [KÓD]: a `notifications.error` az elmúlt órában, és egy új számláló a közvetlen sablonlevelek hibáiról (`system_state` `mail.hibak`). Ilyen levél a NAV-hiba levél és a szerződéslevél (notify.ts:351-357, contracts.ts:89-91); ma ezek hibája csak naplósor.
- Mi nem jó: „{n} levél nem ment ki az elmúlt órában ({sablonok}; hiba: {hibakod}).”
- Hatás: „Az érintettek nem kapták meg a levelet.”
- Teendő: „Lásd E02; ha csak egy sablon hibás: másold be egy Claude-munkamenetbe.”

**E05 · Belépési és regisztrációs kódok** — PIROS · 5 perc · 1
- Mit néz: a `mail.hibak` `auth_*` sablonjai, 15 percen belül legalább 1.
- Mi nem jó: „{n} belépési vagy regisztrációs kódot tartalmazó levél nem ment ki 15 percen belül.”
- Hatás: „Új ügyfél nem tud regisztrálni, és aki kódot kér, nem tud belépni.”
- Teendő: „Lásd E02.”

### 2.9 P – Push

**P01 · Push-mód** — PIROS · indításkor és naponta · 1 · DEMO-ban „nincs”
- Mit néz: éles üzemben `PUSH_MODE=expo` (config.ts:348-350).
- Mi nem jó: „Éles szerveren ki van kapcsolva a telefonos értesítés (mód: {mode}).”

**P02 · Expo elérhető** — SÁRGA · 5 perc · 2
- Mit néz: `GET https://exp.host/--/api/v2/push/send`, elvárt válasz: 405.
- Mi nem jó: „Az Expo push-szolgáltatás nem érhető el ({kod}).”
- Hatás: „A telefonos értesítések késnek. Mivel a `pushSentAt` a küldés előtt kap értéket, a kiesés alatt küldöttek elvesznek (notify.ts:390, 414-416).”
- Teendő: „Nincs a mi oldalunkon; ha tartós, a fontos üzenetek e-mailben is mennek.”

**P03 · Push-hibák** — PIROS InvalidCredentials vagy MismatchSenderId esetén; SÁRGA, ha óránként legalább 5 küldési kivétel van · 15 perc · 1
- Mit néz [KÓD]: ma a nyugtákból csak a DeviceNotRegistered számít (notify.ts:409, 466). Mostantól minden nyugta-hibakód és küldési kivétel bekerül a `system_state` `push.hibak` kulcsba, és megszűnik az elnyelés is (jobs.ts:234 `.catch(() => 0)`).
- Mi nem jó: „A telefonos értesítések nem mennek ki: az Expo »{hibakod}« hibát ad ({n} értesítés az elmúlt órában).”
- Hatás: „Az ügyfelek nem kapnak push-értesítést.”
- Ok: „InvalidCredentials: érvénytelen FCM- vagy APNs-kulcs az Expo-fiókban; MismatchSenderId: rossz Firebase-projekt.”
- Teendő: „expo.dev → projekt → Credentials; FCM V1 szolgáltatásfiók-kulcs.”

**P04 · Push-lemaradás** — SÁRGA · 5 perc · 2
- Mit néz: `wantPush`, `pushSentAt` üres, 15 percnél régebbi sor.
- Mi nem jó: „{n} telefonos értesítés vár kiküldésre (a legrégebbi {perc} perce).”
- Teendő: „Lásd H01 (`every5`).”

### 2.10 F – Fizetés (Stripe)

**F01 · Fizetési beállítás** — PIROS éles üzemben · indításkor és naponta · 1 · DEMO-ban „nincs”
- Mit néz: `paymentProvider = 'stripe'`, `stripe = 'live'`, van webhook-titok (payments-k29.ts:363-366).
- Mi nem jó: „Éles szerveren a kártyás fizetés nincs élesre állítva: {mi hiányzik}.”
- Teendő: „stripe_szerverre.ps1 -Eles (HIANYLISTA 1.16).”

**F02 · Stripe-kulcs él** — PIROS · 15 perc · 2
- Mit néz: csak olvasó hívás a Stripe API-ra [ellenőrizendő: melyik végpontot engedi a használt (restricted) kulcs].
- Mi nem jó: „A Stripe elutasítja az API-kulcsunkat ({kod}: {stripeHiba}).”
- Hatás: „Nem lehet kártyával fizetni, és a havidíj sem terhelődik.”
- Ok: „Visszavont vagy lecserélt kulcs; korlátozott kulcs hiányzó joggal; zárolt Stripe-fiók.”
- Teendő: „dashboard.stripe.com → Developers → API keys; új kulcs: stripe_szerverre.ps1.”

**F03 · Fennakadt Stripe-esemény** — PIROS · 5 perc · 1
- Mit néz: `stripe_events`, ahol `attempts >= 3`, és nincs feldolgozva.
- Mi nem jó: „{n} Stripe-esemény 3 próbálkozás után sem dolgozódott fel (utolsó hiba: {lastError}).”
- Hatás: „Egy fizetés, visszatérítés vagy vita nem került be a rendszerbe.”
- Teendő: „Rendszer fül → Fizetés és számlázás; a hibaszöveggel együtt másold be egy Claude-munkamenetbe.”

**F04 · Feldolgozásra váró Stripe-esemény** — SÁRGA · 5 perc · 1
- Mit néz: feldolgozatlan esemény, amely 1 óránál régebben érkezett.
- Mi nem jó: „{n} Stripe-esemény több mint 1 órája vár feldolgozásra.”
- Teendő: „Lásd H01 és F03.”

**F05 · Egyeztetés eredménye** — SÁRGA, ha `errors > 0`; INFO, ha `applied > 0` · 15 perc · 2
- Mi nem jó: „A Stripe-egyeztetés {n} hibát jelzett: {elsoHiba}.” Az INFO szövege: „Az egyeztetés {n} elmaradt webhookot pótolt.”
- Teendő: „Ha az INFO gyakran előfordul: a Stripe-ban a webhook-végpont (K10).”

**F06 · Webhook-csend** — SÁRGA · naponta · 1
- Mit néz: 7 napja nem jött webhook (`stripe.last_webhook`), pedig volt Stripe-fizetés.
- Mi nem jó: „7 napja nem érkezett Stripe-webhook, pedig volt kártyás fizetés.”
- Ok: „A Stripe felületén rossz vagy kikapcsolt a webhook-végpont, vagy lecserélődött a titok.”
- Teendő: „dashboard.stripe.com → Developers → Webhooks: az api.adozz.hu/api/v1/webhooks/stripe engedélyezve van-e.”

**F07 · Bizonytalan fizetés** — SÁRGA (csak nappal) · óránként · 1
- Mit néz: `hitelesites_kell` vagy `bizonytalan` állapotú fizetés, 24 óránál régebbről.
- Mi nem jó: „{n} kártyás fizetés 24 órája bizonytalan vagy hitelesítésre vár.”
- Teendő: „Rendszer fül → Fizetések.”

**F08 · Vitatott terhelés (dispute)** — PIROS · 5 perc · 1
- Mi nem jó: „Új vitatott kártyás terhelés érkezett ({n} db).”
- Hatás: „A Stripe a vitatott összeget visszatarthatja. A válaszadásra határidő van, amit a Stripe felülete mutat.”
- Teendő: „Admin → Fizetések; dashboard.stripe.com → Disputes.”

**F09 · SimplePay utólagos állapot** — SÁRGA · 15 perc · 1
- Mit néz: `paymentAlerts`.
- Mi nem jó: „{n} SimplePay-tranzakció végleges állapot után változott ({allapotok}).”
- Teendő: „Nézd meg a SimplePay kereskedői felületén.”

### 2.11 Z – Számlázás (Számlázz.hu)

**Z01 · Díjszámla nem készült el** — PIROS · 5 perc · 1
- Mit néz: `fee_invoices.status = 'hiba'` (5 próbálkozás után, invoices.ts:231-265).
- Mi nem jó: „{n} díjszámla nem készült el 5 próbálkozás után (utolsó hiba: {kod}).”
- Hatás: „A fizetés megtörtént, de számla nincs.”
- Teendő: „Admin → Díjszámlák → újraküldés; ha az Agent-kulcs a hibás: Z06.”

**Z02 · Elakadt díjszámla** — SÁRGA · 15 perc · 1
- Mit néz: `folyamatban` 1 óránál tovább.
- Mi nem jó: „{n} díjszámla 1 óránál tovább »folyamatban« állapotú.”
- Teendő: „Lásd H01 (`invoices_issue`) és Z05.”

**Z03 · Mód-eltérés** — PIROS · 15 perc · 1
- Mit néz: `mode_mismatch`.
- Mi nem jó: „{n} díjszámla mód-eltérés miatt nem készült el (pl. éles fizetéshez teszt-számlázó).”
- Teendő: „INVOICE_MODE és SZAMLAZZHU_ACCOUNT a .env-ben (config.ts:315-337).”

**Z04 · Fizetés számla nélkül** — PIROS · 15 perc · 1
- Mit néz: sikeres fizetés, amely 2 óránál régebbi, és nincs hozzá díjszámla.
- Mi nem jó: „{n} sikeres fizetéshez 2 óra után sincs díjszámla.”
- Hatás: „A befolyt díjról számlát kell kiállítani. A kód saját szabálya is ez (config.ts:337). Jogszabályi háttér: Áfa tv. (2007. évi CXXVII. törvény). A kiállítás határidejét [DÁVID] erősítse meg.”
- Teendő: „Admin → Díjszámlák.”

**Z05 · Számlázz.hu elérhető** — SÁRGA · 5 perc · 2
- Mit néz: `https://www.szamlazz.hu/szamla/` → 200.
- Mi nem jó: „A Számlázz.hu nem érhető el ({kod}).”
- Hatás: „Késnek a díjszámlák; a rendszer újrapróbálja őket.”

**Z06 · Számla Agent kulcs él** — PIROS · naponta 07:00 · 1 · csak `INVOICE_MODE=szamlazzhu` esetén
- Mit néz: csak olvasó lekérdezés (`action-szamla_agent_xml`) a legutóbbi kiállított számla külső kulcsára (szamlazzhu.ts:177, 275-276) [ellenőrizendő: hibakódok, mert hivatalos hibakód-táblát nem találtunk].
- Mi nem jó: „A Számlázz.hu elutasította az Agent-kulcsunkat ({hibakod}).”
- Hatás: „Nem készülnek díjszámlák.”
- Ok: „Lejárt csomag; új kulcs a Számlázz.hu fiókban.”
- Teendő: „szamlazz.hu → Beállítások → Számla Agent kulcsok; új kulcs: kezjegy_kulcsok.ps1.”

### 2.12 T – Fájlok, PDF, tanúsítványok

**T01 · Fájltár írható és visszafejthető** — PIROS · 15 perc · 2
- Mit néz: a `/data/files/_figyelo/proba` próbafájlba ír, fsync-el, visszaolvassa és visszafejti. Ugyanazzal a titkosítással dolgozik, mint a FileStorage (files/storage.ts:45, 161). A fájlt felülírja, nem törli.
- Mi nem jó: „A fájltár nem írható vagy nem olvasható vissza ({hiba}).”
- Hatás: „Nem lehet feltölteni, és a meglévő iratok sem nyílnak meg.”
- Ok: „EACCES: rossz tulajdonos vagy jog (KEZJEGY_UID); ENOSPC: betelt a lemez; hibás FILE_ENC_KEY.”
- Teendő: „ls -ld /srv/kezjegy/data/files; df -h /.”

**T02 · Tárolt iratok épsége** — PIROS · naponta 05:00 · 1
- Mit néz: 3 véletlen meglévő fájlt beolvas és visszafejt, és az sha256-ot összeveti a `files` sorral (sha256, keyId: db/schema.ts:527-540).
- Mi nem jó: „Egy tárolt irat nem fejthető vissza, vagy sérült (fájl: {fileId}, hiba: {hiba}).”
- Hatás: „Az ügyfél nem tudja megnyitni az iratát. Ha ez a kulcs miatt van, több irat is érintett lehet.”
- Teendő: „Ne módosíts semmit a kulcsokon. Másold be egy Claude-munkamenetbe; a visszaállítás a mentésből megy (README).”

**T03 · PDF-készítés** — PIROS · óránként · 1
- Mit néz: a memóriában egy `markdownToPdf` próba „őű” betűkkel (lib/pdf.ts:107). Van `%PDF` fejléc, és a betűk betöltődnek (/app/fonts, lib/pdf.ts:15-19).
- Mi nem jó: „A PDF-készítés hibás: {hiba}.”
- Hatás: „Nem készül szerződés-PDF, felmondó PDF és jogi irat.”
- Teendő: „docker exec kezjegy-api ls /app/fonts; másold be egy Claude-munkamenetbe.”

**T04 · Hiányzó aláírt szerződés-PDF** — SÁRGA · naponta 07:15 · 1
- Mit néz: a „szerzodes” bekötési lépés kész, de nincs `szerzodes_alairt` irat. A hibát ma a kód elnyeli (routes/me.ts:240) [KÓD: ne nyelje el; írjon `mail.hibak`-szerű számlálót].
- Mi nem jó: „{n} ügyfél aláírt szerződés-PDF-je nem készült el.”
- Hatás: „Az ügyfél nem kapta meg a szerződése PDF-jét, és nálunk sincs meg.”
- Teendő: „Rendszer fül → T04 (nevek); panel → ügyfél → Iratok → »Szerződés-PDF újragenerálása« [KÓD].”

**T05 · TLS-tanúsítványok** — SÁRGA 21 napon belül, PIROS 7 napon belül · 6 óránként · 1
- Mit néz: minden nyilvános hostot (adozz.hu, www, app, konyvelo, api, a 3 sslip-név, jelzes); a lejárat napja és a kibocsátó.
- Mi nem jó: „A(z) {host} tanúsítványa {nap} nap múlva lejár ({datum}), a Caddy még nem újította meg.”
- Hatás: „A lejárat után a böngésző és az app nem csatlakozik.”
- Ok: „A Let's Encrypt 90 napos tanúsítványt ad, a Caddy jóval a lejárat előtt magától megújítja. Ha nem tette meg: DNS-hiba, elfogyott keret (sslip.io), elérhetetlen a 80-as port.”
- Teendő: „docker logs kezjegy-proxy 2>&1 | grep -i -E 'certificate|acme' | tail -20.”

**T06 · Domain lejárata (adozz.hu)** — SÁRGA 60 napon belül, PIROS 14 napon belül · naponta · 1
- Mit néz: a `FIGYELO_DOMAIN_LEJARAT` dátum, amit a tulaj ad meg. A .hu domainre megbízható automatikus lekérdezést nem ismerünk [ellenőrizendő].
- Mi nem jó: „Az adozz.hu domain {nap} nap múlva lejár ({datum}).”
- Teendő: „Hosszabbítsd meg a regisztrátornál, majd írd át a dátumot a figyelo_kulcsok.ps1-gyel.”

### 2.13 B – Belépés

**B01 · Google-belépés** — PIROS éles üzemben, ha nincs beállítva; SÁRGA, ha a JWKS nem érhető el · 6 óránként · 2
- Mit néz: `googleSignIn` (GOOGLE_CLIENT_IDS), és hogy a `https://www.googleapis.com/oauth2/v3/certs` elérhető (auth/oidc.ts:10-12, 47, 64-67).
- Mi nem jó: „A Google-belépés nincs beállítva”, vagy: „A Google kulcsszolgáltatása nem érhető el a szerverről ({kod}).”
- Hatás: „A Google-lel regisztrált ügyfelek nem tudnak belépni.”
- Teendő: „GOOGLE_CLIENT_IDS a .env-ben. Domainváltás után a Google Cloud »engedélyezett források« listáját is nézd meg.”

**B02 · Apple-belépés** — „nincs”, amíg nincs iOS-kiadás.

**B03 · Sikertelen belépési hullám** — SÁRGA · 5 perc · 1 · függ: K07
- Mit néz: 15 percen belül több mint 50 `auth.login_failed`, vagy óránként több mint 5 zárolás (audit_log).
- Mi nem jó: „Szokatlanul sok sikertelen belépés: {n} 15 perc alatt ({zarolas} zárolás).”
- Hatás: „Valószínű jelszópróbálgatás. A belépési korlát (auth.ts:304-305) véd, de a korlát csak a memóriában él.”
- Teendő: „Rendszer fül → B03 (időpontok, IP-hash); tartós támadásnál peremvédelem (HIANYLISTA 2.20).”

### 2.14 A – Beállítások, verzió, karbantartás

**A01 · Éles szerveren DEMO-beállítás** — PIROS · indításkor és naponta · 1 · DEMO-ban INFO-lista: „élesítéskor ezek váltanak”
- Mit néz, ha `appEnv=production`:
  - nem lehet `demo` vagy `disabled` állapotban a mail, push, nav, invoice és payment;
  - a `NAV_SOFTWARE_ID` ne az alapérték legyen (nav/client.ts:30);
  - legyen `NAV_LOOKUP_*`;
  - `staffTotpRequired` legyen bekapcsolva (config.ts:280 ezt már kikényszeríti).
- Mi nem jó: „Éles szerveren még DEMO vagy kikapcsolt: {lista}.”
- Hatás: „Az adott funkció nem működik élesben.”
- Teendő: „HIANYLISTA 1.16 és 1.18 élesítési lépései.”

**A02 · Verzió-egyezés** — SÁRGA · 5 perc · ha 15 percig fennáll
- Mit néz [KÓD]: az API `/health` `version` mezőjét, a worker verzióját (a szívverés értékébe kerül a `version`) és az ellenőrét.
- Mi nem jó: „Eltérő kódverzió fut: API {v1}, worker {v2}, ellenőr {v3}.”
- Ok: „Félbemaradt telepítés.”
- Teendő: „bash /srv/kezjegy/deploy/up.sh.”

**A03 · Bekapcsolva maradt karbantartás** — SÁRGA · 5 perc · 1
- Küszöb: 2 óránál tovább bekapcsolva.
- Mi nem jó: „A karbantartási mód {óra} órája be van kapcsolva ({ok}). Közben nem kapsz új riasztást.”
- Teendő: „Rendszer fül → Karbantartás kikapcsolása.”

**A04 · Figyelő-komponensek frissítése** — INFO; SÁRGA, ha biztonsági közlemény jelent meg · naponta · 1
- Mit néz: a futó Kuma, ntfy és Caddy verzióját összeveti a GitHub legfrissebb kiadásával és a biztonsági közleményekkel [ellenőrizendő: a GitHub API kéréskorlátja hitelesítés nélkül].
- Mi nem jó: „Biztonsági frissítés érhető el: {komponens} {verzio} ({kozlemeny}).”
- Teendő: „A digest cseréje a compose-ban, majd $FC pull && $FC up -d (karbantartásban).”

### 2.15 G – GDPR

**G01 · Adatexport-kérés vár** — SÁRGA · óránként · 1
- Küszöb: 24 óránál régebben vár.
- Mi nem jó: „{n} adatexport-kérés 24 órája vár.”
- Hatás: „Az ügyfél nem kapja meg a kért adatait.”
- Teendő: „Lásd H01 (`gdpr_export`); Admin → GDPR.”

**G02 · Esedékes fióktörlés elmaradt** — SÁRGA · naponta 05:00 · 1
- Küszöb: `deletionDueAt` több mint 1 napja lejárt, és a fiók még `pending_deletion` állapotú.
- Mi nem jó: „{n} esedékes fióktörlés nem futott le.”
- Teendő: „Lásd H03 (`gdpr`).”

### 2.16 U – Ügyfél-funkciók: elvégezte-e a rendszer a dolgát?

Ezek a legfontosabbak a „pontosan mi nem jó” kéréshez. Nem azt nézik, hogy a feladat lefutott-e, hanem hogy **az eredménye megvan-e**.

**U01 · Befizetési emlékeztetők kimentek** — PIROS · emlékeztető-napokon 09:15 · 1
- Mit néz [KÓD]: a `reminders` és a `reminders_k28` két részre válik:
  - `gyujt()`: tiszta függvény, a mai jelöltek listája a SPEC §28.K.4 táblázata szerint (átalány-negyedév 7/3/1 nappal előtte, az esedékesség napján és utána 1 nappal; HIPA-előleg; később a KATA);
  - `kuld()`: a kiküldés.
- Az ellenőrzés újra lefuttatja a `gyujt()`-et, és minden jelöltnél megnézi, létrejött-e az értesítés a `notifyOnce` kulcsával (`rem:<fajta>:<tétel>:<lépés>`).
- Mi nem jó: „{n} ügyfél nem kapta meg ma a(z) {fajta} emlékeztetőt (határidő: {datum}).”
- Hatás: „Az ügyfél nem tudja meg időben, hogy fizetnie kell. Az adófizetési határidőből késedelmi pótlék lehet.”
- Ok: „A feladat hibára futott vagy elmaradt (H03, H04); a felhasználó kikapcsolta az emlékeztetőt (ezt az ellenőrzés kiszűri, nem hiba); programhiba.”
- Teendő: „Rendszer fül → U01 (nevek) → »Pótlás most«.” [DÁVID D2: késve is pótoljuk-e, és ki szól az ügyfélnek]
- A határidőket az adómotor adja; forrásuk a NAV 100. és 03. információs füzete (9. pont).

**U02 · Havi indítás eredménye** — PIROS · hó 1. 07:30 · 1
- Mit néz: minden `aktiv` ügyfélnek van-e az adott hónapra dossziéja (`ensureDossier`), és ahol a könyvelőnél `monthlyStatementRequest` be van kapcsolva, ott van-e kivonatkérés (jobs.ts:171-190).
- Mi nem jó: „{n} aktív ügyfélnek nincs {honap}-i dossziéja, {m} ügyfélnél hiányzik a kivonatkérés.”
- Teendő: „»Pótlás most« (`monthly`).”

**U03 · Havi check-in megnyílt** — PIROS · a hónap első munkanapján 10:00 · 1
- Mit néz: minden jogosult ügyfélnek (SPEC §28.K: aktív, nincs zárolva, legalább 20 napja aktív) megnyílt-e a check-inje. Munkanap: az ado-motor `calendar.ts` szerint.
- Mi nem jó: „{n} jogosult ügyfélnél nem nyílt meg a havi check-in.”

**U04 · Éves zárás megnyílt** — PIROS · jan. 5. 10:00 (utána naponta jan. 31-ig) · 1
- Mi nem jó: „{n} aktív ügyfélnél nem nyílt meg az éves zárás.”
- Hatás: „Az éves kérdőív és a határidő-emlékeztetők nem indulnak el.”

**U05 · Határidő-tételek megvannak** — SÁRGA · naponta 06:45 · 1
- Mit néz [KÓD: a pontos lekérdezés a tax.ts `ensurePeriods` logikájából]: az aktív átalányadós ügyfeleknél a következő 30 nap minden törvényi határidejéhez (`deadlinesFor(év)`) létezik-e befizetési tétel.
- Mi nem jó: „{n} ügyfélnél hiányzik a(z) {datum}-i {fajta} befizetési tétel.”
- Hatás: „Tétel nélkül emlékeztető sem megy.”

**U06 · Havi KATA-befizetések követése** — „nincs”, amíg meg nem épül (HIANYLISTA 1.8: nincs KATA-tétel és KATA-számlaszám) · megépülése után:
- hó 1. 07:30: minden katás ügyfélnek megvan-e az előző havi KATA-tétel;
- a SPEC §28.K.4 szerinti emlékeztető-napokon (8-án és 12-én, illetve a következő munkanapon) az U01-es mintával nézi, kimentek-e az emlékeztetők;
- a 12. után: hány ügyfél nem jelölte befizetettnek. Ez üzleti jelzés a jelentésbe és Dávid felületére.
- Jogszabályi háttér: Katv. (2022. évi XIII. törvény). Az esedékesség napját és az összeget az adómotorba a fejlesztés veszi fel, [DÁVID] megerősíti.

**U07 · Éves SZJA-ciklus** — „nincs”, amíg meg nem épül; ide tartozik a bevallás, a különbözet-fizetés vagy visszajáró és az önellenőrzés · megépülése után:
- minden `ANNUAL_RULES` szerinti emlékeztető-lépés kiment-e (U01-es minta);
- üzleti jelzés a jelentésbe: „a bevallási határidő előtt {x} nappal {n} ügyfél zárása nincs kész” [DÁVID D6: küszöbök].

**U08 · NAV-folyószámla egyeztetése** — „nincs”, amíg meg nem épül · megépülése után:
- létrejött-e ügyfelenként a havi vagy negyedéves egyeztetési teendő;
- a lejártak üzleti jelzésként mennek a jelentésbe.
- [DÁVID] Hogyan végzi ma: ONYA vagy eBEV letöltés? Ettől függ, mit tud a rendszer automatikusan nézni.

**U09 · Visszahívás-határidő** — INFO, a jelentésben · 5 perc. Lejárt visszahívás-kérések (`jobCallbackSla`).

**U10 · Ügyfélre váró tételek** — INFO, a jelentésben · naponta. 7 napja váró kérések, check-inek, kérdőívek darabszáma.

### 2.17 X – Szintetikus próba (az 1.4 lépései)

**X00 · A próba lefutott** — SÁRGA · 5 perc · 1 · **szülő:** X01–X12
- Küszöb: 75 percen belül nem jött eredmény.
- Mi nem jó: „A szintetikus próba {perc} perce nem futott le.”
- Ok: „Cron; kép hiányzik; elfogyott a memória (S06).”
- Teendő: „tail -30 /srv/kezjegy/figyelo/szintetikus/futas.log; kézzel: bash /srv/kezjegy/deploy/figyelo/szintetikus.sh.”

**X01–X12 · lépésenként** — PIROS: X02–X06, X09; SÁRGA: X01 (ha a K01 zöld), X07, X08, X10–X12 · óránként (a teljes kör naponta) · gyors körben 2, teljes körben 1
- Egységes szöveg, a lépés nevével: „A szintetikus próba elakadt ennél a lépésnél: {lepesNeve} ({utvonal}): {hiba} ({httpKod}, {ms} ms).”
- Hatás lépésenként:
  - X03: „az ügyfelek valószínűleg nem tudnak belépni”;
  - X04: „a főoldal hibás”;
  - X05: „a határidők nem látszanak”;
  - X06: „az iratok nem nyílnak meg”;
  - X09: „a feltöltés nem működik”;
  - és így tovább.
- Ok: amit a lépés első hibás API-válasza mutat.
- Teendő: „Nézd meg a képernyőképet: /srv/kezjegy/figyelo/szintetikus/hibak/{ido}/{kod}.png; ugyanez a Rendszer fülön. Ha a K és W csoport zöld: valószínűleg a felületi kód hibás, ezért másold be egy Claude-munkamenetbe.”

### 2.18 R – A riasztási lánc önellenőrzése

**R01 · Telefonos riasztás (ntfy)** — PIROS · minden küldésnél és 5 percenként (`/v1/health`) · 1 · **csatorna: e-mail**
- Mi nem jó: „A telefonos riasztás (ntfy) nem megy: {hiba}. Addig csak e-mailben jönnek riasztások.”
- Teendő: „Lásd K11 és S02-ntfy.”

**R02 · Riasztó e-mail** — SÁRGA · minden küldésnél · 1 · **csatorna: ntfy**
- Mi nem jó: „A riasztó e-mail nem ment ki: {smtpHiba}.”
- Teendő: „Lásd E02.”

**R03 · Uptime Kuma fut** — PIROS · 1 perc · 3 · **szülő:** K01–K11
- Küszöb: a K13-jel 3 percnél régebbi, vagy a `/metrics` nem olvasható.
- Mi nem jó: „Az Uptime Kuma {perc} perce nem jelentkezett.”
- Hatás: „A nyilvános címek külső figyelése szünetel. A belső ellenőrzések ettől működnek.”
- Teendő: „$FC up -d kezjegy-kuma; docker logs --tail 100 kezjegy-kuma.”

**R04 · Külső életjel** — SÁRGA · 5 perc · 3
- Mit néz: sikerül-e a HC3-ping.
- Mi nem jó: „Nem megy ki a külső életjel (Healthchecks): {hiba}.”
- Hatás: „Rövidesen hamis »leállt a szerver« riasztás jöhet kívülről. Kimenő hálózati hiba gyanúja.”

**R05 · Reggeli jelentés elment** — SÁRGA · 08:00 · 1
- Mi nem jó: „A mai reggeli jelentés nem ment ki ({hiba}).”

**R06 · Egy ellenőrzés maga hibázik** — SÁRGA · 1
- Küszöb: ugyanannál az ellenőrzésnél 3 egymás utáni kivétel.
- Mi nem jó: „A(z) {kod} ellenőrzés nem tud lefutni ({hiba}), az állapota ismeretlen.”
- Teendő: „Másold be egy Claude-munkamenetbe.”

### 2.19 ST – Statisztika (Umami, a telepítése után)

**ST01 · Umami** — SÁRGA · 5 perc · 2
- Mit néz:
  - a konténer fut (S02-umami);
  - a belső `GET http://kezjegy-umami:3000/api/heartbeat` válaszol (ezt az Umami hivatalos compose-fájlja is használja);
  - az API-belépés működik (services/umami.ts);
  - a restic `umami` címke rendben van.
- Mi nem jó: „A látogatottsági statisztika (Umami) nem érhető el: {hiba}.”
- Hatás: „A Marketing fül »nem érhető el«-t mutat. Az appot nem érinti.”
- Teendő: „$DC up -d kezjegy-umami; docker logs --tail 100 kezjegy-umami.”

### 2.20 Függőségi fa (a szülő hibája alatt a gyerek nem riaszt)

```
S01 host-adat ─► S02–S10, M01–M07
S02-db / D01 ─► minden DB-t olvasó ellenőrzés (H, N02–N07, E03–E05, P03–P04, F03–F09, Z01–Z04, T04, D02–D05, G, U, A02, W01)
S02-worker / H01 ─► H02–H04, E03, P04
K07 API ─► W01–W02, X02–X12, B03
K09 sslip DNS ─► K04, K06, K08
N01 NAV ─► N02, N08
E02 SMTP ─► E03–E05, R02
S02-ntfy / K11 ─► R01
R03 Kuma ─► K01–K11 (Kuma-állapot ismeretlen)
X00 ─► X01–X12;  X03 belépés ─► X04–X10
S08 óra ─► N04
```

---

## 3. A konzol „Rendszer” fülének bővítése (`panel/src/pages/admin/Rendszer.tsx`)

**Új API-végpontok** (`routes/admin-felugyelet.ts`) [KÓD]
- Csak admin szerepnek, és ahol be van kapcsolva, kétlépcsős belépéssel.
- Minden módosító művelet auditnaplóba kerül (`felugyelet.*`).

| Végpont | Mit ad vagy csinál |
|---|---|
| `GET /api/v1/admin/felugyelet` | `{osszkep:{allapot, hibak, figyelmeztetesek, utolsoKor, verzio, karbantartasEddig}, csoportok:[{kod, nev, ellenorzesek:[{kod, nev, allapot, rovid, ota, utolsoFutas, kovetkezoFutas, sulyossag, nemitvaEddig, nemitasOka, hatas, teendo, reszletek}]}], feladatok:[{nev, magyarNev, utemezes, slot, ok, error, ms, at, running, kesik, elmaradt}]}`. A `reszletek` itt ügyfélnevet is tartalmazhat linkkel, mert az admin amúgy is látja őket. |
| `GET …/felugyelet/:kod/elozmenyek?nap=30` | a 30 napos napi csík és az állapotváltások listája (idő, régi → új, üzenet, csatornák, elnyomás oka) |
| `POST …/felugyelet/:kod/most` | „Most ellenőrizd” → `{keresId}`; `GET …/felugyelet/keres/:id` → eredmény |
| `POST …/felugyelet/:kod/nemitas` | `{orak: 1 | 4 | 24 | 'javulasig', ok}`; `POST …/nemitas-vege` |
| `POST …/felugyelet/karbantartas` | `{perc (legfeljebb 240), ok}` vagy `{ki: true}` |
| `POST …/felugyelet/teszt-riasztas` | próbaüzenet mindkét csatornára: „[TESZT] A riasztás működik” |
| `POST …/felugyelet/jelentes-most` | a reggeli jelentés azonnal (ntfy + e-mail) |
| `POST …/feladat/:nev/ujrafuttatas` | felszabadítja a feladat slotját (H03, H04); megerősítő ablak; csak idempotens feladatra |

**Képernyő**
- Felülről lefelé; telefonon egy oszlop, nagy gombokkal, mert a tulaj az ntfy-értesítésből nyitja meg.
- 30 mp-enként frissül. A `#H01` hash kibontja és kiemeli a tételt.

1. **Összkép-sáv**
   - Nagy pötty és szöveg: „Minden rendben” / „2 hiba, 1 figyelmeztetés”.
   - „Utolsó kör: 12 mp-e”, ellenőr-verzió.
   - Gombok: „Teszt riasztás”, „Reggeli jelentés most”, „Karbantartás…” (időtartam és ok).
   - Bekapcsolt karbantartásnál narancs sáv: „Karbantartás 14:20-ig: telepítés – új riasztás nem megy ki.”
2. **„Most nem jó” lista** (csak ha van ilyen)
   - Kártyánként: cím, Mi nem jó, Mióta, Hatás, Teendő.
   - Gombok: „Most ellenőrizd”, „Némítás”, „Előzmények”, hibás feladatnál „Újrafuttatás” vagy „Pótlás most”.
3. **Csoportok** harmonikában: Kívülről, Szerver, Mentés, Háttérfeladatok, Adatbázis, API, NAV, E-mail, Push, Fizetés, Számlázás, Fájlok és PDF, Belépés, Beállítások, GDPR, Ügyfél-funkciók, Szintetikus próba, Riasztási lánc, Statisztika.
   - Ha a csoport minden tétele zöld, alapból csukva van.
   - A fejlécben színenkénti darabszám áll.
   - Soronként:
     - pötty: zöld = rendben, sárga = figyelmeztetés, piros = hiba, szürke = ismeretlen (mellette: „függ: D01” vagy „az ellenőrzés hibázik”), kék = némítva, halvány = nem vonatkozik, okkal;
     - név, rövid állapot, „utolsó futás: 2 perce”, „következő: 13 mp múlva”;
     - „Most” gomb, és egy „…” menü: Előzmények, Némítás, Mit tegyek?
4. **Háttérfeladatok táblázat** (az adatlapból)
   - Oszlopok: magyar név, ütemezés, utolsó slot, eredmény (rendben / hiba + hibaszöveg), futásidő, következő esedékesség, „késik” vagy „elmaradt” címke, gombok.
   - Ma a `/admin/system` adja a `jobs` mezőt, de a panel nem mutatja, és a típusából is hiányzik (panel/src/api/types.ts:584-595).
5. **Előzmények fiók**
   - 30 napos csík: napi színes négyzetek, a hiba percei szerint.
   - Alatta a váltások listája: idő, régi → új állapot, a teljes üzenet, „ntfy: elment / e-mail: elment”, elnyomás oka.
   - Alatta a némítások: ki, mikor, miért.
6. **A meglévő blokkok maradnak**, a megfelelő csoportba sorolva:
   - Fizetés és számlázás (FizetesBlokk);
   - Kapcsolatok (módok);
   - a ma nem mutatott mezők: `filesFreeDiskPct`, `backupDisk`, `feeInvoiceErrors`, `paymentAlerts`.
7. **Javítások a mai oldalon**
   - A mentés piros küszöbe 26 óra helyett 2 óra (Rendszer.tsx:188), mert óránként van mentés.
   - A háttérfolyamat pirosa a H01 szabálya szerint (Rendszer.tsx:183).
   - A restic-állapot is megjelenik.
8. **Konzol Áttekintés** (a tulaj vezérlőpultja): kis jelvény, például „Rendszer: 2 hiba”, linkkel a fülre.

**Panel-tesztek** [KÓD]: színek és állapotok; a hash-navigáció; a gombok tiltása futás közben; a „nincs” magyarázata; a telefonos szélesség (375 px, nincs vízszintes görgetés).

---

## 4. Biztonság

**Uptime Kuma**
- Nyilvános útvonal nincs. Csak a `127.0.0.1:3001` loopback-kötés van, a tulaj SSH-alagúton éri el. A szerveren nincs Tailscale; ezt 11-21-én olvasva ellenőriztük.
- Erős admin jelszó, amit a tulaj állít be, és 2FA (TOTP).
- Egy API-kulcs, csak a metrikákhoz.
- **Nincs `docker.sock`.** A hivatalos wiki szerint a socket átadása root-szintű hozzáférés. A konténerállapotot a host-szkript adja.
- Digestre rögzített kép. A 2026 október–novemberi biztonsági közlemények miatt (hitelesített RCE, Host-fejléc-injekció, badge-DoS) frissítés kell, az A04 jelzi.

**ntfy**
- A telefon miatt nyilvános a `jelzes.adozz.hu` címen, a kezjegy-proxy mögött. A konténernek nincs saját portja.
- Beállítás (`server.yml`; [ellenőrizendő: kulcsnevek a 2.38.1 doksi szerint]):
  - `base-url`, `behind-proxy: true`, `listen-http: ":2586"`;
  - `auth-file`, `auth-default-access: deny-all`;
  - `enable-signup: false`, `web-root: disable`, csatolmány nélkül;
  - `upstream-base-url: "https://ntfy.sh"` csak iOS esetén. Ilyenkor az ntfy.sh csak az üzenet-azonosítót és a téma-URL SHA256-ját kapja, a szöveget nem.
- Felhasználók, csak a szükséges jogokkal:
  - `tulaj`: olvas a `riasztas` és a `jelentes` témából;
  - `ellenor`: ír ugyanoda;
  - `kuma`: ír a `riasztas` témába.
  - A token most az egész fiókra szól, ezért kell külön írási felhasználó.
- Caddy-blokk: HSTS, `X-Robots-Tag: noindex`, `request_body max_size 16KB`.
- Az üzenetekben nincs személyes adat (szövegszűrő, 1.5).

**Rendszerellenőr**
- Nincs proxy-útvonala, csak a Docker-hálókon érhető el, három külön tokennel. Az összehasonlítás állandó idejű.
- `read_only`, `cap_drop: ALL`, `no-new-privileges`, memóriakeret.
- Saját, legkisebb jogú DB-szerep (`kezjegy_figyelo`, 1.2).
- A naplóba nem kerül titok (`safeErr`). A kimenő szövegek a szövegszűrőn mennek át.

**Panel**
- A végpontok csak adminnak szólnak, kétlépcsős belépéssel.
- A „Most” gomb korlátja: ellenőrzésenként 10 mp-enként egy.
- A némítás, a karbantartás, az újrafuttatás és a teszt auditnaplóba kerül.

**Titkok**
- **A szerver generálja őket** a `deploy/figyelo/gen-figyelo-env.sh`-val [KÓD]. Mintája a `gen-env.sh`: 600-as jog, meglévő értéket nem ír felül, változtatás előtt másolatot tesz a `_regi/` mappába, és semmit nem ír ki.
  - `.env.figyelo`:
    - `DATABASE_URL` (kezjegy_figyelo);
    - `FIGYELO_TOKEN_ALLAPOT`, `FIGYELO_TOKEN_KUMA`, `FIGYELO_TOKEN_SZINT` (32 bájt, hex);
    - `NTFY_URL`, `NTFY_TOKEN_ELLENOR`, `NTFY_TOPIC_RIASZTAS`, `NTFY_TOPIC_JELENTES`;
    - `NTFY_KULSO_TEMA` (`adozz-kulso-<32 hex>`);
    - `FIGYELO_CSENDES=22:00-07:00`.
  - `.env.db`: `KEZJEGY_FIGYELO_DB_PASSWORD`.
  - `.env.szintetikus`: `FIGYELO_SZINT_EMAIL`, `FIGYELO_SZINT_JELSZO`, a próba tokenje. Csak a próba konténere kapja meg.
  - Az ntfy-felhasználók jelszavai és tokenjei: `deploy/figyelo/ntfy-felhasznalok.sh` (`ntfy user add`, `ntfy access`, `ntfy token add`) [ellenőrizendő: parancsok a 2.38.1-ben]. A tokenek kiírás nélkül kerülnek a `.env.figyelo`-ba.
- **Amit a tulaj ad meg**, a saját gépén, rejtett bevitellel: `figyelo_kulcsok.ps1` [KÓD], a `kezjegy_kulcsok.ps1` mintájára, ssh stdin-en át, chatbe soha.
  - `FIGYELO_EMAIL_TO`;
  - a Healthchecks ping-URL-ek (`HC_PING_HOST`, `HC_PING_ELLENOR`, `HC_PING_JELENTES`; a HC2 URL-je a Kumába kerül);
  - `KUMA_METRICS_KEY`;
  - `FIGYELO_DOMAIN_LEJARAT`.
- **Amit a tulajnak látnia kell:**
  - a telefonos ntfy-jelszó;
  - a Kumába beírandó `kuma` token és ZeptoMail SMTP-adat;
  - a külső ntfy-téma.
  - Ezeket a `D:/Atvitel/adozz_telefon_ntfy.cmd` [KÓD] csak a tulaj saját konzolablakában mutatja meg (`ssh appok-1 'cat …'`). Nem kerül naplóba, chatbe vagy fájlba.
- **Mentés:** a restic `config` címkéje kiegészül ezekkel [KÓD, restic-mentes.sh:110-117]:
  - `.env.figyelo`, `.env.szintetikus`;
  - `/srv/kezjegy/figyelo/`: a compose, a `server.yml`, a `kuma-data` és az `ntfy-data`.
  - A Kuma SQLite-ja futás közben készült, összeomlás-konzisztens másolat; a visszaállítást az M06 próbája is nézze [ellenőrizendő].

**Külső szolgáltatások**
- Személyes adat nem megy hozzájuk: csak ping, illetve a nyilvános URL-ek.
- Az ntfy.sh külső témájára csak az ellenőrzés neve kerül.

---

## 5. Telepítés, erőforrás, tesztek, elfogadás

### 5.1 Lépések (először a mostani DEMO szerveren, élesítéskor újra az elfogadási próbák)

**F0. A tulaj előkészít** (6. pont): döntések, DNS `A` rekord a `jelzes.adozz.hu`-ra [TULAJ: név] a 45.94.65.74 címre, riasztási e-mail-cím, Lark-alias, Healthchecks- és UptimeRobot-fiók.

**F1. Kód (helyben)** [KÓD]
1. Migráció: `felugyelet_*` táblák, `accountants.is_test`.
2. `backend/src/figyelo/*`, az ellenőrzések, a szövegkatalógus, az állapotgép, a küldő, a jelentés, a feladat-adatlapok.
3. API:
   - `routes/admin-felugyelet.ts`;
   - `api.forgalom` middleware;
   - `mail.hibak` és `push.hibak` számlálók;
   - Mailer `verify()`;
   - a worker szívverése külön időzítőn, verzióval;
   - az adatlépések eredménye;
   - a me.ts:240 hibaelnyelés megszüntetése;
   - a jobs.ts:234 `.catch(() => 0)` helyett számláló.
4. A tesztfiók őrei (`services/szintetikus.ts`) és a `szintetikus-seed`.
5. Panel: a Rendszer fül, az `api/felugyelet.ts`, a típusok.
6. `deploy/figyelo/`: `host-allapot.sh`, `karbantartas.sh`, `gen-figyelo-env.sh`, `ntfy-felhasznalok.sh`, `docker-compose.yml`, `ntfy/server.yml`, `figyelo-telepit.sh`, `restic-check.sh`, `szintetikus.sh`, `szintetikus/` (Dockerfile, package.json, proba.mjs), `szintetikus-fiok.sh`, `KUMA_MONITOROK.md`.
   - `up.sh`: karbantartás az elején és a végén, valamint a `kezjegy/szintetikus` kép építése.
   - `restic-mentes.sh`: új config-útvonalak.
   - `db-roles.sh`: a `kezjegy_figyelo` szerep.
   - `restore-proba.sh`: állapotfájl.
   - adozz.caddy: a `jelzes` blokk.
7. A tulaj gépére: `figyelo_kulcsok.ps1`, `adozz_figyelo.cmd`, `adozz_telefon_ntfy.cmd`.
8. SPEC §32, valamint a §13 (környezeti változók), §15, §18 és §20 kiegészítése.
9. `npm test` zöld a backendben és a panelben (5.3).

**F2. Szerver** (deploy felhasználó; minden lépés után olvasó ellenőrzés)
1. `feltolt.sh` (kód és deploy).
2. `bash /srv/kezjegy/deploy/figyelo/gen-figyelo-env.sh`. Ellenőrzés: `ls -l /srv/kezjegy/.env.figyelo` → `-rw-------`.
3. `bash /srv/kezjegy/deploy/up.sh`. Lépései: migráció, db-roles (kezjegy_figyelo), majd elindul a `kezjegy-ellenor`.
   - Ellenőrzés: `docker ps` szerint healthy; a panel Rendszer fülén megjelennek a csoportok (az S és M csoport szürke a host-szkriptig).
4. `bash /srv/kezjegy/deploy/figyelo/figyelo-telepit.sh`. Lépései:
   - másol a `/srv/kezjegy/figyelo/` mappába;
   - `docker compose pull` a digestekkel;
   - elindítja a Kumát és az ntfy-t;
   - létrehozza az ntfy-felhasználókat.
5. Proxy: az új `jelzes` blokk, majd `atallas.sh frissit` (validálás, újratöltés).
   - Ellenőrzés: `curl -s https://jelzes.adozz.hu/v1/health` → `{"healthy":true}`;
   - tanúsítvány a T05-ben.
6. A deploy felhasználó crontabja (meglévő sorok változatlanok):
   ```
   */2 * * * * /bin/bash /srv/kezjegy/deploy/figyelo/host-allapot.sh >> /srv/kezjegy/figyelo/host/futas.log 2>&1
   17  * * * * /bin/bash /srv/kezjegy/deploy/figyelo/szintetikus.sh >> /srv/kezjegy/figyelo/szintetikus/futas.log 2>&1
   40  4 * * 0 /bin/bash /srv/kezjegy/deploy/figyelo/restic-check.sh >> /srv/kezjegy/backups/restic_check.log 2>&1   # [TULAJ]
   10  5 1-7 * * [ "$(date +\%u)" = 7 ] && /bin/bash /srv/kezjegy/deploy/restore-proba.sh >> /srv/kezjegy/backups/restore_proba.log 2>&1   # [TULAJ]
   ```
7. `bash /srv/kezjegy/deploy/figyelo/szintetikus-fiok.sh` (egyszer), utána az 1.4 ellenőrző SQL-je.

**F3. Kuma** (a tulaj és az ügynök)
1. A tulaj futtatja az `adozz_figyelo.cmd`-t, majd a `http://localhost:3001` címen: SQLite, admin felhasználó és jelszó (jelszókezelőből), 2FA, API-kulcs.
2. Az API-kulcsot és a Healthchecks URL-eket a `figyelo_kulcsok.ps1`-gyel adja meg.
3. A K01–K14 monitorokat a `KUMA_MONITOROK.md` szerint a tulaj veszi fel, vagy az ügynök a tulaj belépett munkamenetében.
4. A K12 értesítését a tulaj állítja be: a `kuma` tokent és az SMTP-adatot az `adozz_telefon_ntfy.cmd` kimenetéből másolja.

**F4. Telefon** (a tulaj, 6. pont).

**F5. Külső figyelő** (a tulaj): Healthchecks HC1–HC4 + integrációk; UptimeRobot U1–U3.

**F6. Elfogadási próbák** (5.4) a DEMO szerveren, csendes időben. A hibapróbák szkriptje: `deploy/figyelo/hibaproba.sh`. Csak konténert állít le és indít el, és mindig visszaállít.

**F7. Élesítéskor** (`APP_ENV=production`)
- A „nincs” állapotú éles ellenőrzések (A01, E01, P01, F01, N08, Z06) bekapcsolnak.
- Az 5.4 1–6. és 10. pontját újra le kell futtatni.

### 5.2 Erőforrás (becslés; telepítés után mérni kell)

A szerver 11-21-én (olvasva): 6 vCPU; 11,7 GiB RAM, ebből kb. 1,4 GiB foglalt; 174 GB szabad lemez; 5 konténer, együtt kb. 250 MiB.

| Elem | RAM | CPU | Lemez | Megjegyzés |
|---|---|---|---|---|
| kezjegy-ellenor | 120–180 MB (keret: 256m) | átlag < 2% | – | Node, ugyanaz a kép |
| kezjegy-kuma | 150–300 MB (keret: 512m) | < 2% | kép kb. 185 MB (slim); adat < 100 MB/év | 14 monitor |
| kezjegy-ntfy | 30–60 MB (keret: 128m) | ~0 | kép kb. 36 MB | |
| Szintetikus próba | csúcsban legfeljebb 1,5 GB, futásonként 1–2 percig | 1 mag a futás alatt | kép kb. 2 GB | óránként |
| host-allapot.sh | – | kb. 1–2 mp 2 percenként | napló < 50 MB/év | |
| DB-táblák | – | – | < 20 MB/év | nem törlünk |
| Külső | – | – | – | 0 Ft/hó (Healthchecks Hobbyist 0 $, UptimeRobot Free) |
| ZeptoMail | – | – | – | napi 1 jelentés + a riasztások, havonta kb. 50–100 levél |

### 5.3 Tesztek [KÓD]

**Unit (vitest, backend)**
- `allapotgep`:
  - minden sor az 1.5 táblázatából;
  - megerősítés, javulás, súlyosbodás, enyhülés;
  - ingadozás, némítás, karbantartás, csendes órák, függőség, vihar;
  - újraindulás utáni visszatöltés (nincs ismételt riasztás).
- `feladatok`:
  - minden `jobDefs()` névnek van adatlapja (a teszt `ADS_TRACKING_ENABLED=true`-val is fut);
  - késés- és elmaradás-számítás hamis órával: hó 1., első munkanap ünnepnappal (ado-motor holidays), jan. 1., jan. 5–31., nyári és téli óraátállítás napja (05:30), éjfél környéke.
- `katalogus`: minden tételnek van kódja, neve, súlya, gyakorisága, Mi / Hatás / Ok / Teendő része. A szöveg magyar, a helyőrzők csak engedélyezett mezők, és nincs olyan helyőrző, amely nevet vagy e-mailt kérne.
- `szovegszuro`: e-mail, adószám, adóazonosító, IBAN, token és lekérdezőszöveg kitakarása.
- `kuldo`:
  - ntfy-fejlécek, prioritás, `Click`;
  - újrapróba, majd e-mail-tartalék;
  - óránkénti levélkeret;
  - a DEMO `MAIL_MODE` mellett is valódi SMTP-transport, de csak a `FIGYELO_EMAIL_TO` címre.
- `kuma`: Prometheus-szöveg feldolgozása; ékezetes és idézőjeles monitornevek; 0, 1, 2 és 3 állapot.
- NAV-hibák csoportosítása a `NAV_ERROR_MAP` alapján.
- Tesztfiók-őrök:
  - `notify()` → csak appon belül;
  - a `mailer` nem küld;
  - a `billing`, `predebit`, `invoices_issue` kihagyja;
  - a fizetési végpont 403;
  - a staff digest kiszűri.
  - Integrációs teszt: minden feladat lefut egy csak tesztügyfelet tartalmazó adatbázison, és a hamis külső kliensek 0 hívást rögzítenek.
- API-végpontok: csak admin; a token nélküli `/allapot` 401; a „most” kérés körbejár.

**Panel (vitest):** 3. pont.

**Hibapróba-szkript** (`hibaproba.sh`, csak a DEMO szerveren, és csak a tulaj jóváhagyásával): worker, API, Kuma és ntfy leállítása és visszaindítása; a host-cron 15 perces szüneteltetése; egy ellenőrzés kényszerített hibája (`FIGYELO_SZIMULACIO=<kód>`, csak `APP_ENV=demo` mellett).

### 5.4 Elfogadási feltételek (mind mérhető)

1. A 2. pont minden tétele megjelenik a Rendszer fülön, állapottal, az indulás után 3 percen belül. A DEMO-ban a „nincs” tételek okkal együtt látszanak.
2. **A worker leállítása:**
   - 4 percen belül pontosan egy `[PIROS]` ntfy-üzenet, és 5 percen belül egy e-mail jön;
   - a H02–H04 és az E03 nem riaszt külön;
   - visszaindítás után 3 percen belül jön a `[JAVULT]`.
3. **Az API leállítása:** egy PIROS (K07); a W és X csoport „függ: K07” szürke; nincs vihar.
4. **Az ellenőr leállítása:** 4 percen belül a Kuma K12 közvetlen ntfy- és e-mail-üzenete.
5. **A Kuma leállítása:** az R03 PIROS az ellenőrtől, és 7 percen belül a Healthchecks HC2 is jelez (e-mail + ntfy.sh).
6. **A host-cron 15 perces szüneteltetése:** az S01 SÁRGA, és a HC1 kívülről jelez.
7. **Reggeli jelentés:** 7 egymás utáni napon 07:30 ± 2 perckor mindkét csatornán megérkezik; a HC4 zöld.
8. **Személyes adat:** 1 hét üzenetei között (a `felugyelet_esemenyek.uzenet` mezőben) a szövegszűrő mintáira 0 találat van.
9. **Szintetikus próba:** 48 óra alatt legalább 46 sikeres futás, mindegyik 120 mp alatt. Az 1.4 szennyezés-SQL-je minden pontban 0-t ad.
10. **Telepítés `up.sh`-val:** egyetlen riasztás sem jön; a karbantartás magától ki- és bekapcsol.
11. **„Most ellenőrizd”:** 15 mp-en belül van eredmény.
12. **Ingadozás:** egy szimulált ingadozó ellenőrzés óránként legfeljebb 1 hiba- és 1 „ingadozik” üzenetet ad.
13. **Némítás:** a némítás alatt nincs riasztás; a némítás auditnaplóban van; lejárta után, ha még hibás, azonnal riaszt.
14. **Erőforrás:** egy hét után az 5.2 kereteit egyik konténer sem lépi túl, és az S06 nem jelzett a próba miatt.
15. **Kuma:** kívülről nem érhető el (`curl -m 5 http://45.94.65.74:3001` nem kapcsolódik). A belépéshez 2FA kell.

---

## 6. A tulaj teendői

**Döntések** (építés előtt, kb. 10 perc)
1. Az ntfy aldomain neve (javaslat: `jelzes.adozz.hu`), majd a DNS `A` rekord a 45.94.65.74 címre a domainkezelőnél.
2. A riasztási e-mail-cím(ek). Javaslat: a saját postafiók, és mellé a Lark-adminban a `figyelo@adozz.hu` alias, amely a tesztfiók címe is.
3. Külső figyelő: az A) (Healthchecks + UptimeRobot, 0 Ft), vagy más (1.6).
4. A külső riasztás csatornája: ntfy.sh-téma (alapból) vagy Telegram.
5. Csendes órák: 22:00–07:00 megfelel-e a SÁRGA jelzésekre? A PIROS mindig csörög.
6. Kérjen-e 12 óránként emlékeztetőt a nyitott PIROS hibáról? (Alapból nem.)
7. Mehet-e a heti `restic check` (Storage Box-forgalom) és a havi automatikus visszaállítási próba?
8. A napi szintetikus feltöltés évente kb. 365 db 1 KB-os fájl („nem törlünk”). Megfelel-e?
9. A panelre belépő szintetikus könyvelő (TOTP-titokkal a próbában) a 2. fázisban kell-e?
10. Az adozz.hu domain lejárati dátuma (a regisztrátortól), a T06-hoz.

**Ellenőrizni**
11. A Feladatütemező „Adozz mentes kulso” feladata tényleg ki van-e kapcsolva. A backup.sh megjegyzése szerint 11-20-án kikapcsolva, de a `_munka/mentes_kulso.log` 11-20 23:20-kor még futást mutat. Ha még fut, kapcsold ki, mert a restic már közvetlenül ment.

**Fiókok** (a fiókot a tulaj hozza létre, a jelszót ő adja meg)
12. Healthchecks.io: ingyenes fiók, 4 ellenőrzés (HC1–HC4). Integrációk: e-mail és ntfy (a téma az `adozz_telefon_ntfy.cmd` kimenetéből). Az URL-eket a `figyelo_kulcsok.ps1` kéri be.
13. UptimeRobot: ingyenes fiók, 3 monitor (U1–U3), e-mail riasztás, a telefonos appjuk opcionális.
14. ZeptoMail: külön SMTP-jelszó a figyelőnek (Mail Agent → SMTP), hogy a Kuma ne az app jelszavát tárolja.

**Uptime Kuma** (kb. 30–40 perc)
15. Az `adozz_figyelo.cmd` elindítása, majd a `http://localhost:3001` címen:
    - admin felhasználó és erős jelszó a jelszókezelőből;
    - Beállítások → Biztonság → 2FA be;
    - Beállítások → API-kulcsok → új kulcs; ezt a `figyelo_kulcsok.ps1` kéri be.
16. A monitorok felvétele a `KUMA_MONITOROK.md` szerint, vagy belépés után az ügynök veszi fel.
17. A K12 értesítései: ntfy (a `kuma` token) és SMTP (a 14. pont adatai).

**Telefon** (kb. 5 perc)
18. Az **ntfy** app telepítése: Androidon Google Play vagy F-Droid, iPhone-on App Store. Az ntfy.sh-n nem kell fiókot nyitni.
19. Az `adozz_telefon_ntfy.cmd` futtatása a gépen. A saját ablakában mutatja a szervercímet, a `tulaj` felhasználó jelszavát és a külső témát.
20. Az appban:
    - Beállítások → Felhasználók → új: szerver `https://jelzes.adozz.hu`, felhasználó `tulaj`, jelszó;
    - „+” → feliratkozás a `riasztas`, majd a `jelentes` témára a saját szerveren;
    - feliratkozás a külső témára az ntfy.sh-n.
21. Android:
    - a `riasztas` téma értesítési csatornáján a sürgős (5-ös) prioritásnál a „Ne zavarjanak felülbírálása” be;
    - az ntfy-nál az akkumulátor-optimalizálás ki, hogy azonnal jöjjön az értesítés;
    - saját szervernél az app állandó értesítést mutat, ez a normális működés.
22. Próba: Rendszer fül → „Teszt riasztás”. A telefonon és az e-mailben is megjön a „[TESZT] A riasztás működik”.

---

## 7. Nyitott kérdések

**[TULAJ]:** a 6. pont 1–10. döntései. Ezen felül:
- Kell-e nyilvános állapotoldal (HIANYLISTA 3.11)? Ha igen, az UptimeRobot ingyenes állapotoldala; a Kumát ehhez sem tesszük ki.
- Kapjon-e az app karbantartási sávot az ügyfeleknek a PIROS K07 vagy D01 alatt? Ez külön feladat.

**[DÁVID]**
- **D1:** Ha egy ügyfél NAV-letöltése több napig hibás, hány nappal az átalányadó-előleg vagy a KATA-határidő előtt kell kézzel beavatkozni? Ettől függ az N02 és N07 pirosra váltása.
- **D2:** Ha a worker leállása miatt kimaradt egy befizetési emlékeztető (U01), pótoljuk-e késve automatikusan, és ki szól az ügyfélnek?
- **D3:** Hibás NAV-kapcsolatnál ma csak a könyvelő és az admin kap levelet. Kapjon-e az ügyfél is jelzést?
- **D4:** Látszódjon-e a szintetikus tesztügyfél a könyvelői panelen (rejtve, kapcsolóval)?
- **D5:** Kér-e ő is riasztást, és milyen csatornán? Például ha az emlékeztetők nem mentek ki, vagy egy ügyfél NAV-letöltése 3 napja hibás.
- **D6:** A KATA havi követésénél és az éves SZJA-ciklusnál melyik nap után számít lemaradásnak a befizetés-jelölés vagy a zárás hiánya (üzleti jelzés neki és a tulajnak)? Hogyan egyezteti a NAV-folyószámlát (ONYA vagy eBEV)?
- **D7:** A díjszámla kiállításának határideje a fizetés után (Z04 küszöb, Áfa tv.).

---

## 8. Kódjavítások, amiket ez a terv magával hoz (a felmérés találatai)

1. **Hamis riasztás a szívverésnél:** a worker szívverése külön időzítőre kerül, és megkapja a verziót (worker.ts:105-120, jobs.ts:425-428).
2. **Hibás panel-küszöbök:** a panel 26 órás mentés-küszöbe 2 óra lesz; a szívverés-szabály a H01 szerint (Rendszer.tsx:183, 188).
3. **Rejtett `jobs` mező:** a `/admin/system` `jobs` mezőjét a panel megjeleníti, és felveszi a típusba (panel/src/api/types.ts:584-595).
4. **Elnyelt szerződés-PDF hiba** (routes/me.ts:240): a hiba számlálóba kerül, és lesz újragenerálás (T04).
5. **Push:** a nyugták összes hibakódja és a küldési kivételek számlálóba kerülnek; megszűnik az elnyelés (notify.ts:409, 414-416, 466; jobs.ts:234).
6. **Csak naplóba írt levélhibák:** a közvetlen sablonlevelek hibái számlálóba kerülnek (notify.ts:351-357, contracts.ts:89-91).
7. **Csak naplóba írt adatlépés-hibák:** a worker induló adatlépéseinek eredménye a `system_state`-be kerül (worker.ts:49-101).
8. **Elnyelt NAV-hibák:**
   - a `nav_sync` `result.failed` mezőjét és a hibakódokat az N02–N05 olvassa (navsync.ts:223-243);
   - az adószám-kereső hibája tárolódik (adoszam-kereso.ts:72-76), nem csak warn-naplósor.
9. **Valótlan szöveg:** a „Szóltunk a fejlesztőknek” (nav-kliens/src/errors.ts:40, 59, 96, 98) az N03-mal igazzá válik.
10. **Elavult megjegyzés:** a notify/mailer.ts:1 és a deploy/env.example:44 még Brevót említ; a szolgáltató a ZeptoMail.

---

## 9. Források

**Uptime Kuma**
- https://github.com/louislam/uptime-kuma (README, MIT)
- https://github.com/louislam/uptime-kuma/releases (2.5.12, 2026-11-17)
- https://github.com/louislam/uptime-kuma/wiki/Docker-Tags
- https://github.com/louislam/uptime-kuma/wiki/How-to-Monitor-Docker-Containers (a socket root-szintű hozzáférés)
- https://github.com/louislam/uptime-kuma/security/advisories
- Forráskód (monitortípusok, push-API, metrikák): https://github.com/louislam/uptime-kuma/tree/2.5.12/server

**ntfy**
- https://github.com/binwiederhier/ntfy
- https://docs.ntfy.sh/install/
- https://docs.ntfy.sh/config/ (access-control, behind-proxy, ios-instant-notifications, Caddy-példa)
- https://docs.ntfy.sh/subscribe/phone/
- https://docs.ntfy.sh/publish/

**Külső figyelők**
- Healthchecks: https://healthchecks.io/pricing/ , https://healthchecks.io/docs/ , https://healthchecks.io/docs/http_api/
- UptimeRobot: https://uptimerobot.com/pricing/ , https://uptimerobot.com/terms/
- Better Stack: https://betterstack.com/pricing
- Hetzner Cloud: https://www.hetzner.com/cloud/regular-performance

**Eszközök és szolgáltatások**
- Playwright Docker: https://playwright.dev/docs/docker
- Umami saját látogatás kizárása: https://docs.umami.is/docs/exclude-my-own-visits ; heartbeat: https://github.com/umami-software/umami/blob/master/docker-compose.yml
- Docker HEALTHCHECK: https://docs.docker.com/reference/dockerfile/#healthcheck [ellenőrizendő: unhealthy állapotra nincs automatikus újraindítás]
- Caddy automatikus HTTPS: https://caddyserver.com/docs/automatic-https
- Stripe webhookok (újrapróbálás, aláírás-tűrés): https://docs.stripe.com/webhooks
- Expo push-nyugták és hibakódok: https://docs.expo.dev/push-notifications/sending-notifications/
- restic check, `--read-data-subset`: https://restic.readthedocs.io/en/stable/045_working_with_repos.html
- Hetzner Storage Box SSH-parancsok (`df`): https://docs.hetzner.com/storage/storage-box/access/access-ssh-rsync-borg
- Számlázz.hu Számla Agent: https://docs.szamlazz.hu/agent/ (hivatalos hibakód-tábla nem található [ellenőrizendő])
- ZeptoMail SMTP: SPEC.md:4754; https://www.zoho.com/zeptomail/help/smtp-home.html [ellenőrizendő]

**NAV Online Számla**
- interfész v3: https://github.com/nav-gov-hu/Online-Invoice
- éles cím: https://api.onlineszamla.nav.gov.hu/ ; teszt: https://api-test.onlineszamla.nav.gov.hu/
- fejlesztői napló: https://onlineszamla.nav.gov.hu/fejlesztoi_naplo
- A ±1 napos időtűrés a kód megjegyzése (nav-kliens/src/errors.ts:9) [ellenőrizendő a specifikációban].

**Adóhatáridők** (az adómotor forrásai; ez a terv csak azt figyeli, hogy a rendszer ezek szerint lépett-e)
- NAV 100. információs füzet – Az egyéni vállalkozók átalányadózásának alapvető szabályai (2026): https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/100.-Az-egyeni-vallalkozok-atalanyadozasanak-alapveto-szabalyai-2026.-02.-20
- NAV 03. információs füzet – Az egyéni vállalkozók szja- és járulékkötelezettsége (2026): https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/03.-Az-egyeni-vallalkozok-szja--es-jarulekkotelezettsege-2026.-08.-31.
- NAV befizetési számlák: https://nav.gov.hu/ugyfeliranytu/szamlaszamok/Ki_hogyan_fizethet_a_NAV-nak

**Jogszabályok**
- Szja tv. (1995. évi CXVII. törvény): https://njt.hu/jogszabaly/1995-117-00-00
- Katv. (2022. évi XIII. törvény, a kisadózó vállalkozások tételes adója; az U06 háttere, a pontos §-t [DÁVID] erősítse meg): https://njt.hu/jogszabaly/2022-13-00-00
- Áfa tv. (2007. évi CXXVII. törvény, számlakibocsátás; a Z04 háttere, a határidőt [DÁVID] erősítse meg): https://njt.hu/jogszabaly/2007-127-00-00

**Kódhelyek** (olvasva, 11-21)
- backend: `jobs.ts`, `jobs-k28.ts`, `jobs-k29.ts`, `jobs-k29f.ts`, `jobs-tulaj1119.ts`, `worker.ts`, `routes/admin.ts:877-931`, `routes/public.ts:28-38`, `routes/auth.ts:302-376`, `services/navsync.ts`, `services/accounts.ts:74,127`, `notify/notify.ts`, `notify/mailer.ts`, `config.ts`
- nav-kliens: `src/errors.ts`
- panel: `src/pages/admin/Rendszer.tsx`
- deploy: `docker-compose.yml`, `proxy/`, `backup.sh`, `restic-mentes.sh`, `db-roles.sh`, `gen-env.sh`, `up.sh`, `restore-proba.sh`

**A szerver állapota** (11-21, csak olvasó parancsok)
- 5 konténer fut; nyitott port: 22, 80, 443 (ufw); nincs Tailscale.
- Crontab: `backup.sh` :05, `restic-mentes.sh` :35.
- A .env-ben megvannak az SMTP-adatok; a `MAIL_MODE` be van állítva (DEMO); a `NAV_LOOKUP_USER` üres.
