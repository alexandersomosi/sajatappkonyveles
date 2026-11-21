// SPEC §27.4 – az átlátható bekötés építőkövei: „Most ez jön” kártya, várakozó kártya (ki dolgozik, mennyi ideig,
// meddig – utána visszahívás), az EGY lista („Így halad a bekötésed”: szám · név · ki lép · állapot · idő · Mi ez?),
// a kiemelt „Intézzük helyetted” kártya, a kérés állapotsora, és a válasz módosítása (S5) + „Hogyan jelentsük be?” (S3)
// alsó lapként, bárhonnan nyitható (useUtvaltas). Szöveg: kod/shared (§27 blokkok); a számot a szerver adja.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import type { AssistView, CallbackView, JourneyStepView, JourneyView, OnboardingState, PathChangeInfo, WaitingCardView } from '../_shared/api';
import { ASSIST_TEXTS, fillPlaceholders, JOURNEY_TEXTS, PATH_CHANGE_TEXTS, START_MODE_TEXTS } from '../_shared/bekotes';
import { ASSIST_EV_VALID_UNTIL_DEFAULT, PATH_CHANGE_ERROR_CODE, type AssistKind, type BusinessStatus, type CallbackSource } from '../_shared/enums';
import { ApiHiba } from '../api/http';
import { K, useKeresek, useMe, useOnboarding, useUzletiAllapot, useVallalkozas } from '../api/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { hibaUzenet } from '../lib/hiba';
import { funkcio, hozzaferesBol } from '../lib/hozzaferes';
import { maiNap } from '../lib/format';
import { helyettunkUt, segitsegSzoveg, utEpit, utolsoSegitseg, utvaltasInfo } from '../lib/ut';
import { forma, szin } from '../theme/tokens';
import { GombE, GombM, GombSz, Lap } from './alap';
import { Ikon3d, KeszJel, type Ikon3dNev } from './kepek';
import { AlsoLap, useJelzes } from './keret';
import { alapMagyarazat, MiEz } from './Magyarazat';
import { T } from './T';
import { visszahivasUt } from './Visszahivas';

// ---------- adat ----------
/** A bekötés + az EGY lista: a szerveré, ha küldi (§27), különben ugyanaz a számítás itt (lib/ut.ts). */
export function useUt() {
  const o = useOnboarding();
  const me = useMe();
  const inditas = o.data?.path === 'inditas';
  const reg = useVallalkozas(!!o.data && inditas);
  const ker = useKeresek();
  const keresekDb = (ker.data?.items ?? []).filter((k) => k.direction === 'konyvelotol' && (k.status === 'nyitott' || k.status === 'folyamatban')).length;
  const d = o.data;
  const r = reg.data?.registration ?? null;
  const j: JourneyView | null = d ? (d.journey ?? utEpit({ o: d, reg: r, keresekDb, ma: maiNap() })) : null;
  const pc: PathChangeInfo | null = d ? (d.pathChange ?? utvaltasInfo(d, r, me.data?.client?.lifecycle)) : null;
  return { o, j, pc, reg, keresek: ker };
}

/** Az onboarding-állapotból (gyorsítótár) a szám és a zárt lap mondata – a fülsorhoz és a zárolt laphoz. */
export function utGyorsan(d: OnboardingState | undefined, keresekDb: number): JourneyView | null {
  if (!d) return null;
  return d.journey ?? utEpit({ o: d, keresekDb, ma: maiNap() });
}

/** Az EV-segítség most kérhető-e (a szerver kapcsolója: 409 assist_disabled; a nyilvántartás 2027-től a kamaráé). */
export const evSegitsegElerheto = (ma = maiNap()) => ma <= ASSIST_EV_VALID_UNTIL_DEFAULT;
/** + a szerver kapcsolója (ASSIST_EV_ENABLED=false → Me.access 'helyettunk' zárva); a 409 assist_disabled is ide vezet. */
export function useEvSegitseg(): boolean {
  const me = useMe();
  return evSegitsegElerheto() && funkcio(hozzaferesBol(me.data), 'helyettunk').state !== 'zarva';
}

