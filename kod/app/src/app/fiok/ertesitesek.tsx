// Értesítési beállítások (FUNKCIOK 18 + SPEC §28.2.3, §28.K.4) a C kinézetben: elöl a „Csendes idő” (éjjel ne szóljon
// a telefon), utána csoportonként egy-egy sor – jobbra két kis kapcsoló: Telefon / E-mail. Az appban minden látszik.
import { Fragment } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { NotificationSettings } from '@/_shared/api';
import { fillPlaceholders, NOTIFY_SETTINGS_TEXTS as N, REMINDER_TEXTS } from '@/_shared/bekotes';
import type { NotificationKind } from '@/_shared/enums';
import { useCsendesIdo, useErtesitesBeallit, useMe } from '@/api/hooks';
import { szin } from '@/theme/tokens';
import { GombE, Kapcsolo, Lap, Szakasz } from '@/ui/alap';
import type { Ikon3dNev } from '@/ui/kepek';
import { Betolt, CimSor, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { Lepteto } from '@/kepernyok/Urlap';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';

type Fajta = { kind: NotificationKind; cim: string; al: string };
const CSOPORTOK: { cim: string; ikon: Ikon3dNev; elemek: Fajta[] }[] = [
  {
    cim: 'Adó és befizetés',
    ikon: 'szamlaszam',
    elemek: [
      { kind: 'tax_approved', cim: 'Megvan a fizetendő összeg', al: 'Amikor a könyvelőd kiszámolta és jóváhagyta.' },
      { kind: 'tax_due_soon', cim: REMINDER_TEXTS.groups.befizetes, al: REMINDER_TEXTS.groupSubs.befizetes },
      { kind: 'limit_warning', cim: 'Közel vagy egy határhoz', al: 'Például az ÁFA-mentesség 80%-ánál.' },
    ],
  },
  {
    cim: N.groupSzamlak.charAt(0) + N.groupSzamlak.slice(1).toLocaleLowerCase('hu-HU'),
    ikon: 'szamlak',
    elemek: [{ kind: 'invoice_new', cim: N.invoiceNewRow, al: N.invoiceNewSub }],
  },
  {
    cim: 'Könyvelőd',
    ikon: 'uzenetek',
    elemek: [
      { kind: 'request_new', cim: 'A könyvelőd kér valamit', al: 'Például egy kivonatot.' },
      { kind: 'message_new', cim: 'Új üzenet', al: 'Amikor a könyvelőd válaszol.' },
      { kind: 'document_processed', cim: 'Feldolgozta az iratokat', al: 'Naponta legfeljebb egyszer.' },
    ],
  },
  {
    cim: 'Emlékeztetők',
    ikon: 'ora',
    elemek: [
      { kind: 'checkin_due', cim: 'Havi kérdések', al: 'Havonta egyszer: változott valami?' },
      { kind: 'upload_reminder', cim: REMINDER_TEXTS.groups.feltoltes, al: REMINDER_TEXTS.groupSubs.feltoltes },
      { kind: 'nudge', cim: REMINDER_TEXTS.groups.ra_var, al: REMINDER_TEXTS.groupSubs.ra_var },
      { kind: 'annual_due', cim: 'Éves zárás', al: 'A kérdőív és a bevallások határideje előtt.' },
    ],
  },
  {
    cim: 'Kedvezmények',
    ikon: 'igazolas',
    elemek: [
      { kind: 'allowance_decided', cim: N.allowanceDecidedRow, al: 'Amikor a könyvelőd átnézte a válaszaidat.' },
      { kind: 'allowance_check', cim: N.allowanceCheckRow, al: 'Év elején, és ha egy kedvezmény véget ér.' },
    ],
  },
  {
    cim: 'Visszahívás',
    ikon: 'ora',
    elemek: [
      { kind: 'callback_calling', cim: 'Most hív kollégánk', al: 'Amikor éppen hívunk. Ez csendes időben is szól.' },
      { kind: 'callback_missed', cim: 'Kerestünk, de nem értünk el', al: 'Ha nem tudtad felvenni.' },
      { kind: 'callback_wrong_number', cim: 'Javítsd ki a telefonszámodat', al: 'Ha a megadott számon nem értünk el.' },
      { kind: 'callback_unreached', cim: 'Háromszor sem értünk el', al: 'Utána írj nekünk, vagy kérj új visszahívást.' },
    ],
  },
  {
    cim: 'Intézzük helyetted',
    ikon: 'bevallas',
    elemek: [
      { kind: 'assist_started', cim: 'Beszéltünk – így haladunk', al: 'A hívás után, amikor elindítjuk.' },
      { kind: 'assist_mh_filed', cim: 'Hagyd jóvá a meghatalmazást', al: 'Amikor a könyvelőd beküldte, és jóvá kell hagynod.' },
      { kind: 'assist_mh_reminder', cim: 'Emlékeztető a jóváhagyásról', al: 'Egy nappal később és az utolsó napon.' },
      { kind: 'assist_mh_expired', cim: 'Lejárt a 4 nap', al: 'Ha a NAV törölte a jóvá nem hagyott meghatalmazást.' },
      { kind: 'assist_consent_needed', cim: 'Engedélyezd a bejelentést', al: 'Amikor átnézheted, mit jelentünk be.' },
      { kind: 'assist_ev_filed', cim: 'Bejelentettük', al: 'Amikor elment a NAV-hoz.' },
      { kind: 'assist_change_done', cim: N.assistChangeDoneRow, al: 'Amikor a NAV elfogadta a változást.' },
    ],
  },
  {
    cim: 'Vállalkozás bejelentése',
    ikon: 'irat',
    elemek: [
      { kind: 'registration_reminder', cim: 'Emlékeztető a bejelentésről', al: 'Ha még nem küldted be.' },
      { kind: 'registration_needs_fix', cim: 'Javítani kell valamit', al: 'Ha a NAV-os értesítésen valami nem stimmel.' },
      { kind: 'registration_checked', cim: 'Rendben van a bejelentésed', al: 'Amikor átnéztük a NAV-os értesítést.' },
      { kind: 'registration_done', cim: 'Elindult a vállalkozásod', al: 'Amikor rögzítettük az adószámodat.' },
      { kind: 'kamara_reminder', cim: 'Kamarai regisztráció', al: 'Emlékeztető a határidő előtt és a napján.' },
    ],
  },
];
const MIND = CSOPORTOK.flatMap((c) => c.elemek);

/** Kis kapcsoló-kapszula (Telefon / E-mail): 40 pt látszik, 44 pt a koppintási felület. */
function Kis({ cim, be, valt, tema }: { cim: string; be: boolean; valt: (b: boolean) => void; tema: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: be }}
      aria-checked={be}
      accessibilityLabel={`${tema}: ${cim}`}
      hitSlop={{ top: 2, bottom: 2 }}
      onPress={() => valt(!be)}
      style={{ height: 40, paddingHorizontal: 12, borderRadius: 999, backgroundColor: be ? szin.tintakek : szin.gombMAlap, justifyContent: 'center' }}
    >
      <T m={14.5} s={650} c={be ? '#fff' : szin.tintakekSzoveg}>
        {cim}
      </T>
    </Pressable>
  );
}

