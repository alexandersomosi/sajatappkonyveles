// Visszahívás kérése (SPEC §26.2.2): időpontválasztás helyett. Telefonszám (a profilból maszkolva), téma, megjegyzés,
// mikor hívhatunk; az ígéret és a csalás elleni figyelmeztetés a gomb fölött. Ha már van nyitott kérés, annak állapota
// látszik „Módosítom” és „Mégsem kérem” gombbal. Bárhonnan nyílik: ?forras=<hely>&tema=<téma>.
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { CallbackView, OnboardingState } from '@/_shared/api';
import { normalizeHuPhone, ASSIST_TEXTS } from '@/_shared/bekotes';
import {
  CALLBACK_ASSIST_TOPIC, CALLBACK_SOURCES, CALLBACK_TOPIC_LABELS, CALLBACK_TOPICS, CALLBACK_RULES,
  type CallbackSource, type CallbackTopic, type CallbackWindow,
} from '@/_shared/enums';
import { useQueryClient } from '@tanstack/react-query';
import { K } from '@/api/hooks';
import { helyettunkUt, temaSorbol } from '@/lib/ut';
import { utGyorsan } from '@/ui/Ut';
import { ApiHiba } from '@/api/http';
import { useMe, useVisszahivasKer, useVisszahivasLemond, useVisszahivasModosit, useVisszahivasok } from '@/api/hooks';
import { hibaUzenet } from '@/lib/hiba';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombSz, HibaSzoveg, Lap, Pipa, Szakasz, Valaszto } from '@/ui/alap';
import { Ikon3d } from '@/ui/kepek';
import { AlsoLap, Betolt, CimSor, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { alapIgeret, Igeret, VisszahivasAllapot } from '@/ui/Visszahivas';

const TELEFON_HIBA = 'Magyar telefonszámot adj meg, például +36 30 123 4567.';

function aktivFul(forras: string): string {
  if (forras === 'uzenetek') return 'uzenetek';
  if (forras === 'fiok' || forras === 'gyik') return 'fiok';
  return 'fooldal';
}

export default function Visszahivas() {
  const p = useLocalSearchParams<{ forras?: string; tema?: string; mod?: string }>();
  const forras: CallbackSource = (CALLBACK_SOURCES as readonly string[]).includes(p.forras ?? '') ? (p.forras as CallbackSource) : 'bekotes';
  const me = useMe();
  const qc = useQueryClient();
  // S21: bekötés alatt a téma a „Most ez jön” sorból jön, ha a hívó nem adott konkrétat (SPEC §27.4.4).
  const bekotesAlatt = me.data?.client?.lifecycle === 'bekotes_alatt';
  const most = bekotesAlatt ? utGyorsan(qc.getQueryData<OnboardingState>(K.onboarding), 0)?.currentKey : null;
  const megadott = (CALLBACK_TOPICS as readonly string[]).includes(p.tema ?? '') ? (p.tema as CallbackTopic) : null;
  const alapTema: CallbackTopic = megadott && megadott !== 'egyeb' && megadott !== 'bekotes' ? megadott : bekotesAlatt ? temaSorbol(most) : (megadott ?? 'egyeb');
  const q = useVisszahivasok();
  const ker = useVisszahivasKer();
  const modosit = useVisszahivasModosit();
  const lemond = useVisszahivasLemond();
  const jelez = useJelzes();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const igeret = q.data?.promise ?? alapIgeret(fn);
  const nyitott: CallbackView | null = q.data?.open ?? null;
  const [szerkeszt, setSzerkeszt] = useState(p.mod === 'modosit');
  const [masikSzam, setMasikSzam] = useState(false);
  const [telefon, setTelefon] = useState('');
  const [mentsd, setMentsd] = useState(false);
  const [tema, setTema] = useState<CallbackTopic>(alapTema);
  const [megj, setMegj] = useState('');
  const [sav, setSav] = useState<CallbackWindow>('barmikor');
  const [h, setH] = useState<{ telefon?: string | null; megj?: string | null }>({});
  const [hiba, setHiba] = useState<string | null>(null);
  const [lemondLap, setLemondLap] = useState(false);

  // A téma alapértéke a /me után derül ki (bekötés alatt?): amíg nem választott, kövesse.
  const kezzel = useRef(false);
  useEffect(() => {
    if (!kezzel.current && !szerkeszt) setTema(alapTema);
  }, [alapTema, szerkeszt]);
  // Módosításkor a nyitott kérés adataival töltjük ki az űrlapot.
  useEffect(() => {
    if (szerkeszt && nyitott) {
      setTema(nyitott.topic);
      setMegj(nyitott.note ?? '');
      setSav(nyitott.window);
      if (nyitott.needsNewPhone) setMasikSzam(true);
    }
  }, [szerkeszt, nyitott]);

  const vanProfilSzam = !!q.data?.phoneOnFileMasked;
  const ujSzam = masikSzam || !vanProfilSzam || (szerkeszt && !!nyitott?.needsNewPhone);
  // A két „Intézzétek helyettem” téma csak a bekötés alatt; ha a szerver listája még nem ismeri, hozzátesszük.
  const temak = useMemo(() => {
    const l = igeret.topics.filter((t) => bekotesAlatt || !CALLBACK_ASSIST_TOPIC[t.topic]);
    if (bekotesAlatt) for (const t of CALLBACK_TOPICS) if (CALLBACK_ASSIST_TOPIC[t] && !l.some((x) => x.topic === t)) l.push({ topic: t, label: CALLBACK_TOPIC_LABELS[t] });
    return l;
  }, [igeret.topics, bekotesAlatt]);

  async function kuld() {
    const e: typeof h = {};
    let norm: string | null = null;
    if (ujSzam) {
      norm = normalizeHuPhone(telefon);
      e.telefon = norm ? null : TELEFON_HIBA;
    }
    e.megj = megj.length > CALLBACK_RULES.noteMaxChars ? `Legfeljebb ${CALLBACK_RULES.noteMaxChars} karakter lehet.` : null;
    setH(e);
    if (e.telefon || e.megj) return;
    setHiba(null);
    try {
      if (szerkeszt && nyitott) {
        await modosit.mutateAsync({ id: nyitott.id, ...(norm ? { phone: norm } : {}), topic: tema, window: sav, note: megj.trim() || null });
        jelez({ szoveg: 'Elmentettük a változást.', kesz: true });
        setSzerkeszt(false);
        return;
      }
      await ker.mutateAsync({ ...(norm ? { phone: norm, savePhoneToProfile: mentsd } : {}), topic: tema, window: sav, note: megj.trim() || undefined, source: forras });
      jelez({ szoveg: 'Megkaptuk. Kollégánk 24–48 órán belül hív.', kesz: true });
      vissza('/');
    } catch (err) {
      if (err instanceof ApiHiba && err.code === 'callback_already_open') {
        void q.refetch();
        jelez('Már van egy nyitott kérésed. Itt látod.');
        return;
      }
      if (err instanceof ApiHiba && err.fields?.phone) setH((x) => ({ ...x, telefon: err.fields?.phone ?? TELEFON_HIBA }));
      if (err instanceof ApiHiba && err.fields?.note) setH((x) => ({ ...x, megj: err.fields?.note ?? ASSIST_TEXTS.noteRefused }));
      setHiba(hibaUzenet(err, 'Nem sikerült elküldeni. Próbáld újra.', { jelolt: ['phone'] }));
    }
  }

  const fejlec = (
    <CimSor
      visszaCim="Vissza"
      vissza={() => (szerkeszt && nyitott ? setSzerkeszt(false) : vissza('/'))}
      cim={nyitott && !szerkeszt ? 'Visszahívás' : szerkeszt ? 'Módosítod a kérést' : 'Kérj visszahívást'}
      al={nyitott && !szerkeszt ? undefined : 'Ha elakadtál, felhívunk, és megbeszéljük.'}
    />
  );

  if (q.isLoading) return <Kepernyo ful={aktivFul(forras)} fejlec={fejlec}><Betolt /></Kepernyo>;
  if (q.error && !(q.error instanceof ApiHiba && q.error.status === 404))
    return <Kepernyo ful={aktivFul(forras)} fejlec={fejlec}><Hiba hiba={q.error} ujra={() => void q.refetch()} /></Kepernyo>;

  if (nyitott && !szerkeszt) {
    return (
      <Kepernyo ful={aktivFul(forras)} fejlec={fejlec}>
        <VisszahivasAllapot cb={nyitott} forras={forras} gomb={false} style={{ marginTop: 4 }} />
        <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
          {nyitott.canEdit ? <GombSz cim={nyitott.needsNewPhone ? 'Megadom a jó számot' : 'Módosítom'} onPress={() => setSzerkeszt(true)} /> : null}
          {nyitott.canCancel ? <GombSz cim="Mégsem kérem" veszely onPress={() => setLemondLap(true)} /> : null}
        </View>
        <View style={{ marginTop: 10 }}>
          <Igeret p={igeret} />
        </View>
        <AlsoLap lathato={lemondLap} bezar={() => setLemondLap(false)}>
          <T m={21} s={700} lh={1.3} style={{ paddingRight: 80 }}>
            Mégsem kéred a visszahívást?
          </T>
          <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 6, marginBottom: 16 }}>
            Ha később mégis kell, bármikor kérhetsz újat. Írni is tudsz nekünk az Üzenetekben.
          </T>
          <GombE
            cim="Igen, lemondom"
            tolt={lemond.isPending}
            onPress={async () => {
              try {
                await lemond.mutateAsync(nyitott.id);
                setLemondLap(false);
                jelez({ szoveg: 'Lemondtad a visszahívást.', kesz: true });
              } catch (e) {
                jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
              }
            }}
          />
          <GombSz cim="Mégis kérem" onPress={() => setLemondLap(false)} style={{ alignSelf: 'center', marginTop: 6 }} />
        </AlsoLap>
      </Kepernyo>
    );
  }

  const recent = (q.data?.recent ?? []).slice(0, 3);
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Kepernyo ful={aktivFul(forras)} fejlec={fejlec}>
        <Lap style={{ padding: 18, gap: 18 }}>
          <View>
            <T m={15} s={600} style={{ marginBottom: 7 }}>
              Telefonszám
            </T>
            {!ujSzam ? (
              <View style={{ borderRadius: forma.mezo, borderWidth: 1, borderColor: szin.keret, backgroundColor: szin.mezoAlap, padding: 14 }}>
                <T m={17} s={650} szam nyers>
                  {q.data?.phoneOnFileMasked}
                </T>
                <T m={15} c={szin.halvany} lh={1.4} style={{ marginTop: 2 }}>
                  Ezen hívjunk?
                </T>
                <GombSz cim="Másik számot adok meg" onPress={() => setMasikSzam(true)} style={{ paddingBottom: 0 }} />
              </View>
            ) : (
              <>
                <Mezo
                  felirat={szerkeszt && nyitott?.needsNewPhone ? 'A jó telefonszámod' : 'Ezen a számon hívjunk'}
                  value={telefon}
                  onChangeText={(t) => {
                    setTelefon(t);
                    if (h.telefon) setH((x) => ({ ...x, telefon: null }));
                  }}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholder="+36 30 123 4567"
                  hiba={h.telefon}
                />
                {!szerkeszt ? (
                  <Pipa be={mentsd} valt={setMentsd} style={{ marginTop: 6 }}>
                    Mentsd el a profilomba is
                  </Pipa>
                ) : null}
                {vanProfilSzam && masikSzam && !(szerkeszt && nyitott?.needsNewPhone) ? <GombSz cim={`Mégis ezen: ${q.data?.phoneOnFileMasked}`} onPress={() => setMasikSzam(false)} /> : null}
              </>
            )}
          </View>

          <View>
            <T m={15} s={600} style={{ marginBottom: 8 }}>
              Miben segítsünk?
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
              {temak.map((t) => {
                const on = t.topic === tema;
                return (
                  <Pressable
                    key={t.topic}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on, selected: on }}
                    aria-checked={on}
                    onPress={() => {
                      // „Intézzétek helyettem”: az űrlap a megerősítő lappá válik (SPEC §27.3.1).
                      const fajta = CALLBACK_ASSIST_TOPIC[t.topic];
                      if (fajta && !szerkeszt) return router.replace(helyettunkUt(fajta, fajta === 'meghatalmazas' ? 'helyettunk_meghatalmazas' : 'helyettunk_vallalkozas'));
                      kezzel.current = true;
                      setTema(t.topic);
                    }}
                    style={{ minHeight: 44, maxWidth: '100%', paddingHorizontal: 14, paddingVertical: 8, borderRadius: forma.mezo, borderWidth: on ? 2 : 1, borderColor: on ? szin.tintakek : szin.keret, backgroundColor: on ? '#fff' : szin.mezoAlap, justifyContent: 'center' }}
                  >
                    <T m={15.5} s={on ? 650 : 500} lh={1.3} style={{ flexShrink: 1 }}>
                      {t.label}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Mezo
            felirat="Megjegyzés (nem kötelező)"
            value={megj}
            onChangeText={(t) => {
              setMegj(t.slice(0, CALLBACK_RULES.noteMaxChars));
              if (h.megj) setH((x) => ({ ...x, megj: null }));
            }}
            placeholder="Írd le röviden, hol akadtál el."
            multiline
            maxLength={CALLBACK_RULES.noteMaxChars}
            hiba={h.megj}
            sugo={`${ASSIST_TEXTS.noteHint} ${megj.length}/${CALLBACK_RULES.noteMaxChars}`}
          />

          <View>
            <T m={15} s={600} style={{ marginBottom: 8 }}>
              Mikor hívhatunk?
            </T>
            <Valaszto elemek={igeret.windows.map((w) => ({ kulcs: w.window, cim: w.label }))} ertek={sav} valt={setSav} />
          </View>
        </Lap>

        <View style={{ marginTop: 12 }}>
          <Igeret p={igeret} />
        </View>
        <HibaSzoveg szoveg={hiba} />
        <GombE cim={szerkeszt ? 'Mentem a változást' : 'Kérem a visszahívást'} onPress={() => void kuld()} tolt={ker.isPending || modosit.isPending} style={{ marginTop: 16 }} />

        {!szerkeszt && recent.length ? (
          <>
            <Szakasz cim="Korábbi kéréseid" />
            {recent.map((r, i) => (
              <VisszahivasAllapot key={r.id} cb={r} forras={forras} gomb={false} style={{ marginTop: i ? 10 : 0 }} />
            ))}
          </>
        ) : null}
      </Kepernyo>
    </KeyboardAvoidingView>
  );
}