// ---------- kis elemek ----------
/** Ki lép: kis szürke címke („Te” kék alapon, a többi semleges). */
export function SzereploCimke({ cim, te }: { cim: string; te?: boolean }) {
  return (
    <View style={{ height: 22, paddingHorizontal: 8, borderRadius: forma.cimke, backgroundColor: te ? szin.gombMAlap : szin.nyomott, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <T m={12.5} s={700} lh={1.2} c={te ? szin.tintakekSzoveg : szin.halvany} numberOfLines={1}>
        {cim}
      </T>
    </View>
  );
}

/** Kiemelt kártya (SPEC §27.3.1): fehér lap 2 pt-os márkakék kerettel, kis kapszula-jelvény, 3D ikon 44 pt. */
export function KiemeltKartya({
  jelveny, cim, szoveg, gomb, onPress, ikon = 'igazolas', elsodleges = false, kompakt = false, style, children,
}: { jelveny: string; cim: string; szoveg: string; gomb: string; onPress: () => void; ikon?: Ikon3dNev; elsodleges?: boolean; kompakt?: boolean; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <View style={[{ backgroundColor: szin.lap, borderRadius: forma.lap, borderWidth: 2, borderColor: szin.tintakek, padding: kompakt ? 12 : 16 }, style]}>
      <View style={{ height: 24, paddingHorizontal: 10, borderRadius: forma.gomb, backgroundColor: szin.gombMAlap, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <T m={13} s={700} c={szin.tintakekSzoveg} lh={1.2} numberOfLines={1}>
          {jelveny}
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: kompakt ? 8 : 10 }}>
        <Ikon3d nev={ikon} pt={kompakt ? 36 : 44} />
        <View style={{ flex: 1 }}>
          <T m={kompakt ? 17 : 18} s={700} lh={1.3} ls={-0.01} accessibilityRole="header">
            {cim}
          </T>
          <T m={kompakt ? 14.5 : 15.5} lh={1.45} c={szin.halvany} style={{ marginTop: kompakt ? 2 : 4 }}>
            {szoveg}
          </T>
        </View>
      </View>
      {children}
      {elsodleges ? <GombE cim={gomb} onPress={onPress} style={{ marginTop: kompakt ? 10 : 14 }} magas={52} /> : <GombM cim={gomb} onPress={onPress} style={{ marginTop: kompakt ? 10 : 14 }} />}
    </View>
  );
}

/**
 * A kiemelt kérés rövid változata a „Most ez jön” kártya alatt (SPEC §27.3.1): fehér mini-kártya 2 pt márkakék kerettel,
 * jóváhagyott 3D ikon, alcím és kapszula-gomb – ugyanaz a kiemelés, mint a központban (11-19 javítás: eddig vékony
 * keretes sor volt egy szöveges „★” jellel, gyengébb a fölötte lévő gombnál).
 */
export function KiemeltSor({ cim, szoveg, onPress, ikon = 'kerdezek' }: { cim: string; szoveg?: string; onPress: () => void; ikon?: Ikon3dNev }) {
  // 11-19 javító kör 2: 400 pt alatt a kapszula a szöveg ALÁ kerül (sorban a cím 3, a szöveg 5 sorra tört).
  const keskeny = useWindowDimensions().width < 400;
  const kapszula = (
    <View style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: forma.gomb, backgroundColor: szin.gombMAlap, justifyContent: 'center', alignSelf: keskeny ? 'flex-start' : 'center', marginTop: keskeny ? 10 : 0 }}>
      <T m={14.5} s={700} c={szin.tintakekSzoveg} numberOfLines={1}>
        {ASSIST_TEXTS.cardButton}
      </T>
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={szoveg ? `${cim}. ${szoveg}` : cim}
      onPress={onPress}
      style={({ pressed }) => [{ marginTop: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: forma.lap, borderWidth: 2, borderColor: szin.tintakek, backgroundColor: pressed ? '#F3F5FE' : szin.lap }]}
    >
      <View style={{ flexDirection: 'row', alignItems: keskeny ? 'flex-start' : 'center', gap: 12 }}>
        <Ikon3d nev={ikon} pt={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T m={16} s={700} lh={1.3}>
            {cim}
          </T>
          {szoveg ? (
            <T m={14.5} lh={1.4} c={szin.halvany} style={{ marginTop: 2 }}>
              {szoveg}
            </T>
          ) : null}
          {keskeny ? kapszula : null}
        </View>
        {keskeny ? null : kapszula}
      </View>
    </Pressable>
  );
}

// ---------- „Most ez jön” ----------
export function MostEzJonKartya({ s, fn, utvalt, lab }: { s: JourneyStepView; fn: string; utvalt?: () => void; lab?: ReactNode }) {
  const e = alapMagyarazat(s.explainerKey, fn);
  const utolsoNap = !!s.dueText && /^Ma (van|még)/.test(s.dueText);
  return (
    <Lap style={{ marginTop: 12, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ikon3d nev={(e?.icon ?? 'irat') as Ikon3dNev} pt={36} />
        <T m={13} s={750} ls={0.06} c={szin.halvany} style={{ flex: 1 }}>
          {`${JOURNEY_TEXTS.current} · ${s.n}. lépés`.toLocaleUpperCase('hu-HU')}
        </T>
        <MiEz kulcs={s.explainerKey} />
      </View>
      <T m={21} s={700} lh={1.28} ls={-0.02} style={{ marginTop: 8 }} accessibilityRole="header">
        {s.key === 'meghatalmazas' && s.dueOn ? ASSIST_TEXTS.approveTitle : s.title}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <SzereploCimke cim={s.actorLabel} te={s.actor === 'te'} />
        {s.dueText ? (
          <T m={15} s={650} lh={1.4} c={utolsoNap ? szin.borostyan : szin.tinta} style={{ flexShrink: 1 }}>
            {s.dueText}
          </T>
        ) : null}
        {s.timeText ? (
          <T m={15} lh={1.4} c={szin.halvany} style={{ flexShrink: 1 }}>
            {s.timeText}
          </T>
        ) : null}
      </View>
      {s.statusText && s.statusText !== JOURNEY_TEXTS.rowMost && !s.dueText ? (
        <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 6 }}>
          {s.statusText}
        </T>
      ) : null}
      {s.key === 'ut' ? (
        utvalt ? <GombE cim={s.action?.label ?? 'Válaszolok'} onPress={utvalt} style={{ marginTop: 14 }} /> : null
      ) : s.action ? (
        <GombE cim={s.key === 'meghatalmazas' && s.dueOn ? ASSIST_TEXTS.approveGuideButton : s.action.label} onPress={() => router.push(s.action!.route as never)} style={{ marginTop: 14 }} />
      ) : null}
      {lab}
    </Lap>
  );
}

// ---------- várakozás ----------
export function VarakozasKartya({ w, forras = 'bekotes' }: { w: WaitingCardView; forras?: CallbackSource }) {
  return (
    <Lap style={{ marginTop: 12, padding: 18 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Ikon3d nev="ora" pt={44} />
        <View style={{ flex: 1 }}>
          <T m={13} s={750} ls={0.06} c={szin.halvany}>
            {w.kicker.toLocaleUpperCase('hu-HU')}
          </T>
          <T m={19} s={700} lh={1.3} ls={-0.01} style={{ marginTop: 2 }} accessibilityRole="header">
            {w.title}
          </T>
        </View>
      </View>
      <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 8 }}>
        {w.body}
      </T>
      {w.meanwhile ? (
        <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: szin.hajszal, paddingTop: 12 }}>
          <T m={15.5} s={600} lh={1.4}>
            {fillPlaceholders('Addig: {title}', { title: w.meanwhile.title })}
          </T>
          <GombM cim={w.meanwhile.label} onPress={() => router.push(w.meanwhile!.route as never)} style={{ marginTop: 8 }} />
        </View>
      ) : null}
      {w.escalateText ? (
        <Pressable accessibilityRole="link" onPress={() => router.push(w.escalateKind === 'uzenet' ? '/uzenetek' : visszahivasUt(forras, 'bekotes'))} style={{ marginTop: 12, paddingVertical: 4 }}>
          <T m={14.5} lh={1.45} c={szin.halvany}>
            {w.escalateText}{' '}
            <T m={14.5} s={600} c={szin.tintakekSzoveg} alahuz>
              {w.escalateKind === 'uzenet' ? 'Írok nektek' : 'Kérek visszahívást'}
            </T>
          </T>
        </Pressable>
      ) : null}
    </Lap>
  );
}

