// Áttekintés: client data, 2026 tax profile editor, meters, subscription summary, internal notes (FUNKCIOK 21, 22).
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { K28Kartyak } from './K28Kartyak';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import type { TaxProfile } from '../../../api/types';
import { Ft, HibaSav, Mero, Toltes, Lenyilo } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { usePirito } from '../../../ui/Pirito';
import { ApiError } from '../../../api/client';
import { isValidOvtjKod } from '../../../_shared/bekotes';
import { MODE_LABEL, SUB_LABEL, TAX_STATUS_LABEL } from '../../../lib/labels';
import { datum, telefonFormaz, datumRovid, ft, idopont, parseFt } from '../../../lib/format';
import { today, currentYear } from '../../../lib/today';
import type { CostRatio, TaxStatus } from '../../../_shared/enums';

export default function Attekintes({ c }: FulProps) {
  return (
    <div className="racs fo-mellek">
      <div>
        <Adatok c={c} />
        <AdoProfil c={c} />
      </div>
      <div>
        {c.meters && (
          <div className="lap">
            <div className="lap-fej">
              <h2>Idei keretei</h2>
            </div>
            <Mero m={c.meters.afa} cim={c.meters.afa.sentence} mellek="Alanyi ÁFA-mentesség, teljesítési dátum szerint. A csíkozott rész az év végéig várható." />
            {c.meters.atalanyCap.ratio >= 0.5 && <Mero m={c.meters.atalanyCap} />}
            {c.taxRegime !== 'kata' && (
            <div className="mero">
              <div className="sor-flex" style={{ alignItems: 'flex-start' }}>
                {c.meters.adomentes.reached && <I3 n="befizetve_jel" s={24} />}
                <div>
                  <div className="mondat">{c.meters.adomentes.sentence}</div>
                  <div className="mellek">Adómentes rész: évi {ft(c.meters.adomentes.limitHuf)} jövedelem (az éves minimálbér fele).</div>
                </div>
              </div>
            </div>
            )}
          </div>
        )}
        <K28Kartyak c={c} />
        <Elofizetes c={c} />
        <Jegyzetek c={c} />
      </div>
    </div>
  );
}

function Adatok({ c }: FulProps) {
  // The full adóazonosító jel is fetched only on "Mutasd" (one audited call), and forgotten on "Elrejt".
  const [mutat, setMutat] = useState<string | null>(null);
  const pir = usePirito();
  const felfed = useMutation({ mutationFn: () => ep.accRevealTaxId(c.id), onSuccess: (r) => setMutat(r.adoazonositoJel), onError: pir.hiba });
  return (
    <div className="lap">
      <div className="lap-fej">
        <h2>Adatai</h2>
        <span className="megj">Az ügyfél adta meg a kérdőívben. Ha valami változik, ő kéri a kérések közt.</span>
      </div>
      <div className="belso" style={{ paddingTop: 4 }}>
        <dl className="adatok">
          <dt>Név</dt>
          <dd>{c.name}</dd>
          {c.birthName && (
            <>
              <dt>Születési név</dt>
              <dd>{c.birthName}</dd>
            </>
          )}
          <dt>E-mail</dt>
          <dd>{c.email}</dd>
          <dt>Telefon</dt>
          <dd className="szam">{c.phone ? telefonFormaz(c.phone) : <span className="halvany">nincs megadva</span>}</dd>
          <dt>Adóazonosító jel</dt>
          <dd>
            <span className="szam">{mutat ?? c.adoazonositoJelMasked ?? '–'}</span>{' '}
            {c.adoazonositoJelMasked && (
              <button
                className="gomb-sz"
                disabled={felfed.isPending}
                onClick={() => (mutat ? setMutat(null) : felfed.mutate())}
                title={mutat ? undefined : 'A megnyitás bekerül a naplóba.'}
              >
                {mutat ? 'Elrejt' : 'Mutasd'}
              </button>
            )}
          </dd>
          <dt>Adószám</dt>
          <dd className="szam">{c.adoszam ?? '–'}</dd>
          <dt>EV nyilvántartási szám</dt>
          <dd className="szam">{c.evNyilvantartasiSzam ?? '–'}</dd>
          <dt>Lakcím</dt>
          <dd>{c.address ? `${c.address.zip} ${c.address.city}, ${c.address.line}` : '–'}</dd>
          <dt>Székhely települése</dt>
          <dd>{c.hqMunicipality ?? '–'} <span className="halvany kicsi">(iparűzési adó)</span></dd>
          <dt>Tevékenység</dt>
          <dd>
            {c.activityText ?? '–'}
            {c.activityCode && <span className="halvany"> · ÖVTJ-kód {c.activityCode}</span>}
          </dd>
          <dt>Vállalkozó</dt>
          <dd>{c.evSince ? `${datum(c.evSince, { ev: true })} óta` : '–'}</dd>
          <dt>Eddigi könyvelő</dt>
          <dd>{c.previousAccountant ?? <span className="halvany">nem volt</span>}</dd>
          <dt>Külön vállalkozói számla</dt>
          <dd>{c.hasSeparateBusinessAccount === null ? '–' : c.hasSeparateBusinessAccount ? 'Van' : 'Nincs'}</dd>
        </dl>
      </div>
    </div>
  );
}

