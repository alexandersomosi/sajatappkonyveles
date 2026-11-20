// SPEC §29.9.1 – the console's write guard in the panel: every write runs through useLepcsos(): on 403 step_up_required
// the code dialog opens ("Kétlépcsős kód"), and after a good code the same action is repeated. Every action is a dialog
// with its fields, the reason box (min 5 characters where required), the summary sentence and "Megerősítem".
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../../../api/client';
import * as k from '../../../api/k29f';
import { CONSOLE_RULES, CONSOLE_TEXTS } from '../../../_shared/k29f';
import { Fiok } from '../../../ui/kozos';
import { usePirito } from '../../../ui/Pirito';

type Futtat = <T>(fn: () => Promise<T>) => Promise<T>;
const Ctx = createContext<Futtat>((fn) => fn());
export const useLepcsos = () => useContext(Ctx);

/** Provider: holds the code dialog; repeats the pending action after a successful step-up. */
export function LepcsoProvider({ children }: { children: ReactNode }) {
  const [nyitva, setNyitva] = useState(false);
  const [kod, setKod] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const [fut, setFut] = useState(false);
  const varo = useRef<{ ok: () => void; megse: () => void } | null>(null);
  const futtat: Futtat = useCallback(async (fn) => {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'step_up_required')) throw e;
      await new Promise<void>((ok, megse) => {
        varo.current = { ok, megse: () => megse(e) };
        setKod('');
        setHiba(null);
        setNyitva(true);
      });
      return fn();
    }
  }, []);
  const kuld = async () => {
    setFut(true);
    setHiba(null);
    try {
      await k.consoleStepUp(kod.trim());
      setNyitva(false);
      varo.current?.ok();
      varo.current = null;
    } catch (e) {
      setHiba(e instanceof ApiError ? e.message : 'Nem sikerült. Próbáld újra.');
    } finally {
      setFut(false);
    }
  };
  return (
    <Ctx.Provider value={futtat}>
      {children}
      <Fiok
        nyitva={nyitva}
        keskeny
        ikon="fiok"
        cim={CONSOLE_TEXTS.stepUpTitle}
        bev={CONSOLE_TEXTS.stepUpBody}
        bezar={() => {
          setNyitva(false);
          varo.current?.megse();
          varo.current = null;
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void kuld();
          }}
        >
          <label className="mezo">
            <span className="felirat">Kód</span>
            <input className={`doboz${hiba ? ' hibas' : ''}`} inputMode="numeric" autoComplete="one-time-code" autoFocus value={kod} onChange={(e) => setKod(e.target.value)} placeholder="123 456" />
            {hiba ? <span className="hiba-szoveg">{hiba}</span> : null}
          </label>
          <button type="submit" className="gomb-e" style={{ marginTop: 14 }} disabled={fut || kod.trim().length < 6}>
            {CONSOLE_TEXTS.stepUpButton}
          </button>
        </form>
      </Fiok>
    </Ctx.Provider>
  );
}

export interface MezoDef {
  kulcs: string;
  felirat: string;
  tipus?: 'szoveg' | 'szam' | 'datum' | 'honap' | 'hosszu' | 'valaszto' | 'jelolo';
  opciok?: { kulcs: string; felirat: string }[];
  sugo?: string;
  alap?: string;
  /** csak akkor látszik, ha a függvény igazat ad */
  ha?: (v: Record<string, string>) => boolean;
}
export interface MuveletDef {
  cim: string;
  bev?: string;
  mezok: MezoDef[];
  /** reason required (destructive actions, §29.9.1) */
  indok?: boolean;
  veszelyes?: boolean;
  visszavonhatatlan?: boolean;
  /** the summary sentence: what happens, to whom, the amount */
  osszegzes: (v: Record<string, string>) => string;
  kuld: (v: Record<string, string>) => Promise<unknown>;
  siker?: (r: unknown) => string;
}