/** Ha közben az ügyfél is jön: vékony csík a „Most ez jön” fölött. */
export function VarakozasCsik({ w, ido: ido0 }: { w: WaitingCardView; ido?: string | null }) {
  const ido = ido0 ?? w.timeText ?? null;
  return (
    <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: szin.lap, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }} accessibilityLabel={`Közben: ${w.title}${ido ? `, ${ido}` : ''}`}>
      <Ikon3d nev="ora" pt={28} />
      <T m={14.5} lh={1.4} style={{ flex: 1 }}>
        <T m={14.5} s={650}>
          Közben:{' '}
        </T>
        {w.title}
        {ido ? ` · ${ido}` : ''}
      </T>
    </View>
  );
}

// ---------- „Így halad a bekötésed” ----------
function SorJel({ s }: { s: JourneyStepView }) {
  if (s.state === 'kesz') return <KeszJel pt={30} label={`${s.n}. lépés, kész`} />;
  const most = s.state === 'most';
  return (
    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: most ? szin.tintakek : szin.lap, borderWidth: most ? 0 : 1.5, borderColor: s.state === 'kesobb' ? szin.keret : szin.mezoKeret, alignItems: 'center', justifyContent: 'center' }}>
      <T m={14} s={750} lh={1} c={most ? '#fff' : s.state === 'kesobb' ? szin.halvany : szin.tinta} szam>
        {s.n}
      </T>
    </View>
  );
}

