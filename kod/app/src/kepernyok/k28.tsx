// SPEC §28 + §28.K közös elemei a C kinézetben (fehér szakaszok, köztük a 8 pt-os sáv; árnyék és doboz a dobozban nincs):
// a Főoldal két nagy száma, a „Félretenni” kártya a gyűrűvel, a „Mennyit kerestem?”, a havi ellenőrzés, az éves zárás, a
// szüneteltetés és a kedvezmény-tipp, valamint a számlánkénti „Ennyit tegyél félre” blokk és a „Miért ennyi?” lap.
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import type { AnnualView, CheckinView, EarningsCard, InvoiceReserveView, PauseView, ReserveCard, TwoNumbersView } from '@/_shared/api';
import { ALLOWANCE_TEXTS, ANNUAL_TEXTS, CHECKIN_TEXTS, EARNINGS_TEXTS, fillPlaceholders, HOME_K_TEXTS, PAUSE_TEXTS, RESERVE_TEXTS } from '@/_shared/bekotes';
import { useFelreteszJeloles, useKedvezmenyKapu } from '@/api/hooks';
import { hibaUzenet } from '@/lib/hiba';
import { szam } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { Cimke, Fejlec, GombE, GombM, GombSz, Lap, Szakasz } from '@/ui/alap';
import { Ikon3d } from '@/ui/kepek';
import { AlsoLap, useJelzes, Kartyak } from '@/ui/keret';
import { MiEzKor } from '@/ui/Magyarazat';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';

/** A szakasz tartalma a cím vonalán kezdődik (C: `.beljebb { padding-left: 38px }`). */
export const BELJEBB = 54;

/** Egy nagy szám (22/700, táblázatos), a „Ft” kisebb. */
export function NagySzam({ huf, elotte, m = 22 }: { huf: number; elotte?: string; m?: number }) {
  return (
    <T m={m} s={700} lh={1.2} szam ls={-0.01}>
      {elotte ? `${elotte} ` : ''}
      {szam(huf)}
      <T m={m * 0.75} s={600} c={szin.halvany}>
        {' Ft'}
      </T>
    </T>
  );
}

/** Kis amber „DEMO” jel a még nem véglegesített díj mellett (SPEC §28.K.1). */
export function DemoDij() {
  return <Cimke szoveg="DEMO" style={{ marginLeft: 6 }} />;
}

/** Sor egy összeggel jobbra (ikon nélkül; C `lsor`). */
export function OsszegSor({ cim, al, huf, kb, elso }: { cim: string; al?: string | null; huf: number | null; kb?: boolean; elso?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6, borderTopWidth: elso ? 0 : 1, borderTopColor: szin.hajszal }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T m={16} s={600} lh={1.35}>
          {cim}
        </T>
        {al ? (
          <T m={15} lh={1.4} c={szin.halvany}>
            {al}
          </T>
        ) : null}
      </View>
      {huf != null ? (
        <T m={16} s={650} szam style={{ flexShrink: 0 }}>
          {kb ? 'kb. ' : ''}
          {szam(huf)} Ft
        </T>
      ) : null}
    </View>
  );
}

// ---------- Főoldal: két nagy szám (SPEC §28.K.12 #1) ----------
export function KetSzam({ v, elso }: { v: TwoNumbersView; elso?: boolean }) {
  const doboz = (cim: string, huf: number | null, al: string | null) => (
    <View style={{ flex: 1, minWidth: 140, paddingVertical: 4 }}>
      <T m={15} c={szin.halvany} lh={1.35}>
        {cim}
      </T>
      {huf != null ? <NagySzam huf={huf} /> : null}
      {al ? (
        <T m={15} lh={1.35} c={szin.halvany}>
          {al}
        </T>
      ) : null}
    </View>
  );
  return (
    <Lap elso={elso} style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 }}>
      {doboz(HOME_K_TEXTS.revenue, v.revenueHuf, v.revenueSub)}
      {doboz(HOME_K_TEXTS.taxes, v.taxesHuf, v.taxesSub)}
    </Lap>
  );
}

/** A Kepernyo ennek az első példányának átadja az `elso` jelet (nincs sáv a kék fejléc alatt). */
(KetSzam as unknown as { szakaszos: boolean }).szakaszos = true;

