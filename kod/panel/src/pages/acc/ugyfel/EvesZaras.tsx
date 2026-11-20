// SPEC §28.K.3 – Éves zárás tab: the client's annual questionnaire, the fee, the documents, the accountant's
// checklist and the three filing steps (draft → client approves in the app → SZJA / kata filed → HIPA filed).
// The app never files: the accountant files as meghatalmazott and records it here with the NAV confirmation.
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import type { AccAnnualView } from '../../../api/types';
import { HibaSav, Masol, Toltes } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { usePirito } from '../../../ui/Pirito';
import { ANNUAL_TEXTS, FEE_CHARGE_STATUS_LABELS, LOCK_TEXTS, OTHER_INCOME_LABELS } from '../../../_shared/bekotes';
import { ANNUAL_BALL, OTHER_INCOME_KNOWN_TO_NAV, type AnnualCheckItem, type AnnualStatus } from '../../../_shared/enums';
import { datum, ft, idopont } from '../../../lib/format';
import { evesGombok } from '../../../lib/k28';
import { today } from '../../../lib/today';

const ALLAPOT: Record<AnnualStatus, { szo: string; cls: string }> = {
  nem_indult: { szo: 'Még nem nyílt meg (január 5.)', cls: '' },
  kerdoiv: { szo: 'Az ügyfél tölti a kérdőívet', cls: 'info' },
  dijra_var: { szo: 'Elküldte – díjra vár', cls: 'figyel' },
  konyvelonel: { szo: 'Nálad – készítsd el', cls: 'figyel' },
  jovahagyasra_var: { szo: 'Tervezet kint – ügyfél jóváhagyására vár', cls: 'info' },
  beadva: { szo: 'Beadva – a HIPA-bevallás jön', cls: 'info' },
  kesz: { szo: 'Kész', cls: '' },
};

export default function EvesZaras({ c }: FulProps) {
  const y = Number(today().slice(0, 4));
  const ho = Number(today().slice(5, 7));
  const [ev, setEv] = useState(ho <= 6 ? y - 1 : y);
  const q = useQuery({ queryKey: ['acc', 'annual', c.id, ev], queryFn: () => ep.accAnnual(c.id, ev) });
  return (
    <>
      <div className="sor-flex" style={{ marginBottom: 16 }}>
        <div className="szegmens" role="tablist" aria-label="Év">
          {[y - 1, y].map((e) => (
            <button key={e} role="tab" aria-selected={ev === e} className={ev === e ? 'on' : ''} onClick={() => setEv(e)}>
              {e}
            </button>
          ))}
        </div>
        <span className="halvany kicsi">
          {c.taxRegime === 'kata' ? `'${String(ev).slice(2)}KATA-nyilatkozat (február 25.) és HIPA-bevallás (május 31.)` : `${String(ev).slice(2)}SZJA (május 20.) és HIPA-bevallás (május 31.)`}
        </span>
      </div>
      {q.isPending ? <Toltes /> : q.isError ? <HibaSav hiba={q.error} ujra={() => q.refetch()} /> : !q.data ? <Nincs ev={ev} /> : <Zaras c={c} a={q.data} />}
    </>
  );
}

function Nincs({ ev }: { ev: number }) {
  return (
    <div className="lap k28">
      <div className="szak">
        <div className="szak-fej">
          <I3 n="bevallas" s={28} />
          <h2>Éves zárás {ev}</h2>
        </div>
        <p className="halvany">Erre az évre nincs éves zárás (nem volt ügyfelünk, vagy még nem nyílt meg: {ev + 1}. január 5-én nyílik).</p>
      </div>
    </div>
  );
}

