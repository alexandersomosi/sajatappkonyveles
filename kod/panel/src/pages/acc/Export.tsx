// FUNKCIOK 27: revenue records export (CSV, UTF-8 BOM, ";") for the accountant's bookkeeping program.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { Fejlec, HibaSav, Toltes, EvValaszto } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { usePirito } from '../../ui/Pirito';
import { today } from '../../lib/today';

const OSZLOPOK = ['ügyfél', 'adószám', 'sorszám', 'bevétel dátuma', 'teljesítés', 'számlaszám/bizonylat', 'vevő', 'összeg (Ft)', 'forrás', 'becsült dátum'];

export default function Export() {
  const t = today();
  const pir = usePirito();
  const [ev, setEv] = useState(Number(t.slice(0, 4)));
  const [valasztott, setValasztott] = useState<Set<string>>(new Set());
  const [tolt, setTolt] = useState(false);
  const q = useQuery({ queryKey: ['acc', 'clients', 'mind', ''], queryFn: () => ep.accClients('mind', '') });
  const kliensek = q.data?.items ?? [];
  const mind = valasztott.size === 0;
  async function letolt() {
    setTolt(true);
    try {
      await ep.accExportCsv(ev, [...valasztott]);
      pir.ok('Letöltve.');
    } catch (e) {
      pir.hiba(e);
    } finally {
      setTolt(false);
    }
  }
  return (
    <>
      <Fejlec cim="Export" mellek="Bevételi nyilvántartás CSV-ben, a könyvelőprogramodba. A pontos formátum a programodtól függ – ha megírod, melyiket használod, hozzáigazítjuk." />
      <div className="tartalom">
        <div className="racs fo-mellek">
          <div className="lap">
            <div className="lap-fej">
              <I3 n="irat" s={36} />
              <h2>Bevételek, CSV</h2>
            </div>
            <div className="belso" style={{ paddingTop: 0 }}>
              <div className="mezosor k2">
                <label className="mezo">
                  <span className="felirat">Év</span>
                  <EvValaszto ev={ev} evek={[Number(t.slice(0, 4)), Number(t.slice(0, 4)) - 1]} valt={setEv} />
                </label>
              </div>
              <div className="mezo" style={{ marginTop: 16 }}>
                <span className="felirat">Ügyfelek</span>
                {q.isError && <HibaSav hiba={q.error} />}
                {q.isPending ? (
                  <Toltes />
                ) : (
                  <div className="oszlop" style={{ gap: 8 }}>
                    <label className="jelolo">
                      <input type="checkbox" checked={mind} onChange={() => setValasztott(new Set())} />
                      Mindegyik ügyfelem ({kliensek.length})
                    </label>
                    {kliensek.map((k) => (
                      <label className="jelolo" key={k.id}>
                        <input
                          type="checkbox"
                          checked={valasztott.has(k.id)}
                          onChange={() => {
                            const n = new Set(valasztott);
                            if (n.has(k.id)) n.delete(k.id);
                            else n.add(k.id);
                            setValasztott(n);
                          }}
                        />
                        {k.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="gombsor" style={{ marginTop: 18 }}>
                <button className="gomb-e" disabled={tolt} onClick={() => void letolt()}>
                  {tolt ? 'Készítem…' : 'CSV letöltése'}
                </button>
              </div>
            </div>
          </div>
          <div className="lap belso">
            <h2 style={{ fontSize: 17 }}>Mi van benne?</h2>
            <p className="halvany" style={{ marginTop: 6 }}>UTF-8 (BOM-mal, így az Excel is jól nyitja meg), pontosvesszővel elválasztva. Oszlopok:</p>
            <ol style={{ paddingLeft: 20, marginTop: 8, display: 'grid', gap: 3 }}>
              {OSZLOPOK.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ol>
            <p className="halvany kicsi" style={{ marginTop: 10 }}>A kizárt tételek nincsenek benne. A letöltést naplózzuk.</p>
          </div>
        </div>
      </div>
    </>
  );
}