// ---------- „Félretenni” gyűrű (SPEC §28.K.12 #3) ----------
function Gyuru({ arany, maradt }: { arany: number; maradt: number }) {
  const r = 32;
  const k = 2 * Math.PI * r;
  return (
    <View style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={`Félretéve ${Math.round(arany * 100)} százalék, még ${szam(maradt)} forint`}>
      <Svg width={76} height={76} style={{ position: 'absolute' }}>
        <Circle cx={38} cy={38} r={r} stroke={szin.hajszal} strokeWidth={7} fill="none" />
        <Circle cx={38} cy={38} r={r} stroke={szin.tintakek} strokeWidth={7} fill="none" strokeDasharray={`${k * arany} ${k}`} strokeLinecap="round" transform="rotate(-90 38 38)" />
      </Svg>
      <T m={11.5} s={600} c={szin.halvany} lh={1.1} kozep>
        Még
      </T>
      <T m={12.5} s={750} lh={1.15} szam kozep>
        {szam(maradt)}
      </T>
    </View>
  );
}

export function FelreteszKartya({ c, fn }: { c: ReserveCard; fn: string }) {
  const [jelol, setJelol] = useState(false);
  return (
    <Kartyak>
      <Szakasz ikon="szamlaszam" cim={RESERVE_TEXTS.kartya.title} jobbra={<MiEzKor kulcs="felretesz_miert" />} />
      <Lap kotott style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ paddingLeft: BELJEBB }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {c.ring ? <Gyuru arany={c.ring.ratio} maradt={c.ring.remainingHuf} /> : null}
            <T m={20} s={700} lh={1.3} szam style={{ flex: 1 }}>
              {c.ring ? c.ring.line : c.sentence}
            </T>
          </View>
          <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 6 }}>
            {c.keepNowHuf > 0 ? `${c.detail}${c.heroNote ? ` ${c.heroNote}` : ''}` : fillPlaceholders(RESERVE_TEXTS.kartya.detailZero, {})}
          </T>
          {c.refundText ? (
            <T m={15} s={600} lh={1.45} c={szin.tintakekSzoveg} style={{ marginTop: 4 }}>
              {c.refundText}
            </T>
          ) : null}
          <View style={{ marginTop: 6 }}>
            <OsszegSor elso cim={RESERVE_TEXTS.kartya.rowSzamlak} al={c.invoicesSub ?? null} huf={c.invoicesHuf} kb={c.invoicesHuf > 0} />
            {c.extraRow ? <OsszegSor cim={c.extraRow.label} al={c.extraRow.sub} huf={c.extraRow.huf} kb /> : null}
            {c.fixedMonthlyHuf > 0 ? <OsszegSor cim={RESERVE_TEXTS.kartya.rowFix} al={fillPlaceholders(RESERVE_TEXTS.kartya.rowFixSub, { fixedMonthly: szam(c.fixedMonthlyHuf) })} huf={c.fixedHuf} /> : null}
            {c.hipaAnnualHuf != null ? <OsszegSor cim={RESERVE_TEXTS.kartya.rowHipa} al={fillPlaceholders(RESERVE_TEXTS.kartya.rowHipaSub, { hipaAnnual: szam(c.hipaAnnualHuf) })} huf={c.hipaHuf} kb={c.hipaHuf > 0} /> : null}
            <OsszegSor cim={RESERVE_TEXTS.kartya.rowLezart} al={RESERVE_TEXTS.kartya.rowLezartSub} huf={c.dueOrPaidHuf} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <GombM cim={HOME_K_TEXTS.ringMark} onPress={() => setJelol(true)} />
            <GombSz cim={RESERVE_TEXTS.kartya.link} m={16} onPress={() => router.push('/felretesz')} />
          </View>
          <T m={13.5} lh={1.4} c={szin.halvany} style={{ marginTop: 6 }}>
            {fillPlaceholders(RESERVE_TEXTS.kartya.footnote, { firstName: fn })}
          </T>
          {c.estimateReasons.map((r) => (
            <T key={r.code} m={13.5} lh={1.4} c={szin.borostyanSzoveg} style={{ marginTop: 2 }}>
              {r.text}
            </T>
          ))}
        </View>
      </Lap>
      <JelolesLap lathato={jelol} bezar={() => setJelol(false)} ev={c.year} most={c.markedHuf ?? null} />
    </Kartyak>
  );
}