function UtSor({ s, elso, fn, utvalt, zartLap }: { s: JourneyStepView; elso: boolean; fn: string; utvalt: () => void; zartLap: (s: JourneyStepView) => void }) {
  const kesobb = s.state === 'kesobb';
  const megnyit = () => {
    if (s.key === 'ut') return utvalt();
    if (kesobb) return zartLap(s);
    const ut = s.action?.route ?? null;
    if (ut) router.push(ut as never);
  };
  const lenyomhato = s.key === 'ut' || kesobb || !!s.action;
  return (
    <Pressable
      accessibilityRole={lenyomhato ? 'button' : undefined}
      accessibilityLabel={`${s.n}. ${s.title}. ${s.actorLabel}. ${s.statusText}${s.timeText ? `. ${s.timeText}` : ''}`}
      disabled={!lenyomhato}
      onPress={megnyit}
      style={({ pressed }) => [{ flexDirection: 'row', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 12, minHeight: 64 }, pressed && lenyomhato ? { backgroundColor: '#F6F8FB' } : null, s.state === 'most' ? { backgroundColor: '#F3F5FE' } : null]}
    >
      {!elso ? <View style={{ position: 'absolute', top: 0, left: 56, right: 0, height: 1, backgroundColor: szin.hajszal }} /> : null}
      <View style={{ paddingTop: 1 }}>
        <SorJel s={s} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <T m={16.5} s={s.state === 'most' ? 700 : 600} lh={1.35} c={kesobb ? szin.halvany : szin.tinta} style={{ flexShrink: 1 }}>
            {s.title}
          </T>
          <SzereploCimke cim={s.actorLabel} te={s.actor === 'te'} />
        </View>
        {s.key === 'ut' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 10, marginTop: 2 }}>
            <T m={14.5} lh={1.4} c={szin.halvany}>
              {s.statusText}
            </T>
            <T m={14.5} s={650} c={szin.tintakekSzoveg} alahuz>
              {JOURNEY_TEXTS.pathChange}
            </T>
          </View>
        ) : (
          <>
            <T m={14.5} s={s.state === 'most' || !!s.dueText ? 650 : 400} lh={1.4} c={s.state === 'most' ? szin.tinta : szin.halvany} style={{ marginTop: 2 }}>
              {[s.statusText, s.dueText && !s.statusText.includes(s.dueText) ? s.dueText : null, s.timeText && s.state !== 'kesz' ? s.timeText : null].filter(Boolean).join(' · ')}
            </T>
            {/* 11-19 javító kör 2: egy várakozó, de a te dolgod sor (pl. a bejelentés, amíg a tevékenység-sort írjuk) is
                odavisz az útmutatóhoz – ezt látni is kell, nem csak koppintásra derül ki. */}
            {s.state === 'var' && s.action ? (
              <T m={14.5} s={650} c={szin.tintakekSzoveg} alahuz style={{ marginTop: 2 }}>
                {s.action.label}
              </T>
            ) : null}
          </>
        )}
      </View>
      {s.key !== 'ut' ? <MiEz kulcs={s.explainerKey} style={{ alignSelf: 'flex-start', marginTop: 2 }} /> : null}
    </Pressable>
  );
}

