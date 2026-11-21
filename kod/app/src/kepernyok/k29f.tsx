// SPEC §29 F1–F4 (B2): közös elemek – az igazolás állapota (idővonal), a naptár-lap és a sorok „Naptárba” lapja.
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { CALENDAR_TEXTS, type CertificateView } from '@/_shared/k29f';
import { fillPlaceholders } from '@/_shared/bekotes';
import { naptarLinkek, useNaptar, useNaptarBe, useNaptarKi } from '@/api/k29f';
import { letoltMegnyit } from '@/lib/fajlok';
import { hibaUzenet } from '@/lib/hiba';
import { vagolapra, MASOLAS_HIBA } from '@/lib/vagolap';
import { teljesIdo } from '@/lib/format';
import { brand } from '@/config';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, Lap, Szakasz } from '@/ui/alap';
import { KeszJel } from '@/ui/kepek';
import { AlsoLap, useJelzes, Kartyak } from '@/ui/keret';
import { T } from '@/ui/T';


/** Az igazolás állapot-színe: kész → pecsét, elutasítva → piros, a többi semleges. */
export function IgazolasAllapot({ v }: { v: CertificateView }) {
  const kesz = v.status === 'kesz';
  const rossz = v.status === 'elutasitva';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
      {kesz ? <KeszJel pt={19} /> : null}
      <T m={15} s={600} lh={1.4} c={rossz ? szin.veszely : kesz ? szin.tinta : szin.halvany} style={{ flex: 1 }}>
        {v.statusText}
      </T>
    </View>
  );
}

/** „Hol tart?” – az állapotok sorban, a legutóbbi felül. */
export function Idovonal({ v, kotott }: { v: CertificateView; kotott?: boolean }) {
  const sorok = [...v.timeline].reverse();
  return (
    <Lap kotott={kotott} style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
      {sorok.map((e, i) => (
        <View key={`${e.status}-${e.at}`} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8 }}>
          <View style={{ width: 12, alignItems: 'center', paddingTop: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i === 0 ? szin.tintakek : szin.keret }} />
            {i < sorok.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: szin.hajszal, marginTop: 4 }} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <T m={15.5} s={i === 0 ? 650 : 500} lh={1.4} c={i === 0 ? szin.tinta : szin.halvany}>
              {e.text}
            </T>
            <T m={13.5} c={szin.halvany} lh={1.4}>
              {teljesIdo(e.at)}
            </T>
          </View>
        </View>
      ))}
    </Lap>
  );
}

