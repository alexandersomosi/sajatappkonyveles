#!/usr/bin/env bash
# >>> KIKAPCSOLVA 11-20, helyette restic (restic-mentes.sh a szerveren, közvetlenül a Storage Boxra; README.md
# >>> „Külső mentés: restic a Storage Boxon”). A Feladatütemező „Adozz mentes kulso” feladata Disabled (nem törölve);
# >>> a már kint lévő hetzner-tar:kezjegy/mentesek/ fájlok maradnak.
# [TULAJ – csak a jóváhagyásod után futtasd] Külső (off-site) másolat a Kézjegy mentéseiről a Hetzner Storage
# Boxra, a tulaj gépén keresztül (Git Bash). A szervernek így nem kell saját kulcs a Storage Boxhoz.
#   bash C:/Users/UpgradePC/konyvelo_app/kod/deploy/mentes-kulso.sh
# Mit csinál: az appok-1 /srv/kezjegy/backups (és backups/regi) mappájából minden olyan db_*.dump.gpg és
# files_*.tar fájlt, ami a Storage Boxon még nincs ott, átmásol a hetzner-tar:kezjegy/mentesek/ alá, és
# SHA-256-tal ellenőrzi. Semmit nem töröl (házirend). A mentések gpg-vel titkosítottak; a .backup_pass és a
# kulcsok (FILE_ENC_KEY, APP_DATA_KEY, NAV_CRED_KEY) NEM mennek vele – azokat külön, offline tartsd.
# Ütemezni a PC Feladatütemezőjével lehet (pl. naponta 04:00), ha a tulaj kéri.
set -euo pipefail
CEL=kezjegy/mentesek
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
ssh hetzner-tar "mkdir -p $CEL" >/dev/null 2>&1 || ssh hetzner-tar "mkdir $CEL" >/dev/null 2>&1 || true
van=$(ssh hetzner-tar "ls -1 $CEL" 2>/dev/null || true)
lista=$(ssh appok-1 'cd /srv/kezjegy/backups && ls -1 db_*.dump.gpg files_*.tar regi/db_*.dump.gpg regi/files_*.tar 2>/dev/null' || true)
n=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  nev=$(basename "$f")
  if printf '%s\n' "$van" | grep -qx "$nev"; then continue; fi
  scp -q "appok-1:/srv/kezjegy/backups/$f" "$TMP/$nev"
  helyi=$(sha256sum "$TMP/$nev" | cut -d' ' -f1)
  # -n: az ssh ne olvassa el a ciklus bemenetét (különben az első fájl után elfogy a lista)
  szerver=$(ssh -n appok-1 "sha256sum /srv/kezjegy/backups/$f" | cut -d' ' -f1)
  [ "$helyi" = "$szerver" ] || { echo "HIBA: $nev ellenőrzőösszege eltér, kihagyom"; continue; }
  scp -q "$TMP/$nev" "hetzner-tar:$CEL/$nev"
  # visszaolvasás ellenőrzéssel (a Storage Box nem ad sha256sum-ot: méret-összevetés + teljes letöltés)
  scp -q "hetzner-tar:$CEL/$nev" "$TMP/$nev.vissza"
  [ "$(sha256sum "$TMP/$nev.vissza" | cut -d' ' -f1)" = "$helyi" ] || { echo "HIBA: $nev a Storage Boxon nem egyezik"; continue; }
  rm -f "$TMP/$nev" "$TMP/$nev.vissza"
  echo "kint: $nev"
  n=$((n + 1))
done <<< "$lista"
echo "Kész: $n új mentés került a Storage Boxra ($CEL). Semmit nem töröltünk."