export default function ErtesitesBeallitas() {
  const me = useMe();
  const ment = useErtesitesBeallit();
  const csend = useCsendesIdo();
  const jelez = useJelzes();
  const [prefs, setPrefs] = useState<Record<string, { push: boolean; email: boolean }>>({});
  const [b, setB] = useState<NotificationSettings>({ quietEnabled: true, quietFrom: 20, quietTo: 8, pushShowAmounts: true });
  useEffect(() => {
    if (!me.data) return;
    setPrefs(Object.fromEntries(MIND.map((f) => [f.kind, me.data?.notificationPrefs.find((p) => p.kind === f.kind) ?? { push: true, email: f.kind !== 'invoice_new' }])));
    if (me.data.notificationSettings) setB(me.data.notificationSettings);
  }, [me.data]);
  if (me.isLoading) return <Kepernyo ful="fiok"><Betolt /></Kepernyo>;
  const allit = (kind: string, x: Partial<{ push: boolean; email: boolean }>) => setPrefs((p) => ({ ...p, [kind]: { ...p[kind], ...x } }));
  return (
    <Kepernyo
      ful="fiok"
      fejlec={<CimSor visszaCim="Vissza a Fiókhoz" vissza={() => vissza('/fiok')} cim="Értesítések" al="Az appban minden értesítést látsz. Itt azt állítod be, mikor szóljunk telefonon vagy e-mailben." />}
      dokk={
        <GombE
          cim="Mentés"
          tolt={ment.isPending || csend.isPending}
          onPress={async () => {
            try {
              await ment.mutateAsync({ notificationPrefs: Object.entries(prefs).map(([kind, v]) => ({ kind, push: v.push, email: v.email })) });
              await csend.mutateAsync({ notificationSettings: b });
              jelez({ szoveg: 'Elmentettük.', kesz: true });
            } catch (e) {
              jelez(hibaUzenet(e, 'Nem sikerült menteni.'));
            }
          }}
        />
      }
    >
      <Szakasz ikon="ora" cim={N.quietTitle} />
      <Lap>
        <Kapcsolo cim={N.quietToggle} al={fillPlaceholders(N.quietSub, { from: String(b.quietFrom), to: String(b.quietTo) })} be={b.quietEnabled} valt={(x) => setB((r) => ({ ...r, quietEnabled: x }))} />
        {b.quietEnabled ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <Lepteto cim={`${N.quietFrom}: ${b.quietFrom}:00`} ertek={b.quietFrom} min={0} max={23} valt={(n) => setB((r) => ({ ...r, quietFrom: n }))} />
            <Lepteto cim={`${N.quietTo}: ${b.quietTo}:00`} ertek={b.quietTo} min={0} max={23} valt={(n) => setB((r) => ({ ...r, quietTo: n }))} />
          </View>
        ) : null}
      </Lap>
      {CSOPORTOK.map((c) => (
        <Fragment key={c.cim}>
          <Szakasz ikon={c.ikon} cim={c.cim} />
          <Lap kotott>
            {c.elemek.map((f, i) => (
              <View key={f.kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8, marginHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T m={16} s={600} lh={1.35}>
                    {f.cim}
                  </T>
                  <T m={15} lh={1.4} c={szin.halvany}>
                    {f.al}
                  </T>
                </View>
                <View style={{ gap: 6 }}>
                  <Kis cim="Telefon" tema={f.cim} be={prefs[f.kind]?.push ?? true} valt={(x) => allit(f.kind, { push: x })} />
                  <Kis cim="E-mail" tema={f.cim} be={prefs[f.kind]?.email ?? true} valt={(x) => allit(f.kind, { email: x })} />
                </View>
              </View>
            ))}
            {c.elemek.some((f) => f.kind === 'invoice_new') ? (
              <View style={{ borderTopWidth: 1, borderTopColor: szin.hajszal, marginHorizontal: 16 }}>
                <View style={{ marginHorizontal: -16 }}>
                  <Kapcsolo cim={N.amountsToggle} al={N.amountsSub} be={b.pushShowAmounts} valt={(x) => setB((r) => ({ ...r, pushShowAmounts: x }))} />
                </View>
              </View>
            ) : null}
          </Lap>
        </Fragment>
      ))}
      <T m={15} c={szin.halvany} lh={1.45} style={{ marginTop: 12 }}>
        A belépési kódokat, a jelszóval kapcsolatos leveleket és a fizetési értesítéseket mindig elküldjük.
      </T>
    </Kepernyo>
  );
}
