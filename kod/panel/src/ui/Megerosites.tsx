// SPEC §29.9.1 – the console's step-up: every money write needs a fresh TOTP (or recovery) code. A page wraps its action
// in `futtat`; on 403 step_up_required the code dialog opens, and after a good code the same action runs again.
import { useRef, useState, type ReactNode } from 'react';
import { kellKetlepcsos, kellMegerosites, konzolMegerosites } from '../api/k29';
import { Fiok } from './kozos';

export function useMegerosites() {
  const [nyitva, setNyitva] = useState(false);
  const [kod, setKod] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const [dolgozik, setDolgozik] = useState(false);
  const fuggo = useRef<{ fn: () => Promise<unknown>; ok: (v: unknown) => void; nem: (e: unknown) => void } | null>(null);

  /** Runs `fn`; when the console asks for the step-up, asks for the code and runs it once more. */
  function futtat<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((e: unknown) => {
      if (kellKetlepcsos(e)) throw new Error('Ehhez előbb kapcsold be a kétlépcsős belépést (Beállítások).');
      if (!kellMegerosites(e)) throw e;
      return new Promise<T>((ok, nem) => {
        fuggo.current = { fn, ok: ok as (v: unknown) => void, nem };
        setKod('');
        setHiba(null);
        setNyitva(true);
      });
    });
  }

  async function megerosit() {
    if (!/^\d{6}$|^[A-Za-z0-9-]{8,}$/.test(kod.trim())) return setHiba('Írd be a hitelesítő alkalmazásod 6 jegyű kódját.');
    setDolgozik(true);
    setHiba(null);
    try {
      await konzolMegerosites(kod.trim());
      setNyitva(false);
      const f = fuggo.current;
      fuggo.current = null;
      if (f) f.fn().then(f.ok, f.nem);
    } catch (e) {
      setHiba(e instanceof Error ? e.message : 'Nem sikerült. Próbáld újra.');
    } finally {
      setDolgozik(false);
    }
  }

  const lap: ReactNode = (
    <Fiok
      nyitva={nyitva}
      keskeny
      bezar={() => {
        setNyitva(false);
        fuggo.current?.nem(new Error('Megszakítottad.'));
        fuggo.current = null;
      }}
      ikon="igazolas"
      cim="Erősítsd meg, hogy te vagy"
      bev="Pénzt érintő művelet: add meg a hitelesítő alkalmazásod kódját. 10 percig nem kérjük újra."
      lab={
        <button className="gomb-e" disabled={dolgozik} onClick={() => void megerosit()}>
          Megerősítem
        </button>
      }
    >
      <label className="mezo">
        <span className="felirat">Kód</span>
        <input className="doboz" inputMode="numeric" autoComplete="one-time-code" value={kod} onChange={(e) => setKod(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void megerosit()} autoFocus />
        {hiba && <span className="hiba-szoveg">{hiba}</span>}
      </label>
    </Fiok>
  );
  return { futtat, lap };
}