function JelolesLap({ lathato, bezar, ev, most }: { lathato: boolean; bezar: () => void; ev: number; most: number | null }) {
  const [ertek, setErtek] = useState(most != null ? String(most) : '');
  const ment = useFelreteszJeloles();
  const jelez = useJelzes();
  const [hiba, setHiba] = useState<string | null>(null);
  return (
    <AlsoLap lathato={lathato} bezar={bezar}>
      <T m={20} s={700} lh={1.3} style={{ marginRight: 80 }} accessibilityRole="header">
        {HOME_K_TEXTS.ringMarkTitle}
      </T>
      <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 6 }}>
        Csak te írod be, mi nem látjuk a bankszámládat. Ha utalsz a NAV-nak, levonjuk belőle.
      </T>
      <Mezo felirat="Félretéve (Ft)" keyboardType="number-pad" value={ertek} onChangeText={(s) => setErtek(s.replace(/\D/g, ''))} hiba={hiba} style={{ marginTop: 14 }} />
      <GombE
        cim="Mentem"
        tolt={ment.isPending}
        style={{ marginTop: 16 }}
        onPress={async () => {
          const n = Number(ertek || '0');
          if (!Number.isFinite(n) || n < 0) return setHiba('Írj be egy összeget forintban.');
          try {
            await ment.mutateAsync({ year: ev, markedHuf: n });
            jelez({ szoveg: 'Elmentettük.', kesz: true });
            bezar();
          } catch (e) {
            setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
          }
        }}
      />
    </AlsoLap>
  );
}

// ---------- „Mennyit kerestem?” (SPEC §28.4.4) ----------
export function KeresetKartya({ e }: { e: EarningsCard }) {
  return (
    <Kartyak>
      <Szakasz ikon="kivonat" cim={EARNINGS_TEXTS.cardTitle} jobbra={<MiEzKor kulcs="kereset_miert" />} />
      <Lap kotott style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ paddingLeft: BELJEBB }}>
          <T m={20} s={700} lh={1.3} szam>
            {e.sentence}
          </T>
          <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 4 }}>
            {e.sub}
          </T>
          {e.refundText ? (
            <T m={15} s={600} lh={1.45} c={szin.tintakekSzoveg} style={{ marginTop: 4 }}>
              {e.refundText}
            </T>
          ) : null}
          {e.projectionText ? (
            <T m={16} lh={1.45} style={{ marginTop: 6 }}>
              {e.projectionText}
            </T>
          ) : null}
          <GombSz cim={EARNINGS_TEXTS.cardLink} m={16} onPress={() => router.push('/kereset')} style={{ minHeight: 44, justifyContent: 'center' }} />
        </View>
      </Lap>
    </Kartyak>
  );
}

/** Szakasz egy mondattal és egy kapszulával jobbra (havi ellenőrzés, éves zárás, kedvezmény-tipp, szünetelés). */
function TeendoSzakasz({ ikon, cim, szoveg, gomb, onPress, masik }: { ikon: Parameters<typeof Ikon3d>[0]['nev']; cim: string; szoveg: string; gomb: string; onPress: () => void; masik?: { cim: string; onPress: () => void } }) {
  // 320 px: a long title next to the capsule broke inside the word ("vállalkozás / od") – the capsule goes under the text
  const keskeny = useWindowDimensions().width < 360 && cim.length > 10;
  return (
    <Kartyak>
      <Szakasz ikon={ikon} cim={cim} jobbra={keskeny ? undefined : <GombM cim={gomb} onPress={onPress} />} />
      <Lap kotott style={{ paddingHorizontal: 16, paddingBottom: masik ? 4 : 14 }}>
        <View style={{ paddingLeft: BELJEBB }}>
          <T m={16} lh={1.45}>
            {szoveg}
          </T>
          {keskeny ? <GombM cim={gomb} onPress={onPress} style={{ marginTop: 10, alignSelf: 'flex-start' }} /> : null}
          {masik ? <GombSz cim={masik.cim} m={16} onPress={masik.onPress} style={{ minHeight: 44, justifyContent: 'center' }} /> : null}
        </View>
      </Lap>
    </Kartyak>
  );
}

export function HaviKartya({ c }: { c: CheckinView }) {
  // minden üzenet egyszer: a cím maga a kérdés, alatta csak az, mennyi idő
  return <TeendoSzakasz ikon="kerdezek" cim={fillPlaceholders(CHECKIN_TEXTS.title, { honap: c.periodLabel })} szoveg={CHECKIN_TEXTS.homeCard.body} gomb={CHECKIN_TEXTS.homeCard.button} onPress={() => router.push('/valtozott')} />;
}

