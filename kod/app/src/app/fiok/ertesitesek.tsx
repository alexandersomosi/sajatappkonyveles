// Értesítési beállítások (FUNKCIOK 18): mikről szóljunk telefonon (push) és e-mailben. Az appon belül mindig látszik.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NotificationKind } from '@/_shared/enums';
import { ApiHiba } from '@/api/http';
import { useErtesitesBeallit, useMe } from '@/api/hooks';
import { szin } from '@/theme/tokens';
import { GombE, Kapcsolo, Lap, Szakasz } from '@/ui/alap';
import { Betolt, CimSor, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';

const FAJTAK: { kind: NotificationKind; cim: string; al: string; csoport?: string }[] = [
  { kind: 'tax_approved', cim: 'Megvan a fizetendő összeg', al: 'Amikor a könyvelőd kiszámolta és jóváhagyta.' },
  { kind: 'tax_due_soon', cim: 'Közeledik a befizetés', al: '7, 3 és 1 nappal előtte, ha még nem jelölted befizetettnek.' },
  { kind: 'request_new', cim: 'A könyvelőd kér valamit', al: 'Például egy kivonatot.' },
  { kind: 'message_new', cim: 'Új üzenet', al: 'Amikor a könyvelőd válaszol.' },
  { kind: 'document_processed', cim: 'Feldolgozta az iratokat', al: 'Naponta legfeljebb egyszer.' },
  { kind: 'limit_warning', cim: 'Közel vagy egy határhoz', al: 'Például az ÁFA-mentesség 80%-ánál.' },
  // SPEC §26.11 – a régi időpont-értesítések (LEGACY_NOTIFICATION_KINDS) nem látszanak.
  { kind: 'callback_calling', cim: 'Most hív kollégánk', al: 'Amikor éppen hívunk.', csoport: 'Visszahívás' },
  { kind: 'callback_missed', cim: 'Kerestünk, de nem értünk el', al: 'Ha nem tudtad felvenni.' },
  { kind: 'callback_wrong_number', cim: 'Javítsd ki a telefonszámodat', al: 'Ha a megadott számon nem értünk el.' },
  { kind: 'callback_unreached', cim: 'Háromszor sem értünk el', al: 'Utána írj nekünk, vagy kérj új visszahívást.' },
  { kind: 'registration_reminder', cim: 'Emlékeztető a bejelentésről', al: 'Ha még nem küldted be a vállalkozásod bejelentését.', csoport: 'Vállalkozás bejelentése' },
  { kind: 'registration_needs_fix', cim: 'Javítani kell valamit', al: 'Ha a NAV-os értesítésen valami nem stimmel.' },
  { kind: 'registration_checked', cim: 'Rendben van a bejelentésed', al: 'Amikor átnéztük a NAV-os értesítést.' },
  { kind: 'registration_done', cim: 'Elindult a vállalkozásod', al: 'Amikor rögzítettük az adószámodat.' },
  // SPEC §27.8 – „Intézzük helyetted” és a kamarai regisztráció
  { kind: 'kamara_reminder', cim: 'Kamarai regisztráció', al: 'Emlékeztető a határidő előtt és a határidő napján.' },
  { kind: 'assist_started', cim: 'Beszéltünk – így haladunk', al: 'A hívás után, amikor elindítjuk.', csoport: 'Intézzük helyetted' },
  { kind: 'assist_mh_filed', cim: 'Hagyd jóvá a meghatalmazást', al: 'Amikor a könyvelőd beküldte, és jóvá kell hagynod.' },
  { kind: 'assist_mh_reminder', cim: 'Emlékeztető a jóváhagyásról', al: 'Egy nappal később és az utolsó napon, ha még nem hagytad jóvá.' },
  { kind: 'assist_mh_expired', cim: 'Lejárt a 4 nap', al: 'Ha a NAV törölte a jóvá nem hagyott meghatalmazást.' },
  { kind: 'assist_consent_needed', cim: 'Engedélyezd a bejelentést', al: 'Amikor átnézheted, mit jelentünk be.' },
  { kind: 'assist_ev_filed', cim: 'Bejelentettük a vállalkozásodat', al: 'Amikor elment a NAV-hoz.' },
];

export default function ErtesitesBeallitas() {
  const me = useMe();
  const ment = useErtesitesBeallit();
  const jelez = useJelzes();
  const [prefs, setPrefs] = useState<Record<string, { push: boolean; email: boolean }>>({});
  useEffect(() => {
    if (me.data) setPrefs(Object.fromEntries(FAJTAK.map((f) => [f.kind, me.data?.notificationPrefs.find((p) => p.kind === f.kind) ?? { push: true, email: true }])));
  }, [me.data]);
  if (me.isLoading) return <Kepernyo ful="fiok"><Betolt /></Kepernyo>;
  return (
    <Kepernyo ful="fiok" fejlec={<CimSor visszaCim="Vissza" vissza={() => vissza('/fiok')} cim="Értesítések" al="Az appban minden értesítést látsz. Itt azt állítod be, mikor szóljunk telefonon vagy e-mailben." />}>
      {FAJTAK.map((f, i) => (
        <View key={f.kind}>
          {f.csoport ? (
            <T m={14} s={750} ls={0.06} c={szin.halvanyAlapon} style={{ marginTop: 28, paddingHorizontal: 4 }} accessibilityRole="header">
              {f.csoport.toLocaleUpperCase('hu-HU')}
            </T>
          ) : null}
          <Szakasz cim={f.cim} megj={f.al} style={i === 0 ? { paddingTop: 6 } : { paddingTop: 18 }} />
          <Lap>
            <Kapcsolo cim="Telefonon" tema={f.cim} be={prefs[f.kind]?.push ?? true} valt={(b) => setPrefs((p) => ({ ...p, [f.kind]: { ...p[f.kind], push: b } }))} />
            <View style={{ height: 1, backgroundColor: szin.hajszal, marginLeft: 18 }} />
            <Kapcsolo cim="E-mailben" tema={f.cim} be={prefs[f.kind]?.email ?? true} valt={(b) => setPrefs((p) => ({ ...p, [f.kind]: { ...p[f.kind], email: b } }))} />
          </Lap>
        </View>
      ))}
      <T m={14} c={szin.halvanyAlapon} lh={1.45} style={{ marginTop: 12, paddingHorizontal: 4 }}>
        A belépési kódokat és a jelszóval kapcsolatos leveleket mindig elküldjük.
      </T>
      <GombE
        cim="Mentés"
        tolt={ment.isPending}
        style={{ marginTop: 16 }}
        onPress={async () => {
          try {
            await ment.mutateAsync({ notificationPrefs: Object.entries(prefs).map(([kind, v]) => ({ kind, push: v.push, email: v.email })) });
            jelez({ szoveg: 'Elmentettük.', kesz: true });
          } catch (e) {
            jelez(hibaUzenet(e, 'Nem sikerült menteni.'));
          }
        }}
      />
    </Kepernyo>
  );
}