/** One action dialog (drawer). */
export function MuveletFiok({ def, bezar, kesz }: { def: MuveletDef | null; bezar: () => void; kesz?: () => void }) {
  const futtat = useLepcsos();
  const pir = usePirito();
  const [v, setV] = useState<Record<string, string>>({});
  const [fut, setFut] = useState(false);
  const [hibak, setHibak] = useState<Record<string, string>>({});
  const nyitva = Boolean(def);
  const kulcs = def?.cim ?? '';
  const [utolso, setUtolso] = useState('');
  if (kulcs !== utolso) {
    setUtolso(kulcs);
    setV(Object.fromEntries((def?.mezok ?? []).filter((m) => m.alap !== undefined).map((m) => [m.kulcs, m.alap!])));
    setHibak({});
  }
  if (!def) return null;
  const indokOk = !def.indok || (v.reason ?? '').trim().length >= CONSOLE_RULES.reasonMin;
  const kuld = async () => {
    setFut(true);
    setHibak({});
    try {
      const r = await futtat(() => def.kuld(v));
      pir.ok(def.siker ? def.siker(r) : CONSOLE_TEXTS.done);
      kesz?.();
      bezar();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setHibak(e.fields);
      pir.hiba(e);
    } finally {
      setFut(false);
    }
  };
  const mezo = (m: MezoDef) => {
    if (m.ha && !m.ha(v)) return null;
    const set = (x: string) => setV((o) => ({ ...o, [m.kulcs]: x }));
    const h = hibak[m.kulcs];
    if (m.tipus === 'valaszto')
      return (
        <div key={m.kulcs} className="mezo">
          <span className="felirat">{m.felirat}</span>
          <div className="valaszto">
            {(m.opciok ?? []).map((o) => (
              <label key={o.kulcs}>
                <input type="radio" name={m.kulcs} checked={v[m.kulcs] === o.kulcs} onChange={() => set(o.kulcs)} /> {o.felirat}
              </label>
            ))}
          </div>
          {m.sugo ? <span className="sugo">{m.sugo}</span> : null}
          {h ? <span className="hiba-szoveg">{h}</span> : null}
        </div>
      );
    if (m.tipus === 'jelolo')
      return (
        <label key={m.kulcs} className="jelolo mezo">
          <input type="checkbox" checked={v[m.kulcs] === '1'} onChange={(e) => set(e.target.checked ? '1' : '')} /> {m.felirat}
        </label>
      );
    return (
      <label key={m.kulcs} className="mezo">
        <span className="felirat">{m.felirat}</span>
        {m.tipus === 'hosszu' ? (
          <textarea className={`doboz${h ? ' hibas' : ''}`} value={v[m.kulcs] ?? ''} onChange={(e) => set(e.target.value)} />
        ) : (
          <input
            className={`doboz${h ? ' hibas' : ''}`}
            type={m.tipus === 'szam' ? 'number' : m.tipus === 'datum' ? 'date' : m.tipus === 'honap' ? 'month' : 'text'}
            value={v[m.kulcs] ?? ''}
            onChange={(e) => set(e.target.value)}
          />
        )}
        {m.sugo ? <span className="sugo">{m.sugo}</span> : null}
        {h ? <span className="hiba-szoveg">{h}</span> : null}
      </label>
    );
  };
  return (
    <Fiok nyitva={nyitva} bezar={bezar} ikon="fiok" cim={def.cim} bev={def.bev}>
      <div style={{ display: 'grid', gap: 14 }}>
        {def.mezok.map(mezo)}
        {def.indok !== false ? (
          <label className="mezo">
            <span className="felirat">{CONSOLE_TEXTS.reason}</span>
            <textarea className={`doboz${hibak.reason ? ' hibas' : ''}`} value={v.reason ?? ''} onChange={(e) => setV((o) => ({ ...o, reason: e.target.value }))} />
            <span className="sugo">{def.indok ? CONSOLE_TEXTS.reasonHint : 'Nem kötelező.'}</span>
            {hibak.reason ? <span className="hiba-szoveg">{hibak.reason}</span> : null}
          </label>
        ) : null}
        <div className={`uzenet-sav${def.veszelyes ? ' figyel' : ''}`} style={{ display: 'block' }}>
          <b>{def.osszegzes(v)}</b>
          {def.visszavonhatatlan ? <div style={{ marginTop: 4 }}>{CONSOLE_TEXTS.irreversible}</div> : null}
        </div>
        <div>
          <button type="button" className={def.veszelyes ? 'gomb-v' : 'gomb-e'} disabled={fut || !indokOk} onClick={() => void kuld()}>
            {CONSOLE_TEXTS.confirm}
          </button>
        </div>
      </div>
    </Fiok>
  );
}
