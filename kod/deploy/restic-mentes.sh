#!/usr/bin/env bash
# KÜLSŐ MENTÉS restic-kel, KÖZVETLENÜL a szerverről a Hetzner Storage Boxra (a tulaj döntése 2026-11-20 éjjel:
# „csak új dolgokat tegye fel a Hetzner szerverre, direktbe, ne a gépemen keresztül”). Cron (deploy felhasználó):
#   35 * * * * /bin/bash /srv/kezjegy/deploy/restic-mentes.sh >> /srv/kezjegy/backups/restic.log 2>&1
# Tároló:  sftp:storagebox:kezjegy/restic  (~/.ssh/config „storagebox” → u696276.your-storagebox.de:23,
#          kulcs ~/.ssh/id_ed25519_storagebox). Titkosított (AES-256), tömörített, deduplikált: csak a változás megy ki.
# Jelszó:  /srv/kezjegy/.restic_pass (600) – másolata a tulaj gépén: konyvelo_app/_privat/restic_jelszo.txt (2. sor).
#          Ezzel az EGY jelszóval minden visszaállítható (a .env kulcsai és a .backup_pass is benne vannak).
# Óránként ezek a pillanatképek készülnek (címke → tartalom):
#   db     – pg_dump -Fp (sima SQL) a kezjegy-db-ből, stdinen → /kezjegy.sql
#   umami  – ha fut a kezjegy-umami-db, annak a pg_dump-ja → /umami.sql
#   files  – /srv/kezjegy/data/files (a feltöltött fájlok; a blobok már AES-256-GCM-mel titkosak)
#   config – .env, .env.db, nyilvanos.env, .backup_pass, deploy/, proxy/ (a helyreállításhoz kell); ha megvannak (SPEC §31):
#            .env.umami, .env.umami-db, .umami_beallitas (a statisztika-szerver titkai) és hirdetes/ (a Google-kulcs mappája)
#   app    – src/ és web/ (a futó kód és a webes felületek, médiával) – így a tulaj gépe nélkül is újraépíthető
# (files/config/app: --skip-if-unchanged – ha semmi nem változott, nem készül új pillanatkép.)
# Félkész állapot nincs: ha a pg_dump hibával áll le, a restic NEM ír pillanatképet (--stdin-from-command); ha a
# feltöltés megszakad, szintén nem. NINCS forget/prune (házirend: semmit nem törlünk; a tulaj nem kért ritkítást).
# Napló: backups/restic.log (időpont, pillanatkép-azonosítók, hozzáadott méret; titok nélkül).
# Állapot: backups/restic_allapot.json (utolsó sikeres mentés ideje, címkénként is; utolsó hiba).
# A visszaállítás lépései (új szerveren is): README.md, „Külső mentés: restic a Storage Boxon”.
set -uo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=${HOME:-/home/deploy}
export RESTIC_REPOSITORY=${RESTIC_REPOSITORY:-sftp:storagebox:kezjegy/restic}
export RESTIC_PASSWORD_FILE=${RESTIC_PASSWORD_FILE:-/srv/kezjegy/.restic_pass}
R=/srv/kezjegy
B=$R/backups
LOG=$B/restic.log
ALLAPOT=$B/restic_allapot.json
mkdir -p "$B"
exec >>"$LOG" 2>&1

log() { printf '%s %s\n' "$(date -Is)" "$*"; }
meret() { numfmt --to=iec-i --suffix=B "${1:-0}" 2>/dev/null || printf '%s B' "${1:-0}"; }

# ne fusson egymásra két mentés (ha az előző még fut, ez a kör kimarad)
exec 9>"$B/.restic-mentes.lock"
if ! flock -n 9; then log "KIHAGYVA: az előző restic-mentés még fut"; exit 0; fi

KEZD=$(date -Is)
log "INDUL: restic-mentés → $RESTIC_REPOSITORY"
HIBAK=()
SNAPS='{}'
SIKER=$(jq -c '.utolso_siker_cimkenkent // {}' "$ALLAPOT" 2>/dev/null || echo '{}')
[ -n "$SIKER" ] || SIKER='{}'