function AdoProfil({ c }: FulProps) {
  const ev = c.taxProfile?.year ?? currentYear();
  const qc = useQueryClient();
  const pir = usePirito();
  const [p, setP] = useState<TaxProfile | null>(c.taxProfile);
  const [kod, setKod] = useState(c.activityCode ?? '');
  const [hipaRate, setHipaRate] = useState(String(c.taxProfile?.hipa.ratePct ?? 2));
  const [priorBase, setPriorBase] = useState(c.taxProfile?.priorOverrides ? String(c.taxProfile.priorOverrides.priorActualBaseSum) : '');
  const [priorSzja, setPriorSzja] = useState(c.taxProfile?.priorOverrides ? String(c.taxProfile.priorOverrides.priorSzjaAdvanceSum) : '');
  const [priorQ, setPriorQ] = useState<number>(c.taxProfile?.priorOverrides?.throughQuarter ?? 0);
  // A szerver mezőhibái a mezők alatt jelennek meg (nem egy szavas felugró üzenetben).
  const [mezoHiba, setMezoHiba] = useState<Record<string, string>>({});
  // SPEC §28.3.6 / §28.5.5: "Kieső időként felveszem" and the szüneteltetés follow-up open this editor with a prefilled
  // insurance break (?kieso=… or ?szunetel=…, &ig=…); after saving, the csed_gyed allowance item is marked approved.
  const [sp, setSp] = useSearchParams();
  const elotolt = sp.get('kieso') ? { kind: 'kieso' as const, from: sp.get('kieso')!, to: sp.get('ig') ?? `${ev}-12-31` } : sp.get('szunetel') ? { kind: 'szunetel' as const, from: sp.get('szunetel')!, to: sp.get('ig') ?? `${ev}-12-31` } : null;
  const kedvezmenyUtan = sp.get('kedvezmeny') === 'csed_gyed';
  const honapokParam = (sp.get('honapok') ?? '').split(',').map(Number).filter((n) => n >= 1 && n <= 12);
  useEffect(() => {
    if (elotolt) document.getElementById('adoprofil')?.scrollIntoView({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => setP(c.taxProfile), [c.taxProfile]);
  const ment = useMutation({
    mutationFn: () => {
      if (!p) throw new Error('nincs profil');
      // A newly typed code must be an ÖVTJ'25 code (6 digits), the same the team writes in the pipeline;
      // an older 4-digit value that is left untouched does not block saving the rest.
      const ujKod = kod.replace(/\s/g, '');
      if (ujKod !== (c.activityCode ?? '') && ujKod && !isValidOvtjKod(ujKod)) throw new ApiError(400, 'validation_error', 'Hibás ÖVTJ-kód.', { activityCode: '6 számjegy legyen, például 742001.' });
      const rate = Number(hipaRate.replace(',', '.'));
      const prior =
        priorQ > 0
          ? { throughQuarter: priorQ as 1 | 2 | 3, priorActualBaseSum: parseFt(priorBase) ?? 0, priorSzjaAdvanceSum: parseFt(priorSzja) ?? 0 }
          : undefined;
      return ep.accPatchTaxProfile(c.id, {
        year: ev,
        costRatio: p.costRatio,
        status: p.status,
        guaranteedMinimum: p.guaranteedMinimum,
        insuranceBreaks: p.insuranceBreaks,
        hipa: { ...p.hipa, ratePct: Number.isFinite(rate) ? rate : 2 },
        priorOverrides: prior,
        ...(ujKod !== (c.activityCode ?? '') ? { activityCode: ujKod || null } : {}),
      });
    },
    onSuccess: async () => {
      setMezoHiba({});
      if (kedvezmenyUtan) {
        try {
          await ep.accAllowanceDecision(c.id, 'csed_gyed', { status: 'jovahagyva', months: honapokParam, inYear: true });
          void qc.invalidateQueries({ queryKey: ['acc', 'allowances', c.id] });
          pir.ok('Elmentve: a kieső időt felvetted, a kedvezmény-tételt lezártuk.');
        } catch (e) {
          pir.hiba(e);
        }
        const n = new URLSearchParams(sp);
        ['kieso', 'ig', 'kedvezmeny', 'honapok'].forEach((k) => n.delete(k));
        setSp(n, { replace: true });
      } else if (elotolt) {
        const n = new URLSearchParams(sp);
        ['szunetel', 'ig'].forEach((k) => n.delete(k));
        setSp(n, { replace: true });
        pir.ok('Elmentve. Az idei becslést újraszámoltuk.');
      } else pir.ok('Elmentve. Az idei becslést újraszámoltuk.');
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
      void qc.invalidateQueries({ queryKey: ['acc', 'tax', c.id] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields && Object.keys(e.fields).length) {
        setMezoHiba(e.fields);
        pir.hibaSzoveg('Nem mentettem el. Nézd át a pirossal jelölt mezőt.');
      } else pir.hiba(e);
    },
  });
  if (!p)
    return (
      <div className="lap belso" style={{ marginTop: 16 }}>
        <h2>Adózási beállítások</h2>
        <p className="halvany" style={{ marginTop: 6 }}>
          Az ügyfél még nem töltötte ki a kérdőívet, ezért nincs adóprofil.
        </p>
      </div>
    );
  const set = (patch: Partial<TaxProfile>) => setP({ ...p, ...patch });
  return (
    <div className="lap" style={{ marginTop: 16 }} id="adoprofil">
      {elotolt && (
        <div className="uzenet-sav info" style={{ margin: '16px 22px 0' }}>
          <div>
            <b>{elotolt.kind === 'kieso' ? 'Kieső idő felvétele (a kedvezmény-kérdőívből)' : 'Szünetelés felvétele (a változásbejelentés után)'}:</b> lent előre kitöltöttük a dátumokat. Nézd át, kattints a
            „Hozzáadom” gombra, majd mentsd el.
          </div>
        </div>
      )}
      <div className="lap-fej">
        <h2>Adózási beállítások, {ev}</h2>
        {p.costRatioSource === 'ugyfel_javaslat' ? <span className="cimke figyel">Megerősítésre vár</span> : <span className="allapot"><I3 n="befizetve_jel" s={18} /><span className="szo">Megerősítetted</span></span>}
      </div>
      <div className="belso" style={{ paddingTop: 4 }}>
        {c.taxRegime === 'kata' && (
          <div className="uzenet-sav info" style={{ marginBottom: 14 }}>
            <div>
              <b>Katás ügyfél:</b> a kata havi 50 000 Ft, ezek a beállítások most nem hatnak rá. Akkor számítanak, ha átalányadóra vált – addig maradjanak a mostani
              értékek. A szünetelés és a kieső idő viszont a katára is számít.
            </div>
          </div>
        )}
        <div className="mezo">
          <span className="felirat">Költséghányad</span>
          <div className="valaszto" role="radiogroup">
            {([45, 80, 90] as CostRatio[]).map((r) => (
              <label key={r}>
                <input type="radio" name="kh" checked={p.costRatio === r} onChange={() => set({ costRatio: r })} />
                {r}%
                <span className="halvany kicsi" style={{ fontWeight: 400 }}>
                  {r === 45 ? 'általános' : r === 80 ? 'Szja tv. 53. § (2)' : 'csak kiskereskedelem'}
                </span>
              </label>
            ))}
          </div>
          <span className="sugo">
            2026-tól az általános költséghányad 45% (2025-ig 40% volt, 2027-től 50%). A 80% például a fodrászatra, szépségápolásra, építőipari kivitelezésre jár. Ha év közben alacsonyabb hányadú
            tevékenységre vált, az alacsonyabb az egész évre.
          </span>
        </div>
        <div className="mezo">
          <span className="felirat">Jogállás</span>
          <div className="valaszto" role="radiogroup">
            {(['fofoglalkozasu', 'mellekallasu', 'nyugdijas'] as TaxStatus[]).map((s) => (
              <label key={s}>
                <input type="radio" name="js" checked={p.status === s} onChange={() => set({ status: s })} />
                {TAX_STATUS_LABEL[s].split(' (')[0]}
              </label>
            ))}
          </div>
          <span className="sugo">
            {p.status === 'mellekallasu'
              ? 'Mellékállás: heti legalább 36 órás munkaviszony vagy nappali tanulmányok mellett. Nincs minimum járulékalap.'
              : p.status === 'nyugdijas'
                ? 'Kiegészítő tevékenységű: nincs TB-járulék és szocho, SZJA a szokásos módon.'
                : 'Havonta legalább a minimálbér (322 800 Ft) vagy a garantált bérminimum (373 200 Ft) után fizet járulékot.'}
          </span>
        </div>
        {p.status === 'fofoglalkozasu' && (
          <label className="jelolo" style={{ marginTop: 14 }}>
            <input type="checkbox" checked={p.guaranteedMinimum} onChange={(e) => set({ guaranteedMinimum: e.target.checked })} />
            <span>
              Garantált bérminimum a minimum alap (373 200 Ft)
              <span className="sugo" style={{ marginTop: 2 }}>
                Ha a személyesen végzett fő tevékenységhez legalább középfokú végzettség kell (pl. fodrász, kozmetikus).
              </span>
            </span>
          </label>
        )}
        <div className="mezosor ado-profil" style={{ marginTop: 16 }}>
          <label className="mezo">
            <span className="felirat">ÖVTJ’25 kód</span>
            <input
              className={mezoHiba.activityCode ? 'doboz hibas' : 'doboz'}
              value={kod}
              onChange={(e) => {
                setKod(e.target.value);
                if (mezoHiba.activityCode) setMezoHiba(({ activityCode: _x, ...m }) => m);
              }}
              placeholder="pl. 742001"
              inputMode="numeric"
              maxLength={8}
              aria-invalid={mezoHiba.activityCode ? true : undefined}
            />
            {mezoHiba.activityCode ? <span className="hiba-szoveg">ÖVTJ-kód: {mezoHiba.activityCode}</span> : <span className="sugo">6 számjegy, pl. 742001. Ha még nem tudod, hagyd üresen.</span>}
          </label>
          <label className="mezo">
            <span className="felirat">Iparűzési adó módja</span>
            <Lenyilo value={p.hipa.method} onChange={(e) => set({ hipa: { ...p.hipa, method: e.target.value as TaxProfile['hipa']['method'] } })}>
              <option value="savos">Sávos (kisvállalkozói)</option>
              <option value="altalanos">Általános (nem számoljuk)</option>
              <option value="nincs">Nincs</option>
            </Lenyilo>
          </label>
          <label className="mezo">
            <span className="felirat">Helyi adómérték (%)</span>
            <input className={mezoHiba['hipa.ratePct'] || mezoHiba.hipa ? 'doboz szam hibas' : 'doboz szam'} value={hipaRate} onChange={(e) => setHipaRate(e.target.value)} disabled={p.hipa.method === 'nincs'} />
            {(mezoHiba['hipa.ratePct'] || mezoHiba.hipa) && <span className="hiba-szoveg">0 és 2 közötti szám legyen.</span>}
          </label>
        </div>
        <Szunetek p={p} set={set} elotolt={elotolt} />
        <details className="osszevont" style={{ marginTop: 16 }} open={priorQ > 0}>
          <summary>Korábbi könyvelő adatai (év közben jött)</summary>
          <div className="mezosor elozo-konyvelo" style={{ marginTop: 10 }}>
            <label className="mezo">
              <span className="felirat">Eddig a negyedévig</span>
              <div className="szegmens egysor" role="group" aria-label="Utolsó negyedév az előző könyvelőnél">
                {[0, 1, 2, 3].map((n) => (
                  <button key={n} type="button" className={priorQ === n ? 'on' : ''} aria-pressed={priorQ === n} onClick={() => setPriorQ(n)}>
                    {n === 0 ? 'nincs' : `${['I', 'II', 'III'][n - 1]}. n.év`}
                  </button>
                ))}
              </div>
            </label>
            <label className="mezo">
              <span className="felirat">Tényleges járulékalapok összege</span>
              <input className="doboz szam" value={priorBase} onChange={(e) => setPriorBase(e.target.value)} disabled={!priorQ} />
            </label>
            <label className="mezo">
              <span className="felirat">Befizetett SZJA-előleg</span>
              <input className="doboz szam" value={priorSzja} onChange={(e) => setPriorSzja(e.target.value)} disabled={!priorQ} />
            </label>
          </div>
        </details>
        <div className="gombsor" style={{ marginTop: 18 }}>
          <button className="gomb-e" onClick={() => ment.mutate()} disabled={ment.isPending}>
            {p.costRatioSource === 'ugyfel_javaslat' ? 'Megerősítem és mentem' : 'Mentés'}
          </button>
          <span className="halvany kicsi">Mentés után az idei becslést újraszámoljuk. A jóváhagyott negyedévek nem változnak.</span>
        </div>
      </div>
    </div>
  );
}

function Szunetek({ p, set, elotolt }: { p: TaxProfile; set: (x: Partial<TaxProfile>) => void; elotolt?: { kind: 'szunetel' | 'kieso'; from: string; to: string } | null }) {
  const [from, setFrom] = useState(elotolt?.from ?? '');
  const [to, setTo] = useState(elotolt?.to ?? '');
  const [kind, setKind] = useState<'szunetel' | 'kieso'>(elotolt?.kind ?? 'kieso');
  return (
    <div className="mezo" style={{ marginTop: 16 }}>
      <span className="felirat">Szünetelés, kieső idő (táppénz, gyed…)</span>
      {p.insuranceBreaks.length === 0 && <span className="sugo" style={{ marginTop: 0 }}>Nincs rögzítve.</span>}
      {p.insuranceBreaks.map((b, i) => (
        <div key={i} className="sor-flex" style={{ padding: '4px 0' }}>
          <span className="szam">
            {datumRovid(b.from)} – {datumRovid(b.to)}
          </span>
          <span className="cimke">{b.kind === 'szunetel' ? 'szünetel' : 'kieső idő'}</span>
          <button className="gomb-v" onClick={() => set({ insuranceBreaks: p.insuranceBreaks.filter((_, j) => j !== i) })}>
            Eltávolítom
          </button>
        </div>
      ))}
      <div className="sor-flex" style={{ marginTop: 6, flexWrap: 'wrap' }}>
        <input className="doboz" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 160 }} aria-label="Kezdete" />
        <input className="doboz" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 160 }} aria-label="Vége" />
        <div className="szegmens egysor" role="group" aria-label="Fajta" style={{ flex: 'none' }}>
          {(['kieso', 'szunetel'] as const).map((k) => (
            <button key={k} type="button" className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === 'kieso' ? 'kieső idő' : 'szünetel'}
            </button>
          ))}
        </div>
        <button
          className="gomb-m kicsi csak-szoveg"
          disabled={!from || !to || to < from}
          onClick={() => {
            set({ insuranceBreaks: [...p.insuranceBreaks, { from, to, kind }] });
            setFrom('');
            setTo('');
          }}
        >
          Hozzáadom
        </button>
      </div>
    </div>
  );
}

