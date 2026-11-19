// Toasts: short confirmations after an action ("Elküldve Katának.").
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { I3 } from './Icon3d';
import { ApiError } from '../api/client';

interface Pirito {
  ok: (szoveg: string) => void;
  hiba: (e: unknown) => void;
  /** A plain error sentence (e.g. the NAV test result's messageHu). */
  hibaSzoveg: (szoveg: string) => void;
}
const Ctx = createContext<Pirito>({ ok: () => {}, hiba: () => {}, hibaSzoveg: () => {} });
export const usePirito = () => useContext(Ctx);

/** A validation error without a marked field says which field is wrong instead of "Nézd át a pirossal jelölt mezőket". */
function hibaUzenet(e: ApiError): string {
  const f = e.fields;
  if (e.status === 400 && f && Object.keys(f).length) {
    const elso = Object.values(f)[0];
    return Object.keys(f).length === 1 ? elso! : `${elso} (és még ${Object.keys(f).length - 1} mező)`;
  }
  return e.message;
}

export function PiritoProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<{ id: number; szoveg: string; hiba: boolean }[]>([]);
  const add = useCallback((szoveg: string, hiba: boolean) => {
    const id = Date.now() + Math.random();
    setLista((l) => [...l, { id, szoveg, hiba }]);
    setTimeout(() => setLista((l) => l.filter((x) => x.id !== id)), hiba ? 6500 : 3200);
  }, []);
  const value: Pirito = {
    ok: (s) => add(s, false),
    hiba: (e) => add(e instanceof ApiError ? hibaUzenet(e) : e instanceof Error && e.message ? e.message : 'Valami nem sikerült. Próbáld újra.', true),
    hibaSzoveg: (s) => add(s, true),
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pirito" role="status" aria-live="polite">
        {lista.map((t) => (
          <div key={t.id} className={t.hiba ? 'hiba' : ''}>
            {!t.hiba && <I3 n="befizetve_jel" s={22} />}
            {t.szoveg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