export function EvesKartya({ a, fn }: { a: AnnualView; fn: string }) {
  const gomb = a.nextAction === 'kitoltes' ? ANNUAL_TEXTS.buttons.kerdoiv : a.nextAction === 'fizetes' ? ANNUAL_TEXTS.buttons.dijra_var : a.nextAction === 'jovahagyas' ? 'Átnézem' : 'Megnézem';
  void fn;
  // SPEC §32.B: after the filing the difference / refund sentence; the next step of the timeline as a second line
  const szoveg = [a.settlement?.text ?? a.statusText, a.timelineNext].filter(Boolean).join('\n');
  const ut = a.nextAction === 'kitoltes' ? '/eves-zaras/kerdoiv' : a.nextAction === 'jovahagyas' && a.summary ? '/eves-zaras/jovahagyas' : '/eves-zaras';
  return <TeendoSzakasz ikon="bevallas" cim={fillPlaceholders(ANNUAL_TEXTS.card.title, { ev: String(a.year) })} szoveg={szoveg} gomb={gomb} onPress={() => router.push(ut as never)} />;
}

/** Javító kör 11-21: an önellenőrzés waiting for the client's approval – on the Főoldal too. */
export function OnellKartya({ k }: { k: { id: string; title: string; statusText: string } }) {
  return <TeendoSzakasz ikon="bevallas" cim={k.title} szoveg={k.statusText} gomb="Átnézem" onPress={() => router.push(`/onellenorzes/${k.id}` as never)} />;
}

export function SzunetelKartya({ p }: { p: PauseView }) {
  return <TeendoSzakasz ikon="tepnaptar" cim={PAUSE_TEXTS.cardTitle} szoveg={p.text} gomb={PAUSE_TEXTS.cardButton} onPress={() => router.push('/valtozas/valtozas_folytatas')} />;
}

export function KedvezmenyTipp({ ev }: { ev: number }) {
  const kapu = useKedvezmenyKapu();
  const jelez = useJelzes();
  return (
    <TeendoSzakasz
      ikon="igazolas"
      cim="Adókedvezmény"
      szoveg={ALLOWANCE_TEXTS.hint.text}
      gomb={ALLOWANCE_TEXTS.hint.button}
      onPress={() => router.push('/kedvezmenyek/kerdoiv')}
      masik={{
        cim: ALLOWANCE_TEXTS.hint.close,
        onPress: async () => {
          try {
            await kapu.mutateAsync({ year: ev, gate: 'kesobb' });
          } catch (e) {
            jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
          }
        },
      }}
    />
  );
}

// ---------- számlánként: „Ennyit tegyél félre” (SPEC §28.1.5) ----------
export function TartalekBlokk({ r, haviFix, fn }: { r: InvoiceReserveView; haviFix?: number | null; fn: string }) {
  const [miert, setMiert] = useState(false);
  const line = r.line + (r.nextYear ? RESERVE_TEXTS.jovore : '');
  return (
    <Kartyak>
      <Szakasz ikon="szamlaszam" cim={RESERVE_TEXTS.blockTitle} jobbra={r.zone !== 'nincs_adat' ? <GombM cim={RESERVE_TEXTS.miertLink} onPress={() => setMiert(true)} /> : undefined} />
      <Lap kotott style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <View style={{ paddingLeft: BELJEBB }}>
          <T m={17} s={600} lh={1.4} szam>
            {line}
          </T>
          {r.partsText ? (
            <T m={15} lh={1.4} c={szin.halvany} style={{ marginTop: 4 }}>
              {r.partsText}
            </T>
          ) : null}
          {r.thresholdText ? (
            <T m={15} s={600} lh={1.4} c={szin.borostyanSzoveg} style={{ marginTop: 6 }}>
              {r.thresholdText}
            </T>
          ) : null}
          {r.zone === 'adomentes' && haviFix ? (
            <T m={15} lh={1.4} c={szin.halvany} style={{ marginTop: 4 }}>
              {fillPlaceholders(RESERVE_TEXTS.haviFix, { havi: szam(haviFix) })}
            </T>
          ) : null}
          {r.estimated ? (
            <T m={13.5} lh={1.4} c={szin.halvany} style={{ marginTop: 6 }}>
              {RESERVE_TEXTS.becslesSor}
            </T>
          ) : null}
        </View>
      </Lap>
      <MiertLap lathato={miert} bezar={() => setMiert(false)} r={r} fn={fn} />
    </Kartyak>
  );
}