# mentes <címke> <restic backup további kapcsolói...>
mentes() {
  local tag=$1; shift
  local out="" rc=0 sum="" id="" adat="" hiba=""
  out=$(timeout -s INT -k 120 45m restic backup --json -q --host appok-1 --tag "$tag" "$@" 2>&1); rc=$?
  sum=$(printf '%s\n' "$out" | jq -c -R 'fromjson? | objects | select(.message_type == "summary")' 2>/dev/null | tail -n 1)
  id=$(printf '%s' "$sum" | jq -r '.snapshot_id // empty' 2>/dev/null | cut -c1-8)
  if [ -n "$sum" ]; then
    adat="$(meret "$(jq -r '.data_added' <<<"$sum")") új adat ($(meret "$(jq -r '.data_added_packed' <<<"$sum")") tömörítve),"
    adat="$adat $(jq -r '.total_files_processed' <<<"$sum") fájl / $(meret "$(jq -r '.total_bytes_processed' <<<"$sum")") átnézve,"
    adat="$adat $(jq -r '.total_duration | floor' <<<"$sum") s"
  fi
  if [ "$rc" -eq 0 ] && [ -n "$id" ]; then
    log "OK $tag: pillanatkép $id – $adat"
    SNAPS=$(jq -c --arg t "$tag" --arg i "$id" '. + {($t): $i}' <<<"$SNAPS")
    SIKER=$(jq -c --arg t "$tag" --arg d "$(date -Is)" '. + {($t): $d}' <<<"$SIKER")
  elif [ "$rc" -eq 0 ]; then
    log "OK $tag: nem változott, nem kellett új pillanatkép"
    SNAPS=$(jq -c --arg t "$tag" '. + {($t): "változatlan"}' <<<"$SNAPS")
    SIKER=$(jq -c --arg t "$tag" --arg d "$(date -Is)" '. + {($t): $d}' <<<"$SIKER")
  else
    # csak a hibaüzenetek (restic error/exit_error, illetve a nem-JSON sorok, pl. a pg_dump stderr-je)
    hiba=$(printf '%s\n' "$out" | jq -r -R '. as $l | (try fromjson catch null) as $j
        | if ($j | type) == "object" then
            (if ($j.message_type == "error" or $j.message_type == "exit_error") then ($j.error.message // $j.message) else empty end)
          elif $j == null then $l else empty end | select(length > 0)' 2>/dev/null | tail -n 5 | tr '\n' ' ' | cut -c1-600)
    if [ "$rc" -eq 3 ] && [ -n "$id" ]; then
      log "HIBA $tag: RÉSZLEGES pillanatkép $id (néhány fájl nem volt olvasható) – $adat – $hiba"
      SNAPS=$(jq -c --arg t "$tag" --arg i "$id" '. + {($t): ($i + " (részleges)")}' <<<"$SNAPS")
    else
      log "HIBA $tag: nem készült pillanatkép (kilépési kód $rc) – $hiba"
    fi
    HIBAK+=("$tag: kód $rc – $hiba")
  fi
}

if [ ! -r "$RESTIC_PASSWORD_FILE" ]; then
  log "HIBA: a tároló jelszófájlja nem olvasható ($RESTIC_PASSWORD_FILE)"
  HIBAK+=("jelszófájl nem olvasható")
else
  # 1) adatbázis – sima SQL, hogy jól deduplikálódjon; csak olvas (pg_dump)
  if docker ps --format '{{.Names}}' | grep -qx kezjegy-db; then
    mentes db --stdin-from-command --stdin-filename kezjegy.sql -- \
      docker exec kezjegy-db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fp'
  else
    log "HIBA db: a kezjegy-db konténer nem fut"; HIBAK+=("db: a kezjegy-db nem fut")
  fi
  # 2) Umami (látogatottság), ha már fut
  if docker ps --format '{{.Names}}' | grep -qx kezjegy-umami-db; then
    if docker exec kezjegy-umami-db sh -c 'command -v pg_dump >/dev/null 2>&1'; then
      mentes umami --stdin-from-command --stdin-filename umami.sql -- \
        docker exec kezjegy-umami-db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fp'
    else
      log "HIBA umami: a kezjegy-umami-db-ben nincs pg_dump"; HIBAK+=("umami: nincs pg_dump")
    fi
  fi
  # 3) feltöltött fájlok
  if [ -d "$R/data/files" ]; then
    mentes files --skip-if-unchanged "$R/data/files"
  else
    log "HIBA files: nincs $R/data/files"; HIBAK+=("files: a mappa hiányzik")
  fi
  # 4) konfiguráció és kulcsok (a restic-tároló titkosítja)
  CFG=()
  for p in "$R/.env" "$R/.env.db" "$R/nyilvanos.env" "$R/.backup_pass" "$R/deploy" "$R/proxy"; do
    if [ -e "$p" ]; then CFG+=("$p"); else log "figyelem config: hiányzik $p"; fi
  done
  # SPEC §31: the statistics server's secrets and the ad key folder – only when they exist (no warning: optional)
  for p in "$R/.env.umami" "$R/.env.umami-db" "$R/.umami_beallitas" "$R/hirdetes"; do
    if [ -e "$p" ]; then CFG+=("$p"); fi
  done
  mentes config --skip-if-unchanged "${CFG[@]}"
  # 5) a futó kód és a webes felületek
  APP=()
  for p in "$R/src" "$R/web"; do [ -e "$p" ] && APP+=("$p"); done
  [ ${#APP[@]} -gt 0 ] && mentes app --skip-if-unchanged "${APP[@]}"
fi

VEGE=$(date -Is)
if [ ${#HIBAK[@]} -eq 0 ]; then
  EREDMENY=ok; UTOLSO=$VEGE
else
  EREDMENY=hiba; UTOLSO=$(jq -r '.utolso_sikeres_mentes // empty' "$ALLAPOT" 2>/dev/null || true)
fi
HIBA_SZOVEG=$(printf '%s | ' "${HIBAK[@]}"); HIBA_SZOVEG=${HIBA_SZOVEG% | }
jq -n --arg vege "$VEGE" --arg kezd "$KEZD" --arg eredmeny "$EREDMENY" --arg utolso "$UTOLSO" \
      --arg hiba "$HIBA_SZOVEG" --argjson snap "$SNAPS" --argjson siker "$SIKER" --arg tar "$RESTIC_REPOSITORY" \
  '{utolso_futas: $vege, futas_kezdete: $kezd, eredmeny: $eredmeny,
    utolso_sikeres_mentes: (if $utolso == "" then null else $utolso end),
    hiba: (if $hiba == "" then null else $hiba end),
    pillanatkepek: $snap, utolso_siker_cimkenkent: $siker, tarolo: $tar}' > "$ALLAPOT.part" \
  && mv "$ALLAPOT.part" "$ALLAPOT"
if [ "$EREDMENY" = ok ]; then
  log "KÉSZ: minden rendben ($(jq -r 'to_entries | map("\(.key)=\(.value)") | join(", ")' <<<"$SNAPS"))"
  exit 0
fi
log "KÉSZ HIBÁVAL: ${#HIBAK[@]} hiba – lásd fent; utolsó teljesen sikeres mentés: ${UTOLSO:-még nincs}"
exit 1