/** F4: „Naptárba” szakasz a Határidők tetején – feliratkozás, link másolása, új link, kikapcsolás. */
export function NaptarSzakasz() {
  const q = useNaptar();
  const be = useNaptarBe();
  const ki = useNaptarKi();
  const jelez = useJelzes();
  const [lap, setLap] = useState(false);
  const [kerdes, setKerdes] = useState<'uj' | 'ki' | null>(null);
  const v = q.data;
  const nyit = async () => {
    try {
      if (!v?.enabled) await be.mutateAsync(undefined as never);
      setLap(true);
    } catch (e) {
      jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    }
  };
  const megnyit = (url: string | null | undefined) => {
    if (!url) return;
    if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
    else void Linking.openURL(url).catch(() => jelez('Ezt a naptárat nem találjuk a telefonodon. Másold ki a linket.'));
  };
  return (
    <Kartyak>
      <Szakasz ikon="hataridok" cim={CALENDAR_TEXTS.sectionTitle} megj={CALENDAR_TEXTS.sectionSub} />
      <Lap kotott style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
        {v?.enabled ? (
          <T m={14.5} s={600} c={szin.halvany} style={{ paddingLeft: 54 }}>
            {CALENDAR_TEXTS.on}
          </T>
        ) : null}
        <GombM cim={CALENDAR_TEXTS.subscribe} ikon="hataridok" tolt={be.isPending} onPress={() => void nyit()} />
      </Lap>
      <AlsoLap lathato={lap} bezar={() => setLap(false)}>
        <T m={20} s={700} lh={1.25} style={{ marginBottom: 12 }}>
          {CALENDAR_TEXTS.sheetTitle}
        </T>
        <View style={{ gap: 10 }}>
          <GombM cim={CALENDAR_TEXTS.google} onPress={() => megnyit(q.data?.googleUrl)} />
          <GombM cim={CALENDAR_TEXTS.apple} onPress={() => megnyit(q.data?.webcalUrl)} />
          <GombM cim={CALENDAR_TEXTS.outlook} onPress={() => megnyit(q.data?.outlookUrl)} />
          <GombM
            cim={CALENDAR_TEXTS.copy}
            ikon="masolas"
            onPress={async () => {
              const ok = q.data?.httpsUrl ? await vagolapra(q.data.httpsUrl) : false;
              jelez(ok ? { szoveg: CALENDAR_TEXTS.copied, kesz: true } : MASOLAS_HIBA);
            }}
          />
        </View>
        <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 14 }}>
          {CALENDAR_TEXTS.info}
        </T>
        {kerdes ? (
          <View style={{ marginTop: 14, gap: 10 }}>
            <T m={15.5} s={600} lh={1.45}>
              {kerdes === 'uj' ? CALENDAR_TEXTS.rotateAsk : CALENDAR_TEXTS.offAsk}
            </T>
            <GombE
              cim={kerdes === 'uj' ? CALENDAR_TEXTS.rotate : CALENDAR_TEXTS.off}
              tolt={be.isPending || ki.isPending}
              onPress={async () => {
                try {
                  if (kerdes === 'uj') {
                    await be.mutateAsync(undefined as never);
                    jelez({ szoveg: CALENDAR_TEXTS.rotated, kesz: true });
                  } else {
                    await ki.mutateAsync(undefined as never);
                    jelez({ szoveg: CALENDAR_TEXTS.offDone, kesz: true });
                    setLap(false);
                  }
                  setKerdes(null);
                } catch (e) {
                  jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
                }
              }}
            />
            <GombSz cim="Mégsem" onPress={() => setKerdes(null)} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
            <GombSz cim={CALENDAR_TEXTS.rotate} onPress={() => setKerdes('uj')} />
            <GombSz cim={CALENDAR_TEXTS.off} veszely onPress={() => setKerdes('ki')} />
          </View>
        )}
      </AlsoLap>
    </Kartyak>
  );
}

/** F4: egy határidő-sor „Naptárba” lapja (Google / Apple / Outlook). */
export function SorNaptarLap({ id, lathato, bezar }: { id: string | null; lathato: boolean; bezar: () => void }) {
  const jelez = useJelzes();
  const nyit = async (mit: 'google' | 'apple' | 'outlook') => {
    if (!id) return;
    try {
      if (mit === 'apple') {
        await letoltMegnyit(`/client/deadlines/${encodeURIComponent(id)}/ics`, 'hatarido.ics', 'text/calendar');
      } else {
        const l = await naptarLinkek(id);
        const url = mit === 'google' ? l.google : l.outlook;
        if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
        else await Linking.openURL(url);
      }
      bezar();
    } catch (e) {
      jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    }
  };
  return (
    <AlsoLap lathato={lathato} bezar={bezar}>
      <T m={20} s={700} lh={1.25} style={{ marginBottom: 12 }}>
        {CALENDAR_TEXTS.rowSheetTitle}
      </T>
      <View style={{ gap: 10 }}>
        <GombM cim={CALENDAR_TEXTS.rowGoogle} onPress={() => void nyit('google')} />
        <GombM cim={CALENDAR_TEXTS.rowApple} onPress={() => void nyit('apple')} />
        <GombM cim={CALENDAR_TEXTS.rowOutlook} onPress={() => void nyit('outlook')} />
      </View>
      <T m={14.5} lh={1.45} c={szin.halvany} style={{ marginTop: 12 }}>
        {fillPlaceholders('A naptárban csak a határidő neve látszik, összeg és név nem. Részletek az {brand} appban.', { brand: brand.name })}
      </T>
    </AlsoLap>
  );
}
