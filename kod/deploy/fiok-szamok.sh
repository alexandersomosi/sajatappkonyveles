#!/usr/bin/env bash
# Integrator k6 (11-19): row COUNTS of the owner's accounts and the two demo logins the owner's accountant uses
# (alex@, tulaj@, bence.kovacs@ panel, david@ client "Fendrik Dávid") – before/after a deploy. Counts only: no names,
# no texts, no hashes, nothing personal. Also: how many stored texts still carry the old product name.
#   ssh appok-1 'bash -s' < kod/deploy/fiok-szamok.sh
set -euo pipefail
q() { docker exec kezjegy-db psql -At -F ' | ' -U kezjegy -d kezjegy -v ON_ERROR_STOP=1 -c "$1" < /dev/null; }
EM="'alex@demo.kezjegy.test','tulaj@demo.kezjegy.test','david@demo.kezjegy.test'"
echo "# ügyfél-fiókok: e-mail | státusz | lifecycle | iratok | NAV-számlák | bevételek | üzenetek | értesítések | negyedévek | adóprofilok"
q "select u.email, u.status, c.lifecycle,
  (select count(*) from documents d where d.client_id=c.id),
  (select count(*) from nav_invoices n where n.client_id=c.id),
  (select count(*) from revenue_items r where r.client_id=c.id),
  (select count(*) from messages m where m.client_id=c.id),
  (select count(*) from notifications x where x.user_id=u.id),
  (select count(*) from tax_periods t where t.client_id=c.id),
  (select count(*) from client_tax_profiles p where p.client_id=c.id)
  from users u join clients c on c.user_id=u.id where u.email in ($EM) order by 1"
echo "# könyvelő (bence.kovacs@): státusz | ügyfelei | aktív munkamenetek"
q "select u.status, (select count(*) from clients c where c.accountant_id=a.id), (select count(*) from sessions s where s.user_id=u.id and s.revoked_at is null and s.expires_at > now())
  from users u join accountants a on a.user_id=u.id where u.email='bence.kovacs@demo.kezjegy.test'"
echo "# összes: felhasználó | ügyfél | migráció"
q "select (select count(*) from users), (select count(*) from clients), (select count(*) from drizzle.__drizzle_migrations)"
echo "# a régi terméknév tárolt szövegekben (darab): content_texts | faq"
q "select (select count(*) from content_texts where body ilike '%Kézjegy%'), (select count(*) from faq_items where question ilike '%Kézjegy%' or answer ilike '%Kézjegy%')" 2>/dev/null || q "select (select count(*) from content_texts where body ilike '%Kézjegy%'), 'nincs faq_items'"