/** k7c2: `szamNelkul` – while the guided run shows its own "{done} / {total}", the list names no second count. */
export function UtLista({ j, fn, utvalt, szamNelkul }: { j: JourneyView; fn: string; utvalt: () => void; szamNelkul?: boolean }) {
  const [mutatKesz, setMutatKesz] = useState(false);
  const [zart, setZart] = useState<JourneyStepView | null>(null);
  // Az 1. sor (Vállalkozásod) mindig látszik – a „Módosítom” innen 2 koppintás (S4).
  const kesz = j.steps.filter((s) => s.state === 'kesz' && s.key !== 'ut');
  const lathato = j.steps.filter((s) => s.key === 'ut' || s.state !== 'kesz' || mutatKesz);
  return (
    <>
      <View style={{ paddingTop: 30, paddingBottom: 10, paddingHorizontal: 4 }}>
        <T m={19.5} s={600} lh={1.25} ls={-0.016} accessibilityRole="header">
          {JOURNEY_TEXTS.listTitle}
        </T>
        <T m={14.5} lh={1.4} c={szin.halvanyAlapon} style={{ marginTop: 5 }}>
          {JOURNEY_TEXTS.listSub}
        </T>
      </View>
      <Lap>
        {kesz.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: mutatKesz }}
            onPress={() => setMutatKesz((x) => !x)}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: szin.hajszal }, pressed && { backgroundColor: '#F6F8FB' }]}
          >
            <KeszJel pt={26} label="kész" />
            <T m={15.5} s={600} style={{ flex: 1 }}>
              {szamNelkul ? 'A kész lépések' : fillPlaceholders(JOURNEY_TEXTS.doneCollapsed, { n: String(kesz.length) })}
            </T>
            <T m={15} s={600} c={szin.tintakekSzoveg} alahuz>
              {mutatKesz ? JOURNEY_TEXTS.hideDone : JOURNEY_TEXTS.showAll}
            </T>
          </Pressable>
        ) : null}
        {lathato.map((s, i) => (
          <UtSor key={s.key} s={s} elso={i === 0} fn={fn} utvalt={utvalt} zartLap={setZart} />
        ))}
      </Lap>
      <AlsoLap lathato={!!zart} bezar={() => setZart(null)}>
        {zart ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 84 }}>
              <Ikon3d nev="lakat" pt={44} label="Később" />
              <T m={21} s={700} lh={1.25} style={{ flex: 1 }} accessibilityRole="header">
                {zart.title}
              </T>
            </View>
            <T m={17} lh={1.5} style={{ marginTop: 12 }}>
              {zart.lockedReason ?? zart.statusText}
            </T>
            {zart.key === 'ertesites' ? (
              <GombM
                cim="Már beküldtem, feltöltöm"
                style={{ marginTop: 14 }}
                onPress={() => {
                  setZart(null);
                  router.push('/bekotes/vallalkozas/feltoltes');
                }}
              />
            ) : null}
            <MiEz kulcs={zart.explainerKey} cim="Mi ez a lépés?" style={{ alignSelf: 'flex-start', marginTop: 12 }} />
          </View>
        ) : null}
      </AlsoLap>
    </>
  );
}