export function MiertLap({ lathato, bezar, r, fn }: { lathato: boolean; bezar: () => void; r: InvoiceReserveView; fn: string }) {
  const m = RESERVE_TEXTS.miert;
  // k6c2: the server builds the sheet for the client's status and the zone (no zero parts, a signed total, the bullets
  // that apply); the fallback below is only for an older server
  const sorok = r.miert
    ? r.miert.rows
    : [
        r.parts.szjaHuf ? fillPlaceholders(m.szja, { szja: szam(r.parts.szjaHuf) }) : null,
        r.parts.tbHuf ? fillPlaceholders(m.tb, { tb: szam(r.parts.tbHuf) }) : null,
        r.parts.szochoHuf ? fillPlaceholders(m.szocho, { szocho: szam(r.parts.szochoHuf) }) : null,
      ].filter((x): x is string => Boolean(x));
  const osszesen = r.miert
    ? r.miert.total
    : r.reserveHuf > 0
      ? fillPlaceholders(m.osszesen, { felre: szam(r.reserveHuf) })
      : r.reserveHuf < 0
        ? fillPlaceholders(m.osszesenSztorno, { felre: szam(Math.abs(r.reserveHuf)) })
        : m.osszesenNulla;
  const pontok = r.miert ? r.miert.bullets : fillPlaceholders(m.szoveg, { jovedelemArany: '55', firstName: fn }).split('\n');
  return (
    <AlsoLap lathato={lathato} bezar={bezar}>
      <T m={20} s={700} lh={1.3} accessibilityRole="header" style={{ marginRight: 80 }}>
        {m.title}
      </T>
      <View style={{ marginTop: 10 }}>
        {sorok.map((s, i) => (
          <T key={i} m={16} lh={1.5} szam style={{ paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal }}>
            {s}
          </T>
        ))}
        <T m={16} s={700} lh={1.5} szam style={{ paddingVertical: 6, borderTopWidth: sorok.length ? 1 : 0, borderTopColor: szin.hajszal }}>
          {osszesen}
        </T>
      </View>
      {pontok.map((s, i) => (
        <T key={i} m={16} lh={1.5} style={{ marginTop: i ? 4 : 14 }}>
          {s}
        </T>
      ))}
    </AlsoLap>
  );
}

/** A számlalista második alsora: „Tegyél félre kb. 18 000 Ft-ot”. */
export function TartalekAlsor({ r }: { r?: InvoiceReserveView }) {
  if (!r?.listLine) return null;
  return (
    <T m={15} s={r.reserveHuf > 0 ? 600 : 400} lh={1.4} c={r.reserveHuf > 0 ? szin.tinta : szin.halvany} szam>
      {r.listLine}
    </T>
  );
}

/** Kicsi, koppintható összeg-gomb a fejlécben (a „Mi ez?” mellett): nem használt, de exportálva a tesztekhez. */
export function Koppinthato({ cim, onPress }: { cim: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <T m={16} s={550} c={szin.tintakekSzoveg} alahuz>
        {cim}
      </T>
    </Pressable>
  );
}

/**
 * C fejléc a §28-as képernyőkre: a kék sáv a „Vissza” kapszulával, alatta a képernyő egyetlen fő üzenete
 * (3D ikon 30 + cím 26 + egy mondat), ahogy a jóváhagyott `valasztott/fooldal.html` sávja.
 */
export function SavFej({ vissza, ikon, cim, mondat, nagy, gyerek }: { vissza: () => void; ikon: Parameters<typeof Ikon3d>[0]['nev']; cim: string; mondat?: string | null; nagy?: string | null; gyerek?: React.ReactNode }) {
  return (
    <Fejlec rozX={318} rozY={128} alsoTer={20}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 16 }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Vissza"
          onPress={vissza}
          hitSlop={4}
          style={({ pressed }) => [{ height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)', justifyContent: 'center' }, pressed && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
        >
          <T m={15.5} s={650} c="#fff">
            Vissza
          </T>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 16 }}>
        <Ikon3d nev={ikon} pt={30} />
        <T m={26} s={700} lh={1.15} ls={-0.022} c="#fff" style={{ flex: 1 }} accessibilityRole="header">
          {cim}
        </T>
      </View>
      {nagy ? (
        <T m={22} s={700} lh={1.25} c="#fff" szam style={{ marginTop: 6, paddingLeft: 54, paddingRight: 16 }}>
          {nagy}
        </T>
      ) : null}
      {mondat ? (
        <T m={16} lh={1.45} c={szin.fejlecHalvany} style={{ marginTop: 4, paddingLeft: 54, paddingRight: 16 }}>
          {mondat}
        </T>
      ) : null}
      {gyerek}
    </Fejlec>
  );
}
