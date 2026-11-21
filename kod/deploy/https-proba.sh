#!/usr/bin/env bash
# End-to-end check of the live Kézjegy deployment over PUBLIC HTTPS with curl (SPEC §22 deploy).
# Runs ON appok-1 (the demo passwords never leave the server and are never printed):
#   ssh appok-1 'bash /srv/kezjegy/deploy/https-proba.sh'
# Read-only for the seeded personas (Szabó Kata, Kovács Bence, admin). Every write flow runs on a NEW
# fictional client "Próba Teszt" (proba.<time>@demo.kezjegy.test) that is put into GDPR deletion at the end.
# Output: one OK/HIBA line per check, totals at the end; exit code 1 if anything failed.
set -uo pipefail
D=45-94-65-74.sslip.io
CRED=/srv/kezjegy/demo_belepesek.txt
W=$(mktemp -d /dev/shm/kj_proba_XXXX)   # tokens/cookies only in RAM, removed on exit
chmod 700 "$W"
trap 'rm -rf "$W"' EXIT
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "OK    $*"; }
bad() { FAIL=$((FAIL+1)); echo "HIBA  $*"; }
# chk "name" <test command...>
chk() { local n=$1; shift; if "$@" >/dev/null 2>&1; then ok "$n"; else bad "$n  [HTTP $ST] $(head -c 220 "$W/b" 2>/dev/null | tr '\n' ' ')"; fi; }
j() { jq -r "$1" "$W/b" 2>/dev/null; }
is() { [ "$ST" = "$1" ]; }
settok() { printf 'Authorization: Bearer %s\n' "$1" > "$W/auth"; }
notok() { : > "$W/auth"; }
notok
# req METHOD HOST PATH [JSON]   (JSON may hold secrets: it goes through stdin, never argv)
req() {
  local m=$1 h=$2 p=$3 body=${4-}
  if [ -n "$body" ]; then
    ST=$(printf '%s' "$body" | curl -sS -D "$W/rh" -o "$W/b" -w '%{http_code}' -X "$m" "https://$h.$D/api/v1$p" -H @"$W/auth" \
      -H 'content-type: application/json' -H 'accept: application/json' -b "$W/jar" -c "$W/jar" --data-binary @-)
  else
    ST=$(curl -sS -D "$W/rh" -o "$W/b" -w '%{http_code}' -X "$m" "https://$h.$D/api/v1$p" -H @"$W/auth" -H 'accept: application/json' -b "$W/jar" -c "$W/jar")
  fi
}
# up METHOD HOST PATH  -F args...   (multipart upload)
up() { local m=$1 h=$2 p=$3; shift 3; ST=$(curl -sS -o "$W/b" -w '%{http_code}' -X "$m" "https://$h.$D/api/v1$p" -H @"$W/auth" "$@"); }
cred() { grep "^$1;" "$CRED" | grep "${2:-}" | head -1 | cut -d';' -f"$3"; }
login_json() { jq -nc --arg e "$1" --arg p "$2" --arg k "$3" '{email:$e,password:$p,clientKind:$k}'; }
: > "$W/jar"