function Elofizetes({ c }: FulProps) {
  const s = c.subscription;
  return (
    <div className="lap" style={{ marginTop: 16 }}>
      <div className="lap-fej">
        <I3 n="szamlaszam" s={36} />
        <h2>Előfizetés</h2>
        {s && s.mode !== 'live' && <span className="cimke demo">{MODE_LABEL[s.mode]}</span>}
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        {!s ? (
          <p className="halvany">Még nem fizetett elő.</p>
        ) : (
          <dl className="adatok" style={{ gridTemplateColumns: '140px 1fr' }}>
            <dt>Állapot</dt>
            <dd>
              {s.status === 'active' ? 'Aktív' : <span className={`cimke ${s.status === 'past_due' || s.status === 'suspended' ? 'hiba' : ''}`}>{SUB_LABEL[s.status]}</span>}
            </dd>
            <dt>Havidíj</dt>
            <dd>
              <Ft n={s.priceHuf} />
            </dd>
            <dt>Következő levonás</dt>
            <dd>{s.nextChargeAt ? idopont(s.nextChargeAt, today()) : '–'}</dd>
            <dt>Kártya</dt>
            <dd className="szam">{s.cardMask ?? '–'}</dd>
            {s.failedAttempts > 0 && (
              <>
                <dt>Sikertelen</dt>
                <dd>{s.failedAttempts} próbálkozás</dd>
              </>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}

function Jegyzetek({ c }: FulProps) {
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useQuery({ queryKey: ['acc', 'notes', c.id], queryFn: () => ep.accNotes(c.id) });
  const [uj, setUj] = useState('');
  const inv = () => qc.invalidateQueries({ queryKey: ['acc', 'notes', c.id] });
  const add = useMutation({ mutationFn: () => ep.accAddNote(c.id, { body: uj.trim() }), onSuccess: () => { setUj(''); void inv(); }, onError: pir.hiba });
  const pin = useMutation({ mutationFn: (x: { id: string; pinned: boolean }) => ep.accPatchNote(x.id, { pinned: x.pinned }), onSuccess: () => void inv(), onError: pir.hiba });
  const del = useMutation({ mutationFn: (id: string) => ep.accDeleteNote(id), onSuccess: () => void inv(), onError: pir.hiba });
  const items = [...(q.data?.items ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="lap" style={{ marginTop: 16 }}>
      <div className="lap-fej">
        <h2>Belső jegyzet</h2>
        <span className="megj">Csak te látod, az ügyfél nem.</span>
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        {q.isError && <HibaSav hiba={q.error} />}
        {q.isPending && <Toltes />}
        {items.map((n) => (
          <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--hajszal)' }}>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 15 }}>
              {n.pinned && <span className="cimke info" style={{ marginRight: 6 }}>Kitűzve</span>}
              {n.body}
            </div>
            <div className="sor-flex halvany kicsi" style={{ marginTop: 4, gap: 14 }}>
              <span>
                {n.author}, {idopont(n.createdAt, today())}
              </span>
              <button className="gomb-sz" style={{ fontSize: 13 }} onClick={() => pin.mutate({ id: n.id, pinned: !n.pinned })}>
                {n.pinned ? 'Levesz' : 'Kitűz'}
              </button>
              <button className="gomb-v" style={{ fontSize: 13 }} onClick={() => del.mutate(n.id)}>
                Törlöm
              </button>
            </div>
          </div>
        ))}
        <textarea className="doboz" style={{ marginTop: 12 }} rows={3} maxLength={4000} placeholder="Pl. „Decemberben új tevékenységet kezd, rákérdezni.”" value={uj} onChange={(e) => setUj(e.target.value)} />
        <div className="gombsor" style={{ marginTop: 10 }}>
          <button className="gomb-m csak-szoveg" disabled={!uj.trim() || add.isPending} onClick={() => add.mutate()}>
            Jegyzet mentése
          </button>
        </div>
      </div>
    </div>
  );
}
