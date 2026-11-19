// Értesítések az appon belül (FUNKCIOK 18): push nélkül is minden itt van; koppintásra a megfelelő képernyő.
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useErtesitesek, useOlvasott } from '@/api/hooks';
import { mikorIdovel } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { GombSz, Lap, Sor } from '@/ui/alap';
import { ma } from '@/ui/ido';
import { Targykep, type Ikon3dNev } from '@/ui/kepek';
import { LEGACY_NOTIFICATION_KINDS, type NotificationKind } from '@/_shared/enums';
import { Betolt, CimSor, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { View } from 'react-native';

// Az ikon az értesítés fajtájából jön, nem minden sorban ugyanaz a csengő.
const FAJTA_IKON: Partial<Record<NotificationKind, Ikon3dNev>> = {
  tax_approved: 'boritek',
  tax_due_soon: 'hataridok',
  tax_reopened: 'szamolo',
  tax_payment_verified: 'befizetve_jel',
  tax_payment_mismatch: 'szamlaszam',
  tax_filed: 'bevallas',
  document_processed: 'dosszie',
  document_filed: 'bevallas',
  request_new: 'feltoltes',
  request_reminder: 'feltoltes',
  request_done: 'igazolas',
  message_new: 'kerdezek',
  onboarding_needs_fix: 'fiok',
  onboarding_done: 'befizetve_jel',
  limit_warning: 'szamolo',
  appointment_booked: 'hataridok',
  appointment_reminder: 'hataridok',
  appointment_cancelled: 'hataridok',
  subscription_payment_failed: 'szamlaszam',
  subscription_renewal_needed: 'szamlaszam',
  subscription_canceled: 'szamlaszam',
  fee_invoice_issued: 'szamlak',
  gdpr_export_ready: 'dosszie',
  // SPEC §26.11
  callback_received: 'ora',
  callback_calling: 'ora',
  callback_missed: 'ora',
  callback_wrong_number: 'ora',
  callback_done: 'ora',
  callback_unreached: 'ora',
  callback_closed: 'ora',
  registration_reminder: 'bevallas',
  registration_needs_fix: 'bevallas',
  registration_checked: 'bevallas',
  registration_done: 'bevallas',
};

export default function Ertesitesek() {
  const q = useErtesitesek();
  const olvas = useOlvasott();
  // SPEC §26.2.9: a régi időpont-értesítések nem jelennek meg (a szerver sem küldi már őket; egy régebbi szervernél itt szűrünk).
  const lista = (q.data?.items ?? []).filter((n) => !LEGACY_NOTIFICATION_KINDS.includes(n.kind as NotificationKind));
  const olvasatlan = lista.filter((n) => !n.readAt).length;
  useEffect(() => {
    if (olvasatlan) {
      const t = setTimeout(() => olvas.mutate({ all: true }), 2500);
      return () => clearTimeout(t);
    }
  }, [olvasatlan]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Kepernyo
      ful="fiok"
      fejlec={<CimSor visszaCim="Vissza" vissza={() => vissza('/fiok')} cim="Értesítések" al={olvasatlan ? `${olvasatlan} új` : 'Mindent láttál.'} />}
    >
      {q.isLoading ? <Betolt /> : q.error ? <Hiba hiba={q.error} ujra={() => void q.refetch()} /> : lista.length ? (
        <Lap>
          {lista.map((n, i) => (
            <Sor
              key={n.id}
              elso={i === 0}
              ikon={FAJTA_IKON[n.kind] ?? 'ertesites'}
              cim={n.title}
              cimSuly={n.readAt ? 500 : 650}
              al={
                <View>
                  <T m={14.5} c={szin.halvany} lh={1.4} style={{ marginTop: 2 }}>
                    {n.body}
                  </T>
                  <T m={13} c={szin.halvany} style={{ marginTop: 3 }}>
                    {mikorIdovel(n.createdAt, ma())}
                    {n.readAt ? '' : ' · új'}
                  </T>
                </View>
              }
              onPress={n.link ? () => router.push(n.link as never) : undefined}
            />
          ))}
        </Lap>
      ) : (
        <Lap style={{ padding: 18, alignItems: 'center' }}>
          <Targykep nev="level_boritek" style={{ marginBottom: 8 }} />
          <T m={16} c={szin.halvany} kozep>
            Még nincs értesítésed.
          </T>
        </Lap>
      )}
      <GombSz cim="Mikről kérsz értesítést?" onPress={() => router.push('/fiok/ertesitesek')} style={{ marginTop: 8, marginLeft: 4 }} />
    </Kepernyo>
  );
}