function Zaras({ c, a }: FulProps & { a: AccAnnualView }) {
  const qc = useQueryClient();
  const pir = usePirito();
  const zarolt = c.serviceLock ? LOCK_TEXTS.panelDisabled : null;
  const [mutat, setMutat] = useState(false);
  const frissit = (r: AccAnnualView) => qc.setQueryData(['acc', 'annual', c.id, a.year], r);
  const pipa = useMutation({
    mutationFn: (v: { item: AnnualCheckItem; done: boolean }) => ep.accAnnualCheck(c.id, a.id, v),
    onSuccess: frissit,
    onError: pir.hiba,
  });
  const g = evesGombok(a.status, a.regime);
  const st = ALLAPOT[a.status];
  const ans = a.answers;
  const nalam = ANNUAL_BALL[a.status] === 'konyvelo';
  return (
    <div className="racs fo-mellek">
      <div className="oszlop" style={{ gap: 16 }}>
        <div className="lap k28">
          <div className="szak">
            <div className="szak-fej">
              <I3 n="bevallas" s={28} />
              <h2>Éves zárás {a.year}</h2>
              <span className={`cimke ${st.cls}`}>{st.szo}</span>
            </div>
            <p className="halvany">Az ügyfél ezt látja: „{a.statusText}”</p>
            <dl className="adatok keskeny-adatok" style={{ marginTop: 10 }}>
              <dt>Kérdőív határideje</dt>
              <dd>{datum(a.questionnaireDue, { ev: true })}</dd>
              {a.legalDue.szja && (
                <>
                  <dt>SZJA-bevallás</dt>
                  <dd>{datum(a.legalDue.szja, { ev: true })}</dd>
                </>
              )}
              {a.legalDue.kata && (
                <>
                  <dt>Kata-nyilatkozat</dt>
                  <dd>{datum(a.legalDue.kata, { ev: true })}</dd>
                </>
              )}
              <dt>HIPA-bevallás</dt>
              <dd>{datum(a.legalDue.hipa, { ev: true })}</dd>
              <dt>Díj</dt>
              <dd>
                {a.feeCharge ? (
                  <>
                    {ft(a.feeCharge.amountHuf)} – {FEE_CHARGE_STATUS_LABELS[a.feeCharge.status].toLowerCase()}
                  </>
                ) : (
                  <span className="halvany">a kérdőív elküldésekor terheljük</span>
                )}
              </dd>
              {a.approval && (
                <>
                  <dt>Jóváhagyta</dt>
                  <dd>{idopont(a.approval.at, today())}</dd>
                </>
              )}
            </dl>
          </div>
        </div>

        <div className="lap k28">
          <div className="szak">
            <div className="szak-fej">
              <I3 n="irat" s={28} />
              <h2>A kérdőív</h2>
            </div>
            {!ans ? (
              <p className="halvany">{a.status === 'nem_indult' ? 'Január 5-én nyílik, akkor kap értesítést.' : 'Még nem küldte el.'}</p>
            ) : (
              <dl className="adatok keskeny-adatok">
                <dt>Más jövedelem</dt>
                <dd>
                  {ans.otherIncomes.length === 0 ? '–' : ans.otherIncomes.map((o) => OTHER_INCOME_LABELS[o]).join(', ')}
                  {ans.otherIncomes.some((o) => o !== 'nem_volt' && !OTHER_INCOME_KNOWN_TO_NAV.includes(o)) && (
                    <div className="sugo" style={{ color: '#5E3B00' }}>Ezt nézd meg: lehet, hogy külön segítség kell hozzá – előre szólj neki.</div>
                  )}
                  {ans.otherIncomeNote && <div className="halvany kicsi">„{ans.otherIncomeNote}”</div>}
                </dd>
                {a.regime !== 'kata' && (
                  <>
                    <dt>Kedvezmények</dt>
                    <dd>{ans.allowancesOk === null ? '–' : ans.allowancesOk ? 'rendben, nem változott' : 'valami változott – nézd meg a Kedvezmények fület'}</dd>
                  </>
                )}
                <dt>Hol dolgozott</dt>
                <dd>
                  {ans.hipaPlace === 'csak_szekhely' ? 'csak a székhelyén' : ans.hipaPlace === 'mas_telepulesen_is' ? 'más településen is' : '–'}
                  {ans.hipaOtherTowns.map((t) => (
                    <div key={t.town} className="halvany kicsi">
                      {t.town}: kb. {t.days} nap
                    </div>
                  ))}
                </dd>
                <dt>Önkormányzati levél</dt>
                <dd>{ans.municipalityLetter === null ? '–' : ans.municipalityLetter ? 'kapott – feltöltötte a dossziéba' : 'nem kapott'}</dd>
                <dt>1+1%</dt>
                <dd>
                  {!ans.onePercent ? (
                    'nem rendelkezik'
                  ) : (
                    <>
                      {ans.onePercent.civilAdoszam && (
                        <div>
                          civil: <span className="szam">{ans.onePercent.civilAdoszam}</span> <Masol ertek={ans.onePercent.civilAdoszam} />
                        </div>
                      )}
                      {ans.onePercent.egyhazTechnikaiSzam && (
                        <div>
                          egyház: <span className="szam">{ans.onePercent.egyhazTechnikaiSzam}</span> <Masol ertek={ans.onePercent.egyhazTechnikaiSzam} />
                        </div>
                      )}
                    </>
                  )}
                </dd>
                <dt>Visszatérítés ide</dt>
                <dd>
                  <span className="szam">{mutat && a.refundAccount ? a.refundAccount : (ans.refundAccountMasked ?? '–')}</span>{' '}
                  {a.refundAccount && (mutat ? <Masol ertek={a.refundAccount} /> : (
                    <button className="gomb-sz" onClick={() => setMutat(true)} title="A megnyitás bekerül a naplóba.">
                      Mutasd
                    </button>
                  ))}
                </dd>
                <dt>Hiányzó irat</dt>
                <dd>{ans.missingDocuments === null ? '–' : ans.missingDocuments ? 'van még – feltölti' : 'nincs'}</dd>
                {ans.message && (
                  <>
                    <dt>Üzenete</dt>
                    <dd>„{ans.message}”</dd>
                  </>
                )}
              </dl>
            )}
          </div>
          {a.documents.length > 0 && (
            <div className="szak">
              <span className="felirat">Iratok</span>
              <ul className="k28-okok">
                {a.documents.map((d) => (
                  <li key={d.id}>
                    <button className="gomb-sz" onClick={() => void ep.downloadFile((d as { fileId?: string }).fileId ?? d.id, d.title)}>
                      {d.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="oszlop" style={{ gap: 16 }}>
        <div className="lap k28">
          <div className="szak">
            <div className="szak-fej">
              <I3 n="befizetve_jel" s={28} />
              <h2>Teendők</h2>
              {nalam && <span className="cimke figyel">Rád vár</span>}
            </div>
            {zarolt && <div className="uzenet-sav hiba" style={{ marginBottom: 10 }}><div>{zarolt}</div></div>}
            <div className="oszlop" style={{ gap: 8 }}>
              {a.checklist.map((i) => (
                <label key={i.item} className="jelolo">
                  <input type="checkbox" checked={i.done} disabled={!!zarolt || pipa.isPending || a.status === 'nem_indult'} onChange={(e) => pipa.mutate({ item: i.item, done: e.target.checked })} />
                  <span>
                    {i.label}
                    {i.done && i.by && (
                      <span className="halvany kicsi">
                        {' '}
                        · {i.by.firstName}
                        {i.doneAt ? `, ${idopont(i.doneAt, today())}` : ''}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="szak">
            {g.tervezet && <Feltolto cim={ANNUAL_TEXTS.panel.draftUpload} sugo="PDF – az ügyfél az appban átnézi és jóváhagyja." datumKell={false} zarolt={zarolt} fut={(f) => ep.accAnnualDraft(c.id, a.id, f!)} kesz={frissit} ok="Feltöltötted. Az ügyfél értesítést kapott: hagyja jóvá." />}
            {g.szja && (
              <Feltolto
                cim={g.szjaFelirat}
                sugo={a.status === 'konyvelonel' ? 'Az ügyfél még nem hagyta jóvá: csak akkor add be, ha telefonon megbeszéltétek (és ezt a naplóba írd).' : 'A NAV-visszaigazolás PDF-je.'}
                datumKell
                zarolt={zarolt}
                fut={(f, d) => ep.accAnnualFiledSzja(c.id, a.id, f!, d)}
                kesz={frissit}
                ok="Rögzítetted a beadást. Most a HIPA-bevallás jön."
              />
            )}
            {g.hipa && <Feltolto cim={ANNUAL_TEXTS.panel.filedHipa} sugo="Az önkormányzati visszaigazolás (nem kötelező)." datumKell fajlNemKell zarolt={zarolt} fut={(f, d) => ep.accAnnualFiledHipa(c.id, a.id, f, d)} kesz={frissit} ok="Kész: minden bevallás beadva. Az ügyfél értesítést kapott." />}
            {!g.tervezet && !g.szja && !g.hipa && (
              <p className="halvany">
                {a.status === 'kesz' ? 'Minden beadva.' : a.status === 'dijra_var' ? 'A díj kifizetése után kezdhetsz bele (előre fizetendő).' : 'Most az ügyfélen a sor.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Feltolto({
  cim,
  sugo,
  datumKell,
  fajlNemKell,
  zarolt,
  fut,
  kesz,
  ok,
}: {
  cim: string;
  sugo: string;
  datumKell: boolean;
  fajlNemKell?: boolean;
  zarolt: string | null;
  fut: (f: File | null, d: string) => Promise<AccAnnualView>;
  kesz: (r: AccAnnualView) => void;
  ok: string;
}) {
  const pir = usePirito();
  const ref = useRef<HTMLInputElement>(null);
  const [fajl, setFajl] = useState<File | null>(null);
  const [nap, setNap] = useState(today());
  const m = useMutation({
    mutationFn: () => fut(fajl, nap),
    onSuccess: (r) => {
      kesz(r);
      setFajl(null);
      pir.ok(ok);
    },
    onError: pir.hiba,
  });
  return (
    <div className="eves-lepes">
      <div className="sor-flex" style={{ flexWrap: 'wrap', gap: 10 }}>
        <input ref={ref} type="file" accept="application/pdf,image/*" className="rejtett" onChange={(e) => setFajl(e.target.files?.[0] ?? null)} />
        <button type="button" className="gomb-m kicsi" disabled={!!zarolt} onClick={() => ref.current?.click()}>
          <I3 n="feltoltes" s={22} />
          {fajl ? 'Másik fájl' : 'Fájl'}
        </button>
        {datumKell && <input className="doboz" type="date" style={{ width: 170 }} value={nap} max={today()} aria-label="Beadás napja" onChange={(e) => setNap(e.target.value)} />}
        <button className="gomb-e kicsi" disabled={!!zarolt || m.isPending || (!fajlNemKell && !fajl)} title={zarolt ?? undefined} onClick={() => m.mutate()}>
          {cim}
        </button>
      </div>
      <span className="sugo">{fajl ? fajl.name : sugo}</span>
    </div>
  );
}