// ---------- az „Intézzük helyetted” kérés állapota ----------
/** Egysoros állapot (Főoldal sávja alatt) vagy kártya (központ, meghatalmazás). */
export function SegitsegAllapot({ a, fn, kompakt, style, cb }: { a: AssistView; fn: string; kompakt?: boolean; style?: StyleProp<ViewStyle>; cb?: CallbackView | null }) {
  const cim = a.kind === 'meghatalmazas' ? 'Megcsináljuk helyetted a meghatalmazást' : 'Intézzük helyetted a bejelentést';
  // 11-19 javító kör 2: amíg a hívásra várunk, és a kolléga már próbálta („Nem vette fel”, „Foglalt”, rossz szám), a
  // képernyőn is ez álljon (a szerver mondata: „ma 16:34 kerestünk, de nem értünk el…”), ne a „24–48 órán belül hív”.
  const hivas =
    a.status === 'visszahivas_kerve' && cb && (cb.status === 'uj' || cb.status === 'folyamatban') && (!cb.assistId || cb.assistId === a.id) && (cb.callingNow || cb.needsNewPhone || cb.failedAttempts > 0 || (!!cb.lastAttempt && cb.lastAttempt.outcome !== 'beszeltunk'))
      ? cb
      : null;
  const mondat = hivas ? hivas.statusText : segitsegSzoveg(a, fn);
  const nyit = () => router.push(a.kind === 'meghatalmazas' ? '/bekotes/meghatalmazas' : '/bekotes/vallalkozas');
  const szamra = () => router.push({ pathname: '/visszahivas', params: { forras: 'bekotes', tema: hivas?.topic ?? 'egyeb' } });
  if (kompakt) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${cim}: ${mondat}`} onPress={hivas?.needsNewPhone ? szamra : nyit} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: szin.lap, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: hivas?.needsNewPhone ? 2 : 1.5, borderColor: hivas?.needsNewPhone ? szin.borostyan : szin.tintakek }, style]}>
        <Ikon3d nev={hivas ? 'ora' : 'igazolas'} pt={28} />
        <T m={14.5} lh={1.35} style={{ flex: 1 }}>
          {mondat}
        </T>
        <T m={14} s={600} c={szin.tintakekSzoveg} alahuz>
          {hivas?.needsNewPhone ? 'Javítom' : 'Részletek'}
        </T>
      </Pressable>
    );
  }
  return (
    <View style={[{ backgroundColor: szin.lap, borderRadius: forma.lap, borderWidth: 2, borderColor: szin.tintakek, padding: 16 }, style]}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Ikon3d nev="igazolas" pt={44} />
        <View style={{ flex: 1 }}>
          <T m={13} s={750} ls={0.06} c={szin.halvany}>
            {cim.toLocaleUpperCase('hu-HU')}
          </T>
          <T m={17} s={650} lh={1.45} style={{ marginTop: 2 }} accessibilityLiveRegion="polite">
            {mondat}
          </T>
        </View>
      </View>
      {hivas ? <GombM cim={hivas.needsNewPhone ? 'Megadom a jó számot' : 'Másik számot adok meg'} onPress={szamra} style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

// ---------- válasz módosítása (S5) + „Hogyan jelentsük be?” (S3) ----------
type Ctx = { modosit: () => void; valaszol: (b: BusinessStatus) => Promise<void>; modValaszto: () => void };
const UtCtx = createContext<Ctx>({ modosit: () => undefined, valaszol: async () => undefined, modValaszto: () => undefined });
export const useUtvaltas = () => useContext(UtCtx);

function ModValasztoTartalom({ bezar }: { bezar: () => void }) {
  const o = useOnboarding();
  const fn = o.data?.accountant.firstName ?? 'a könyvelőd';
  const evNyitva = useEvSegitseg();
  const adatokKesz = o.data?.steps.find((s) => s.step === 'adatok')?.status === 'kesz';
  const ablak = useWindowDimensions();
  const rovid = ablak.height < 760;
  return (
    <View>
      <T m={rovid ? 20 : 22} s={700} lh={1.25} ls={-0.015} style={{ paddingRight: 84 }} accessibilityRole="header">
        {START_MODE_TEXTS.title}
      </T>
      {rovid ? null : (
        <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 6 }}>
          {START_MODE_TEXTS.sub}
        </T>
      )}
      <View style={{ marginTop: rovid ? 10 : 14, borderRadius: forma.lap, borderWidth: 1, borderColor: szin.keret, padding: rovid ? 12 : 16 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: rovid ? 'center' : 'flex-start' }}>
          <Ikon3d nev="bevallas" pt={rovid ? 32 : 44} />
          <View style={{ flex: 1 }}>
            <T m={rovid ? 17 : 18} s={700} lh={1.3}>
              {START_MODE_TEXTS.onalloTitle}
            </T>
            <T m={rovid ? 14.5 : 15.5} lh={1.45} c={szin.halvany} style={{ marginTop: rovid ? 2 : 4 }}>
              {rovid ? 'Megmutatjuk, mit hova jelölj.' : START_MODE_TEXTS.onalloBody}
            </T>
          </View>
        </View>
        <GombM
          cim={START_MODE_TEXTS.onalloButton}
          style={{ marginTop: rovid ? 8 : 12 }}
          onPress={() => {
            bezar();
            router.push(adatokKesz ? '/bekotes/vallalkozas' : { pathname: '/bekotes/adatok', params: { utana: 'vallalkozas' } });
          }}
        />
      </View>
      {evNyitva ? (
        <KiemeltKartya
          style={{ marginTop: rovid ? 10 : 12 }}
          kompakt={rovid}
          jelveny={START_MODE_TEXTS.segitettBadge}
          cim={START_MODE_TEXTS.segitettTitle}
          szoveg={rovid ? fillPlaceholders('Felhívunk, és {firstName} bejelenti helyetted. Neked: pár adat és két jóváhagyás.', { firstName: fn }) : fillPlaceholders(START_MODE_TEXTS.segitettBody, { firstName: fn })}
          gomb={START_MODE_TEXTS.segitettButton}
          onPress={() => {
            bezar();
            router.push(helyettunkUt('vallalkozas_bejelentes', 'helyettunk_vallalkozas'));
          }}
        />
      ) : (
        <View style={{ marginTop: 12, borderRadius: forma.lap, backgroundColor: szin.nyomott, padding: 16 }}>
          <T m={15.5} lh={1.5}>
            {ASSIST_TEXTS.disabled}
          </T>
          <GombM cim="Kérem a visszahívást" style={{ marginTop: 10 }} onPress={() => { bezar(); router.push(visszahivasUt('bekotes', 'vallalkozas_inditas')); }} />
        </View>
      )}
    </View>
  );
}

function ValtasTartalom({ bezar, valaszol, zart, setZart }: { bezar: () => void; valaszol: (b: BusinessStatus) => Promise<void>; zart: string | null; setZart: (s: string | null) => void }) {
  const ut = useUt();
  const pc = ut.pc;
  const [tolt, setTolt] = useState(false);
  if (!pc) return null;
  const blokkolt = zart ?? (pc.canChange ? null : (pc.blockerText ?? 'Ezt itt már nem tudod módosítani.'));
  const cel: BusinessStatus = pc.current === 'van' ? 'inditas' : 'van';
  return (
    <View>
      <T m={22} s={700} lh={1.25} ls={-0.015} style={{ paddingRight: 84 }} accessibilityRole="header">
        {PATH_CHANGE_TEXTS.sheetTitle}
      </T>
      {blokkolt ? (
        // a megerősítő szöveg maga mondja, mi áll most itt; a zárolt esetben ezt külön mutatjuk
        <View style={{ marginTop: 10, borderRadius: forma.mezo, backgroundColor: szin.nyomott, paddingVertical: 10, paddingHorizontal: 12 }}>
          <T m={14} c={szin.halvany}>
            Most ez áll itt
          </T>
          <T m={16.5} s={650} lh={1.4}>
            {pc.current === 'van' ? JOURNEY_TEXTS.pathVan : pc.mode === 'segitett' ? JOURNEY_TEXTS.pathInditasSegitett : JOURNEY_TEXTS.pathInditas}
          </T>
        </View>
      ) : null}
      {blokkolt ? (
        <>
          <T m={17} lh={1.5} style={{ marginTop: 12 }}>
            {fillPlaceholders(PATH_CHANGE_TEXTS.blocked, { reason: blokkolt })}
          </T>
          <GombE
            cim={PATH_CHANGE_TEXTS.blockedButton}
            style={{ marginTop: 16 }}
            onPress={() => {
              bezar();
              router.push(visszahivasUt('utvaltas', 'bekotes'));
            }}
          />
        </>
      ) : (
        <>
          <T m={17} lh={1.5} style={{ marginTop: 12 }}>
            {pc.confirmText}
          </T>
          <GombE
            cim={cel === 'van' ? PATH_CHANGE_TEXTS.toVanButton : PATH_CHANGE_TEXTS.toInditasButton}
            tolt={tolt}
            style={{ marginTop: 16 }}
            onPress={async () => {
              setTolt(true);
              try {
                await valaszol(cel);
              } catch (e) {
                if (e instanceof ApiHiba && e.status === 409) setZart(e.message);
              } finally {
                setTolt(false);
              }
            }}
          />
        </>
      )}
      <GombSz cim={PATH_CHANGE_TEXTS.cancel} onPress={bezar} style={{ alignSelf: 'center', marginTop: 6 }} />
    </View>
  );
}

export function UtvaltasProvider({ children }: { children: ReactNode }) {
  const [lap, setLap] = useState<'valtas' | 'mod' | null>(null);
  const [volt, setVolt] = useState(false);
  const [zart, setZart] = useState<string | null>(null);
  const qc = useQueryClient();
  const mutacio = useUzletiAllapot();
  const jelez = useJelzes();
  const modosit = useCallback(() => {
    setZart(null);
    setVolt(true);
    setLap('valtas');
  }, []);
  const modValaszto = useCallback(() => {
    setVolt(true);
    setLap('mod');
  }, []);
  /** A válasz beállítása; a „Visszavonom” 5 mp-ig ugyanezzel a végponttal áll vissza (SPEC §27.2.2). */
  const valaszol = useCallback(
    async (b: BusinessStatus) => {
      const elozo = qc.getQueryData<OnboardingState>(K.onboarding)?.path ?? null;
      try {
        const uj = await mutacio.mutateAsync(b === 'inditas' ? { businessStatus: b, mode: 'onallo' } : { businessStatus: b });
        if (uj && Array.isArray(uj.steps)) qc.setQueryData(K.onboarding, uj);
      } catch (e) {
        if (e instanceof ApiHiba && e.status === 409) {
          // A szerver nem engedi (pl. már elment a bejelentés): a lap a visszahívást kínálja.
          setZart(e.code === PATH_CHANGE_ERROR_CODE ? e.message : e.message || 'Ezt itt már nem tudod módosítani.');
          setVolt(true);
          setLap('valtas');
          throw e;
        }
        jelez(hibaUzenet(e, 'Nem sikerült menteni. Próbáld újra.'));
        throw e;
      }
      if (b === 'inditas') setVolt(true);
      setLap(b === 'inditas' ? 'mod' : null);
      if (elozo && elozo !== b) {
        router.navigate('/bekotes');
        jelez({
          szoveg: b === 'van' ? PATH_CHANGE_TEXTS.toastVan : PATH_CHANGE_TEXTS.toastInditas,
          kesz: true,
          gomb: {
            cim: PATH_CHANGE_TEXTS.undo,
            onPress: () => {
              setLap(null);
              void mutacio
                .mutateAsync(elozo === 'inditas' ? { businessStatus: elozo, mode: 'onallo', undo: true } : { businessStatus: elozo, undo: true })
                .then((r) => {
                  if (r && Array.isArray(r.steps)) qc.setQueryData(K.onboarding, r);
                  jelez({ szoveg: elozo === 'van' ? PATH_CHANGE_TEXTS.undoneVan : PATH_CHANGE_TEXTS.undoneInditas, kesz: true });
                })
                .catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült visszaállítani. Próbáld a „Módosítom” gombbal.')));
            },
          },
        });
      }
    },
    [qc, mutacio, jelez],
  );
  const ertek = useMemo(() => ({ modosit, valaszol, modValaszto }), [modosit, valaszol, modValaszto]);
  return (
    <UtCtx.Provider value={ertek}>
      {children}
      {volt ? (
        <AlsoLap lathato={lap !== null} bezar={() => setLap(null)}>
          {lap === 'mod' ? <ModValasztoTartalom bezar={() => setLap(null)} /> : <ValtasTartalom bezar={() => setLap(null)} valaszol={valaszol} zart={zart} setZart={setZart} />}
        </AlsoLap>
      ) : null}
    </UtCtx.Provider>
  );
}

/** A kérés legutóbbi állapota egy fajtához (a lemondott is, hogy lássa, mi történt). */
export { utolsoSegitseg };
export type { AssistKind };