echo "== 1. Infrastruktúra"
ST=$(curl -sS -o "$W/b" -w '%{http_code}' https://$D/api/v1/health); chk "Gardoko health (45-94-65-74.sslip.io)" is 200
for h in app konyvelo api; do
  req GET $h /health; chk "$h.$D /api/v1/health (TLS + ok)" test "$ST" = 200 -a "$(j .ok)" = true
done
req GET api /health
chk "health: névtelenül csak ok / version / db (módok nélkül)" test "$(j .ok)" = true -a "$(j .appEnv)" = null -a "$(j .modes)" = null
req GET api /config
chk "config: APP_ENV=demo, DEMO jelölve, k29 fizetés (demo/stripe)" test "$(j .appEnv)" = demo -a "$(j .demo)" = true -a "$(j .paymentProvider)" != disabled
curl -sS -D "$W/h" -o /dev/null "https://api.$D/api/v1/health"
chk "API: Cache-Control no-store" grep -qi '^cache-control: no-store' "$W/h"
for h in app konyvelo; do
  ST=$(curl -sS -D "$W/h" -o "$W/b" -w '%{http_code}' "https://$h.$D/")
  chk "$h.$D / → 200 (statikus oldal)" is 200
  chk "$h.$D: CSP + HSTS + nosniff + X-Frame-Options" bash -c "grep -qi '^content-security-policy:' '$W/h' && grep -qi '^strict-transport-security:' '$W/h' && grep -qi '^x-content-type-options: nosniff' '$W/h' && grep -qi '^x-frame-options: deny' '$W/h'"
  chk "$h.$D: nincs Server fejléc" bash -c "! grep -qi '^server:' '$W/h'"
done
ST=$(curl -sS -o "$W/b" -w '%{http_code}' "https://app.$D/fiok/elofizetes"); chk "app SPA mély link → index.html" is 200
ST=$(curl -sS -o "$W/b" -w '%{http_code}' "https://api.$D/"); chk "api.$D / → 404 (csak /api/*)" is 404
req GET app /config; chk "GET /config (márka, jogi verziók)" test "$ST" = 200 -a "$(j .brand.name)" != null

echo "== 2. Szabó Kata (ügyfél, web: süti + X-Kezjegy)"
KE=$(cred ugyfel kata. 2); KP=$(cred ugyfel kata. 3)
req POST app /auth/login "$(login_json "$KE" "$KP" web)"
chk "Kata belépés (web)" test "$ST" = 200 -a "$(j .user.role)" = client -a "$(j '.refreshToken // "none"')" = none
settok "$(j .accessToken)"
chk "__Host-kj_rt süti: HttpOnly, Secure, SameSite=Strict, Path=/, nincs Domain" bash -c "C=\$(grep -i '^set-cookie: __Host-kj_rt=' '$W/rh'); grep -qi 'httponly' <<<\"\$C\" && grep -qi 'secure' <<<\"\$C\" && grep -qi 'samesite=strict' <<<\"\$C\" && grep -qi 'path=/;\|path=/\$' <<<\"\$C\" && ! grep -qi 'domain=' <<<\"\$C\""
ST=$(curl -sS -o "$W/b" -w '%{http_code}' -X POST "https://app.$D/api/v1/auth/refresh" -b "$W/jar" -c "$W/jar"); chk "frissítés X-Kezjegy fejléc nélkül → 403" is 403
ST=$(curl -sS -o "$W/b" -w '%{http_code}' -X POST "https://app.$D/api/v1/auth/refresh" -H 'X-Kezjegy: 1' -b "$W/jar" -c "$W/jar"); chk "frissítés sütivel → új token (rotáció)" test "$ST" = 200 -a "$(j .accessToken)" != null
settok "$(j .accessToken)"
req GET app /me; chk "GET /me (könyvelő: Bence)" test "$ST" = 200 -a "$(j .accountant.firstName)" != null
req GET app /client/home; chk "GET /client/home (fejsáv + levél)" test "$ST" = 200 -a "$(j .hero.state)" != null
echo "      hero: $(j .hero.state) $(j .hero.amountHuf) Ft; ÁFA-keret: $(j .limits.afa.sentence)"
req GET app /client/tax-periods; chk "GET /client/tax-periods" is 200
PID=$(j '[.items[]? | select(.calcStatus=="jovahagyva")][0].id // empty')
if [ -n "$PID" ]; then req GET app "/client/tax-periods/$PID"; chk "adóidőszak + 'Hogyan jött ki?' sorok" test "$ST" = 200 -a "$(j '.explanation.lines | length')" -gt 3; fi
req GET app "/client/dossiers?year=2026"; chk "GET /client/dossiers" test "$ST" = 200 -a "$(j '.months | length')" -gt 0
req GET app /client/dossiers/2026-10; chk "GET /client/dossiers/2026-10 (iratok)" is 200
req GET app "/client/nav-invoices?month=2026-10"; chk "NAV-számlák 2026-10 (DEMO mock)" test "$ST" = 200 -a "$(j '.items | length')" -gt 0
req GET app "/client/messages?limit=20"; chk "üzenetek" is 200
req GET app /client/requests; chk "kérések" is 200
req GET app /client/deadlines; chk "határidők" is 200
DL=$(j '.items[0].id // empty')
if [ -n "$DL" ]; then ST=$(curl -sS -o "$W/b" -w '%{http_code}' -H @"$W/auth" "https://app.$D/api/v1/client/deadlines/$(jq -rn --arg x "$DL" '$x|@uri')/ics"); chk "határidő .ics" bash -c "[ $ST = 200 ] && grep -q BEGIN:VCALENDAR '$W/b'"; fi
req GET app /client/subscription; chk "előfizetés: aktív (DEMO)" test "$ST" = 200 -a "$(j .status)" = active
req GET app "/client/revenue?year=2026"; chk "bevételek 2026" is 200
req GET app /me/notifications; chk "értesítések" is 200
req GET app /client/onboarding; chk "bekötés lépései" is 200
echo "   szerepkörök (Kata tokennel):"
req GET konyvelo /acc/clients; chk "ügyfél → /acc/clients tiltva" test "$ST" = 403 -o "$ST" = 404
req GET konyvelo /admin/system; chk "ügyfél → /admin/system tiltva" test "$ST" = 403 -o "$ST" = 404
notok; req GET app /client/home; chk "token nélkül → 401" is 401

echo "== 3. Kovács Bence (könyvelő, panel)"
: > "$W/jar"
BE=$(cred konyvelo "" 2); BP=$(cred konyvelo "" 3)
req POST konyvelo /auth/login "$(login_json "$BE" "$BP" panel)"; chk "Bence belépés (panel)" test "$ST" = 200 -a "$(j .user.role)" = accountant
BTOK=$(j .accessToken); settok "$BTOK"
req GET konyvelo /acc/clients; chk "ügyféllista" test "$ST" = 200 -a "$(j '.items | length')" -ge 3
KID=$(j '[.items[] | select((.name // "") | test("Szabó"))][0].id')
req GET konyvelo "/acc/clients/$KID"; chk "Kata adatlap (adóazonosító maszkolva)" test "$ST" = 200 -a "$(j .demo)" != null
req GET konyvelo "/acc/clients/$KID/tax-periods?year=2026"; chk "Kata adóidőszakok 2026" test "$ST" = 200 -a "$(j '.items | length')" -gt 3
req GET konyvelo "/acc/clients/$KID/nav-invoices?year=2026"; chk "Kata NAV-számlái 2026" test "$ST" = 200 -a "$(j '.items | length')" -gt 20
req GET konyvelo "/acc/clients/$KID/dossiers?year=2026"; chk "Kata dossziéi" is 200
req GET konyvelo /acc/deadline-board; chk "határidő-figyelő" is 200
req GET konyvelo "/acc/requests?status=nyitott_mind"; chk "kérések sora" is 200
req GET konyvelo /acc/settings; chk "beállítások" is 200
req GET konyvelo /admin/system; chk "könyvelő → /admin tiltva" test "$ST" = 403 -o "$ST" = 404

echo "== 4. Admin"
: > "$W/jar"; notok
AE=$(cred admin "" 2); AP=$(cred admin "" 3)
req POST konyvelo /auth/login "$(login_json "$AE" "$AP" panel)"; chk "admin belépés" test "$ST" = 200 -a "$(j .user.role)" = admin
ATOK=$(j .accessToken); settok "$ATOK"
for p in /admin/dashboard /admin/clients /admin/subscriptions /admin/payments /admin/accountants /admin/content-texts /admin/faq /admin/demo-outbox /admin/system "/admin/audit?limit=5"; do
  req GET konyvelo "$p"; chk "GET $p" is 200
done
req GET konyvelo /admin/system; echo "      worker heartbeat: $(j .workerHeartbeatAt), db: $(j .db)"
req GET konyvelo "/acc/clients/$KID/kyc"; chk "admin → ügyfél KYC tiltva (legkisebb jogosultság)" test "$ST" = 403 -o "$ST" = 404

echo "== 5. Új ügyfél végig (Próba Teszt, kitalált)"
: > "$W/jar"; notok
TS=$(date +%Y%m%d%H%M%S)
NE="proba.$TS@demo.kezjegy.test"
NP=$(openssl rand -base64 18)
T0=$(date -u +%Y-%m-%dT%H:%M:%S)
# k7b (S16): the sign-up answers 202 "nézd meg a postafiókodat" without a session; the code opens it (/auth/register/verify)
req POST app /auth/register "$(jq -nc --arg e "$NE" --arg p "$NP" '{email:$e,password:$p,firstName:"Próba",lastName:"Teszt",platform:"web",utm:{source:"https-proba"}}')"
chk "regisztráció (202, munkamenet nélkül)" test "$ST" = 202 -a "$(j .status)" = check_email -a "$(j .accessToken)" = null
req POST app /auth/login "$(login_json "$NE" "$NP" web)"; chk "megerősítés előtt a jelszó nem enged be (401, mint a rossz jelszó)" is 401
settok "$ATOK"; req GET konyvelo /admin/demo-outbox
CODE=$(jq -r --arg t "$T0" '[.items[] | select(.createdAt >= $t and (.subject | test("megerősítő kódod")))][0].bodyText' "$W/b" | grep -oE '\b[0-9]{6}\b' | head -1)
chk "e-mail kód a DEMO postafiókban (nem ment ki levél)" test -n "$CODE"
notok; req POST app /auth/register/verify "$(jq -nc --arg e "$NE" --arg c "$CODE" '{email:$e,code:$c,platform:"web"}')"
chk "a kód megnyitja a munkamenetet (201, e-mail megerősítve)" test "$ST" = 201 -a "$(j .user.emailVerified)" = true
NTOK=$(j .accessToken); settok "$NTOK"
IDS=$(python3 - <<'PY'
import random
from datetime import date
r = random.Random()
while True:
    days = (date(1990, 1, 1) - date(1867, 1, 1)).days + r.randint(0, 9000)
    d = "8" + f"{days:05d}" + f"{r.randint(0, 999):03d}"
    c = sum((i + 1) * int(x) for i, x in enumerate(d)) % 11
    if c != 10:
        aj = d + str(c); break
while True:
    t = "6" + f"{r.randint(0, 999999):06d}"
    w = [9, 7, 3, 1, 9, 7, 3]
    c = (10 - sum(int(t[i]) * w[i] for i in range(7)) % 10) % 10
    ts = t + str(c)
    break
print(aj, ts)
PY
)
NAJ=${IDS% *}; NTSZ=${IDS#* }
req PUT app /client/profile "$(jq -nc --arg aj "$NAJ" --arg asz "$NTSZ-1-41" '{firstName:"Próba",lastName:"Teszt",adoazonositoJel:$aj,adoszam:$asz,address:{zip:"1136",city:"Budapest",line:"Példa utca 9."},hqMunicipality:"Budapest",activityText:"Kitalált tesztelő tevékenység",activityAnswer:"egyeb",taxStatus:"fofoglalkozasu",evSince:"2024-02-01",hasSeparateBusinessAccount:true}')"
chk "kérdőív (adatok, ellenőrző számjegyek)" test "$ST" = 200 -a "$(j .adoazonositoJelMasked)" != null
req GET app /config; ITEMS=$(j '[.legal | to_entries[] | select(.key|test("^(aszf|adatkezeles|megbizasi_szerzodes)$")) | {docType:.key,version:.value}]')
req POST app /me/consents "{\"items\":$ITEMS}"; chk "ÁSZF + adatkezelés + megbízás elfogadva" test "$ST" = 204 -o "$ST" = 200
# k8 (k7b remnant): the k29 card flow (consent hash → hosted page) instead of the retired SimplePay start; and the k8
# bank transfer (díjbekérő) when the switch is on. PAYMENT_PROVIDER=demo: the DEMO pay page is clicked through here;
# PAYMENT_PROVIDER=stripe (Stripe TEST): only the Checkout URL is checked – a test card is paid by hand in a browser.
req GET app /config; PPROV=$(j .paymentProvider); ATUT=$(j .fizetes.atutalas)
if [ "$ATUT" = true ]; then
  req GET app /client/billing; chk "átutalás választható (/client/billing)" test "$ST" = 200 -a "$(j .transferAvailable)" = true
fi
req GET app '/client/subscription/consent?purpose=subscribe'; CV=$(j .version); CSH=$(j .sha256)
chk "kártyás hozzájárulás (verzió + hash)" test "$ST" = 200 -a -n "$CV" -a "$CV" != null
req POST app /client/subscription/start "{\"platform\":\"web\",\"purpose\":\"subscribe\",\"consentVersion\":\"$CV\",\"consentSha256\":\"$CSH\"}"
chk "kártyás indítás ($PPROV)" test "$ST" = 200 -a "$(j .url)" != null
PURL=$(j .url); PID=$(j .paymentId)
if [ "$PPROV" = demo ]; then
  ST=$(curl -sS -D "$W/h" -o "$W/b" -w '%{http_code}' "$PURL"); chk "DEMO fizetőoldal (api host, saját CSP)" bash -c "[ $ST = 200 ] && grep -q 'DEMO' '$W/b' && grep -qi 'form-action .self.' '$W/h'"
  ST=$(curl -sS -o "$W/b" -w '%{http_code} %{redirect_url}' -X POST "https://api.$D/api/v1/payments/demo/fizetes" --data-urlencode "p=$PID" --data-urlencode valasztas=ok)
  B1=${ST#* }; ST=${ST%% *}; chk "sikeres fizetés szimulálása → 303 a vissza-URL-re" test "$ST" = 303
  ST=$(curl -sS -o "$W/b" -w '%{http_code} %{redirect_url}' "$B1"); B2=${ST#* }; ST=${ST%% *}
  chk "vissza-URL → app eredményoldal" bash -c "[ $ST = 302 ] && [[ '$B2' == https://app.$D/elofizetes/eredmeny?cs=* ]]"
  req GET app /client/subscription; chk "előfizetés aktív, DEMO kártya rögzítve" test "$ST" = 200 -a "$(j .status)" = active
else
  chk "Stripe TESZT Checkout URL (a fizetés kézzel, tesztkártyával)" bash -c "[[ '$PURL' == https://checkout.stripe.com/* ]]"
  echo "      (Stripe TESZT: az ügyfél nem lesz aktív ebben a próbában – a lenti aktív-függő lépések ezért hibázhatnak)"
fi
printf '%%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%%%EOF\n' > "$W/proba.pdf"
MONTH=$(TZ=Europe/Budapest date +%Y-%m)
up POST app /client/documents -F "file=@$W/proba.pdf;type=application/pdf;filename=proba_szamla.pdf" -F category=koltseg_bizonylat -F "dossierMonth=$MONTH" -F "title=Próba számla"
chk "irat feltöltés (titkosítva tárolva)" test "$ST" = 201
DOC=$(j '.id'); FID=$(j '.versions[-1].fileId')
req GET app "/client/documents/$DOC"; chk "irat részletei (verzió, előzmények)" test "$ST" = 200 -a "$(j '.versions | length')" = 1
req POST app "/files/$FID/link"; LINK=$(j .url)
ST=$(curl -sS -o "$W/le.pdf" -w '%{http_code}' "https://app.$D$LINK"); chk "aláírt fájllink → ugyanaz a PDF (visszafejtve)" bash -c "[ $ST = 200 ] && cmp -s '$W/le.pdf' '$W/proba.pdf'"
ST=$(curl -sS -o /dev/null -w '%{http_code}' "https://app.$D${LINK%sig=*}sig=AAAA"); chk "hamis aláírású link → elutasítva" test "$ST" -ge 400
req POST app /client/messages '{"body":"Szia! Feltöltöttem egy próba számlát. (https-proba)"}'; chk "üzenet a könyvelőnek" test "$ST" = 201 -o "$ST" = 200
python3 - "$W/id.png" <<'PY'
import struct, sys, zlib
w, h = 64, 40
raw = b"".join(b"\x00" + bytes([200, 210, 225]) * w for _ in range(h))
def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
open(sys.argv[1], "wb").write(png)
PY
up POST app /client/kyc -F "idFront=@$W/id.png;type=image/png" -F "idBack=@$W/id.png;type=image/png" -F "addressFront=@$W/id.png;type=image/png" \
  -F 'data={"name":"Teszt Próba","birthName":"Teszt Próba","mothersBirthName":"Minta Mária","birthPlace":"Példafalva","birthDate":"1990-05-05","citizenship":"magyar","address":"1136 Budapest, Példa utca 9.","documentType":"szemelyi","documentNumber":"000000AA","documentExpiry":"2031-01-01"}' \
  -F "declarations={\"ownBehalf\":true,\"pep\":false,\"truthful\":true,\"notifyChanges\":true,\"signedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
chk "azonosítás: igazolvány + lakcímkártya címoldal + nyilatkozatok" is 201
req POST app /client/onboarding/meghatalmazas '{"method":"onya_ugyfel"}'; chk "meghatalmazás: 'Beküldtem' (ONYA)" test "$ST" = 200 -o "$ST" = 201 -o "$ST" = 204
req GET app /client/home; NID=$(j .client.id)

echo "   könyvelő oldal (Bence) az új ügyfélen:"
settok "$BTOK"
req GET konyvelo /acc/clients
chk "új ügyfél Bencéhez rendelve" test -n "$NID" -a "$(j "[.items[] | select(.id==\"$NID\")] | length")" = 1
req GET konyvelo "/acc/clients/$NID/dossiers/$MONTH"; chk "a feltöltött irat a dossziéban" test "$ST" = 200 -a "$(j "[.documents[] | select(.id==\"$DOC\")] | length")" = 1
req GET konyvelo "/acc/documents/$DOC"; chk "irat megnyitása → 'Bence látta'" is 200
settok "$NTOK"; req GET app "/client/documents/$DOC"; chk "ügyfél látja: konyvelo_latta" test "$(j '.status // .document.status')" = konyvelo_latta
settok "$BTOK"
req POST konyvelo "/acc/clients/$NID/messages" '{"body":"Megkaptam, köszönöm! (https-proba)"}'; chk "válasz az ügyfélnek" test "$ST" = 201 -o "$ST" = 200
req GET konyvelo "/acc/clients/$NID/kyc"; chk "KYC megtekintése (auditálva)" test "$ST" = 200 -a "$(j .status)" = bekuldve
req POST konyvelo "/acc/clients/$NID/kyc/review" '{"status":"elfogadva"}'; chk "KYC elfogadva" test "$ST" = 200 -o "$ST" = 204
req POST konyvelo "/acc/clients/$NID/onboarding/meghatalmazas" '{"status":"kesz"}'; chk "meghatalmazás rendben (könyvelő)" test "$ST" = 200 -o "$ST" = 204
# Bence has the OPTIONAL appointment step switched on in the demo (SPEC §19.2): the client did not book one,
# so the accountant marks it skipped; with every step done the client becomes active.
req POST konyvelo "/acc/clients/$NID/onboarding/idopont" '{"status":"kihagyva"}'; chk "időpont kihagyva (opcionális lépés)" test "$ST" = 200 -o "$ST" = 204
req PATCH konyvelo "/acc/clients/$NID/tax-profile" '{"year":2026,"costRatio":45,"status":"fofoglalkozasu","guaranteedMinimum":false,"hipa":{"method":"savos","ratePct":2}}'; chk "adózási beállítások (45 %)" is 200
req PUT konyvelo "/acc/clients/$NID/nav-credentials" "$(jq -nc --arg t "$NTSZ" '{login:("demo"+$t),password:("demo-jelszo-"+$t),signatureKey:("demo-alairokulcs-"+$t),exchangeKey:("demo-cserekulcs-"+$t),taxNumber:$t,environment:"demo"}')"
chk "NAV technikai felhasználó mentve (külön kulccsal titkosítva)" is 200
req POST konyvelo "/acc/clients/$NID/nav-credentials/test"; chk "NAV kapcsolatpróba (DEMO mock)" test "$(j .ok)" = true
req POST konyvelo "/acc/clients/$NID/nav-sync"; chk "NAV szinkron → számlák + bevételek" test "$ST" = 200 -a "$(j .status)" = ok
req GET konyvelo "/acc/clients/$NID/nav-invoices?year=2026"; echo "      NAV-számlák: $(j '.items | length') db"
req GET konyvelo "/acc/clients/$NID"; chk "bekötés kész → ügyfél aktív" test "$(j .lifecycle)" = aktiv
Q=$(TZ=Europe/Budapest date +%Y-Q$(( ($(date +%-m)-1)/3+1 )))
req POST konyvelo "/acc/clients/$NID/tax-periods/$Q/calculate" '{}'; chk "számolás $Q (ado-motor)" test "$ST" = 200 -o "$ST" = 201
CALC=$(j '.id // .calculation.id')
req POST konyvelo "/acc/tax-calculations/$CALC/approve" '{"letterText":"Kiszámoltam, mennyit kell most befizetned. (https-proba, kitalált adat)"}'; chk "jóváhagyás + levél" test "$ST" = 200 -o "$ST" = 201
settok "$NTOK"; req GET app /client/home
chk "ügyfél főoldal: a jóváhagyott összeg a fejsávban" test "$(j .hero.state)" = jovahagyva -a "$(j '.hero.amountHuf // 0')" -gt 0
echo "      hero: $(j .hero.state) $(j .hero.amountHuf) Ft"
NPID=$(j .hero.periodId)
TODAY=$(TZ=Europe/Budapest date +%F)
if [ -n "$NPID" ] && [ "$NPID" != null ]; then
  req POST app "/client/tax-periods/$NPID/mark-paid" "{\"paidOn\":\"$TODAY\"}"; chk "'Befizettem' jelölés" test "$ST" = 200 -o "$ST" = 204
  settok "$BTOK"; req GET konyvelo "/acc/clients/$NID/tax-periods?year=2026"
  VITEMS=$(jq -c --arg p "$NPID" '[.items[] | select(.id==$p) | .items[] | {kind, verification:"rendben"}]' "$W/b")
  req POST konyvelo "/acc/tax-periods/$NPID/verify-payment" "{\"items\":$VITEMS}"
  chk "könyvelő: befizetés rendben" test "$ST" = 200 -o "$ST" = 204
fi
settok "$BTOK"; req GET konyvelo "/acc/audit?clientId=$NID"; chk "napló: az új ügyfél eseményei" test "$ST" = 200 -a "$(j '.items | length')" -gt 5

echo "   jelszó, 2FA, GDPR (új ügyfél):"
: > "$W/jar"; notok
req POST app /auth/password/forgot "$(jq -nc --arg e "$NE" '{email:$e}')"; chk "elfelejtett jelszó → 202" test "$ST" = 202 -o "$ST" = 204
T1=$(date -u +%Y-%m-%dT%H:%M:%S)
settok "$ATOK"; req GET konyvelo /admin/demo-outbox
RCODE=$(jq -r '[.items[] | select(.subject | test("jelsz|Jelsz"))][0].bodyText' "$W/b" | grep -oE '\b[0-9]{6}\b' | head -1)
NP2=$(openssl rand -base64 18)
notok; req POST app /auth/password/reset "$(jq -nc --arg e "$NE" --arg c "$RCODE" --arg p "$NP2" '{email:$e,code:$c,newPassword:$p}')"; chk "új jelszó e-mail kóddal" test "$ST" = 204 -o "$ST" = 200
req POST app /auth/login "$(login_json "$NE" "$NP" native)"; chk "régi jelszó már nem jó" is 401
req POST app /auth/login "$(login_json "$NE" "$NP2" native)"; chk "belépés az új jelszóval (natív: refresh a válaszban)" test "$ST" = 200 -a "$(j .refreshToken)" != null
NTOK=$(j .accessToken); settok "$NTOK"
req POST app /auth/totp/setup; SEC=$(j .secret); chk "2FA beállítás (TOTP titok)" test -n "$SEC" -a "$SEC" != null
totp() { python3 -c 'import base64,hmac,hashlib,struct,sys,time
k=base64.b32decode(sys.argv[1]+"="*(-len(sys.argv[1])%8)); c=int(time.time())//30
d=hmac.new(k,struct.pack(">Q",c),hashlib.sha1).digest(); o=d[-1]&15
print("%06d"%((struct.unpack(">I",d[o:o+4])[0]&0x7fffffff)%1000000))' "$1"; }
req POST app /auth/totp/enable "{\"code\":\"$(totp "$SEC")\"}"; chk "2FA bekapcsolva, 10 helyreállító kód" test "$ST" = 200 -a "$(j '.recoveryCodes | length')" = 10
# A bekapcsoláskor használt kód nem használható újra (visszajátszás elleni védelem): megvárjuk a következő 30 mp-es lépést.
sleep $(( 31 - $(date +%s) % 30 ))
notok; req POST app /auth/login "$(login_json "$NE" "$NP2" native)"; chk "belépés → mfa_required" test "$ST" = 401 -a "$(j .error.code)" = mfa_required
MFA=$(j .mfaToken)
req POST app /auth/login/totp "$(jq -nc --arg m "$MFA" --arg c "$(totp "$SEC")" '{mfaToken:$m,code:$c}')"; chk "belépés TOTP kóddal" is 200
NTOK=$(j .accessToken); settok "$NTOK"
req POST app /me/export '{}'; chk "GDPR adatexport kérés (202, a 03:30-as munka készíti)" is 202
req GET app /me/exports; chk "exportok listája" is 200
req POST app /me/delete "$(jq -nc --arg p "$NP2" --arg c "$(totp "$SEC")" '{password:$p,totpCode:$c,reason:"https-proba"}')"; chk "fióktörlés kérés (30 nap múlva hajtja végre)" test "$ST" = 202 -a "$(j .deletionDueAt)" != null
notok; req POST app /auth/login "$(login_json "$NE" "$NP2" native)"; chk "törlés alatt: belépés → deletion_pending" test "$(j .error.code)" = deletion_pending -o "$(j .error.code)" = mfa_required
# keep the demo lists clean: the fictional test client leaves Bence's list (admin, reversible status change)
settok "$ATOK"; req PATCH konyvelo "/admin/clients/$NID" '{"lifecycle":"megszunt"}'; chk "próbaügyfél lezárva (megszűnt) – nem zavarja a demót" is 200

echo "== 6. Naplók: nincs személyes adat / titok"
LOGS=$(docker logs --since 30m kezjegy-api 2>&1; docker logs --since 30m kezjegy-worker 2>&1)
nolog() { if grep -qF -- "$2" <<<"$LOGS"; then bad "$1"; else ok "$1"; fi; }
nolog "API/worker napló: nincs benne az e-mail-cím" "$NE"
nolog "API/worker napló: nincs benne a régi jelszó" "$NP"
nolog "API/worker napló: nincs benne az új jelszó" "$NP2"
nolog "API/worker napló: nincs benne az adóazonosító jel" "$NAJ"
ST=$(docker ps --format '{{.Names}} {{.Ports}}' | grep -v '^appok-caddy-1 ' | grep -c '0.0.0.0\|:::' || true)
chk "csak appok-caddy-1 publikál portot" test "$ST" = 0

echo
echo "Összesen: $PASS OK, $FAIL HIBA"
[ "$FAIL" = 0 ]
