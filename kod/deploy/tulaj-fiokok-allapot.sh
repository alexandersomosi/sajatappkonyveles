#!/usr/bin/env bash
# The owner's live accounts (alex@ / tulaj@demo.kezjegy.test) – snapshot and compare around a deploy (SPEC §26.9.3, S1).
#   bash /srv/kezjegy/deploy/tulaj-fiokok-allapot.sh ment <name>       → /srv/kezjegy/_regi/fiokok_<name>.txt (600)
#   bash /srv/kezjegy/deploy/tulaj-fiokok-allapot.sh hasonlit <a> <b>  → "VÁLTOZATLAN" or the changed lines
# The snapshot holds users, clients, onboarding_steps, consents, subscriptions, sessions-count rows of the two accounts.
# Secrets never leave the database: the password/TOTP hashes are only compared as md5(...) inside the file, and only
# the readable summary (e-mail, lifecycle, step:status) is printed. clients.business_status is listed separately,
# because the §26 data step may set it (only for clients that already have an adószám).
set -euo pipefail
umask 077
mode=${1:?ment|hasonlit}
EM="'alex@demo.kezjegy.test','tulaj@demo.kezjegy.test'"
q() { docker exec -i kezjegy-db psql -At -F '|' -U kezjegy -d kezjegy -v ON_ERROR_STOP=1 -c "$1"; }
if [ "$mode" = ment ]; then
  out=/srv/kezjegy/_regi/fiokok_${2:?name}.txt
  {
    echo "# users"
    q "select u.email, u.role, u.status, u.email_verified_at, u.created_at, md5(coalesce(u.password_hash,'')), md5(coalesce(u.totp_secret_enc,'')) from users u where u.email in ($EM) order by 1"
    echo "# clients"
    q "select u.email, c.id, c.lifecycle, c.accountant_id, (c.adoszam is not null), (c.adoazonosito_jel_enc is not null), (c.phone_enc is not null), c.created_at, c.updated_at from clients c join users u on u.id=c.user_id where u.email in ($EM) order by 1"
    echo "# onboarding_steps"
    q "select u.email, s.step, s.status, coalesce(s.note,''), s.completed_at, s.updated_at, md5(coalesce(s.data::text,'')) from onboarding_steps s join clients c on c.id=s.client_id join users u on u.id=c.user_id where u.email in ($EM) order by 1,2"
    echo "# consents"
    q "select u.email, count(*), max(x.created_at) from consents x join users u on u.id=x.user_id where u.email in ($EM) group by 1 order by 1"
    echo "# subscriptions"
    q "select u.email, s.status, s.updated_at from subscriptions s join clients c on c.id=s.client_id join users u on u.id=c.user_id where u.email in ($EM) order by 1"
    echo "# client_tax_profiles"
    q "select u.email, count(*) from client_tax_profiles t join clients c on c.id=t.client_id join users u on u.id=c.user_id where u.email in ($EM) group by 1 order by 1"
    echo "# messages"
    q "select u.email, count(*) from messages m join clients c on c.id=m.client_id join users u on u.id=c.user_id where u.email in ($EM) group by 1 order by 1"
  } > "$out"
  chmod 600 "$out"
  # readable summary, no hashes
  echo "== mentve: $out"
  q "select u.email, u.role, u.status, coalesce(c.lifecycle::text,'–') from users u left join clients c on c.user_id=u.id where u.email in ($EM) order by 1" | sed 's/^/fiók: /'
  q "select u.email, string_agg(s.step::text||':'||s.status::text, ' ' order by s.step) from onboarding_steps s join clients c on c.id=s.client_id join users u on u.id=c.user_id where u.email in ($EM) group by 1 order by 1" | sed 's/^/lépések: /'
  if q "select 1 from information_schema.columns where table_name='clients' and column_name='business_status'" | grep -q 1; then
    q "select u.email, coalesce(c.business_status,'(nincs válasz)') from clients c join users u on u.id=c.user_id where u.email in ($EM) order by 1" | sed 's/^/business_status: /'
  fi
elif [ "$mode" = hasonlit ]; then
  a=/srv/kezjegy/_regi/fiokok_${2:?a}.txt; b=/srv/kezjegy/_regi/fiokok_${3:?b}.txt
  if cmp -s "$a" "$b"; then echo "VÁLTOZATLAN: $2 = $3"; else echo "ELTÉR ($2 → $3), a változott sorok (hash nélkül):"; diff <(cut -d'|' -f1-5 "$a") <(cut -d'|' -f1-5 "$b") || true; fi
fi
