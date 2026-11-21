// Beállítások: response-time promise, monthly statement request, 2FA, password, sessions, signature preview.
// The appointments switch is gone (SPEC §26.2.9: callbacks instead of booking). The service team sees only security.
import { useEffect, useState } from 'react';
import { valaszidoTilos } from '../../lib/k28';
import { RESPONSE_TIME_SETTINGS_ERROR } from '../../_shared/bekotes';
import { ACCOUNTANT_RESPONSE_TIME_DEFAULT } from '../../_shared/enums';
import brand from '../../_shared/brand.json';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { useAuth } from '../../auth/Auth';
import { KetlepcsosBeallitas } from '../../auth/pages';
import { Avatar, Fejlec, Fiok, HibaSav, Toltes } from '../../ui/kozos';
import { Level } from '../../ui/Level';
import { I3 } from '../../ui/Icon3d';
import { usePirito } from '../../ui/Pirito';
import { idopont } from '../../lib/format';
import { today } from '../../lib/today';
import { updateUser } from '../../api/client';
import type { SessionInfo } from '../../_shared/api';

export default function Beallitasok() {
  const { konyvelo, frissit, user, isAccountant, isCsapat } = useAuth();
  const qc = useQueryClient();
  const pir = usePirito();
  const [f, setF] = useState({ responseTimeText: '', monthlyStatementRequest: true });
  useEffect(() => {
    if (konyvelo) setF({ responseTimeText: konyvelo.responseTimeText, monthlyStatementRequest: konyvelo.monthlyStatementRequest });
  }, [konyvelo]);
  const ment = useMutation({
    mutationFn: () => ep.accPatchSettings({ ...f, responseTimeText: f.responseTimeText.trim() }),
    onSuccess: () => {
      pir.ok('Elmentve. Az ügyfeleid már így látják.');
      void frissit();
      void qc.invalidateQueries({ queryKey: ['acc', 'settings'] });
    },
    onError: pir.hiba,
  });
  return (
    <>
      <Fejlec
        cim="Beállítások"
        mellek={isCsapat ? 'A jelszavad, a kétlépcsős belépés és a bejelentkezett eszközeid.' : 'Amit itt állítasz, azt az ügyfeleid is látják az appban (kivéve a biztonságot).'}
      />
      <div className="tartalom">
        <div className="racs fo-mellek">
          <div>
            {isAccountant && (
              <div className="lap">
                <div className="lap-fej">
                  <Avatar avatarKey={konyvelo?.avatarKey} />
                  <div>
                    <h2>{konyvelo?.displayName}</h2>
                    <div className="megj">
                      {konyvelo?.title} · nyilvántartási szám: {konyvelo?.registrationNumber}
                    </div>
                  </div>
                </div>
                <div className="belso" style={{ paddingTop: 0 }}>
                  <label className="mezo">
                    {/* SPEC §28.K.15: no answer-time promise – "A lehető leggyorsabban válaszol" */}
                    <span className="felirat">Válaszadás (az ügyfél az üzeneteknél látja)</span>
                    <input
                      className={`doboz${valaszidoTilos(f.responseTimeText) ? ' hibas' : ''}`}
                      maxLength={80}
                      value={f.responseTimeText}
                      placeholder={ACCOUNTANT_RESPONSE_TIME_DEFAULT}
                      onChange={(e) => setF({ ...f, responseTimeText: e.target.value })}
                    />
                    {valaszidoTilos(f.responseTimeText) ? (
                      <span className="hiba-szoveg">{RESPONSE_TIME_SETTINGS_ERROR}</span>
                    ) : (
                      <span className="sugo">{RESPONSE_TIME_SETTINGS_ERROR}</span>
                    )}
                  </label>
                  <label className="jelolo" style={{ marginTop: 16 }}>
                    <input type="checkbox" checked={f.monthlyStatementRequest} onChange={(e) => setF({ ...f, monthlyStatementRequest: e.target.checked })} />
                    <span>
                      Minden hónap 1-jén kérjük az előző havi bankszámlakivonatot
                      <span className="sugo" style={{ marginTop: 2 }}>Határidő: 10-e. Az ügyfél „{konyvelo?.firstName} kéri” kártyán látja.</span>
                    </span>
                  </label>
                  <p className="sugo" style={{ marginTop: 12 }}>
                    Időpontot az ügyfelek már nem foglalnak: visszahívást kérnek, és a csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. Ha neked adnak át egyet, a Visszahívások oldalon látod.
                  </p>
                  <div className="gombsor" style={{ marginTop: 18 }}>
                    <button className="gomb-e" disabled={ment.isPending || !f.responseTimeText.trim() || valaszidoTilos(f.responseTimeText)} onClick={() => ment.mutate()}>
                      Mentés
                    </button>
                  </div>
                </div>
              </div>
            )}
            <Biztonsag totp={!!user?.totpEnabled} />
          </div>
          <div>
            {isAccountant && konyvelo && (
              <div className="lap">
                <div className="lap-fej">
                  <h2>Így írod alá a leveleket</h2>
                </div>
                <div className="belso" style={{ paddingTop: 0, background: 'var(--alap)', borderRadius: '0 0 var(--r-lap) var(--r-lap)', paddingBottom: 18 }}>
                  <div style={{ height: 14 }} />
                  <Level megszolitas="Kedves Kata!" szoveg="Kiszámoltam, mennyit kell most befizetned. Ez már a végleges összeg." alairo={konyvelo.displayName} datumIso={today()} alairas={konyvelo.signatureSvgPath} />
                  <p className="halvany kicsi" style={{ marginTop: 10 }}>
                    {konyvelo.signatureSvgPath ? 'Az aláírásod a demóban helykitöltő. Élesben egyszer, érintőképernyőn adod le a sajátodat.' : 'Még nincs aláírásod. Élesben egyszer, érintőképernyőn adod le.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Biztonsag({ totp }: { totp: boolean }) {
  const { totpKotelezo } = useAuth();
  const pir = usePirito();
  const qc = useQueryClient();
  const [jelszo, setJelszo] = useState({ regi: '', uj: '' });
  const [beallit, setBeallit] = useState(false);
  const [kikapcs, setKikapcs] = useState(false);
  const [kod, setKod] = useState('');
  const s = useQuery({ queryKey: ['auth', 'sessions'], queryFn: ep.getSessions });
  const sessions: SessionInfo[] = Array.isArray(s.data) ? s.data : (s.data?.items ?? []);
  const csere = useMutation({
    mutationFn: () => ep.changePassword(jelszo.regi, jelszo.uj),
    onSuccess: () => {
      pir.ok('Megvan az új jelszó.');
      setJelszo({ regi: '', uj: '' });
    },
    onError: pir.hiba,
  });
  const ki = useMutation({
    mutationFn: () => ep.totpDisable(kod.replace(/\s/g, '')),
    onSuccess: () => {
      pir.ok('Kikapcsoltad a kétlépcsős belépést.');
      updateUser({ totpEnabled: false });
      setKikapcs(false);
      setKod('');
    },
    onError: pir.hiba,
  });
  const kilep = useMutation({ mutationFn: (id: string) => ep.revokeSession(id), onSuccess: () => void qc.invalidateQueries({ queryKey: ['auth', 'sessions'] }), onError: pir.hiba });
  return (
    <div className="lap" style={{ marginTop: 16 }}>
      <div className="lap-fej">
        <I3 n="fiok" s={36} />
        <h2>Biztonság</h2>
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        <div className="sor-flex ter">
          <div>
            <div className="felkover">Kétlépcsős belépés</div>
            <div className="halvany kicsi">{totp ? 'Be van kapcsolva. Belépéskor a hitelesítő app kódját is kérjük.' : 'Ki van kapcsolva. Ügyféladatokat látsz, ezért erősen ajánljuk.'}</div>
          </div>
          {totp && totpKotelezo ? (
            <span className="halvany kicsi" style={{ maxWidth: 260, textAlign: 'right' }}>
              Nem kapcsolható ki: a szerver beállítása szerint a könyvelői és tulajdonosi fiókokon kötelező.
            </span>
          ) : totp ? (
            <button className="gomb-sz" onClick={() => setKikapcs(true)}>
              Kikapcsolom
            </button>
          ) : (
            <button className="gomb-m csak-szoveg" onClick={() => setBeallit(true)}>
              Bekapcsolom
            </button>
          )}
        </div>
        <hr className="halk" />
        <div className="felkover">Jelszó cseréje</div>
        <div className="mezosor k2" style={{ marginTop: 8 }}>
          <label className="mezo">
            <span className="felirat">Mostani jelszó</span>
            <input className="doboz" type="password" autoComplete="current-password" value={jelszo.regi} onChange={(e) => setJelszo({ ...jelszo, regi: e.target.value })} />
          </label>
          <label className="mezo">
            <span className="felirat">Új jelszó (legalább 10 karakter)</span>
            <input className="doboz" type="password" autoComplete="new-password" value={jelszo.uj} onChange={(e) => setJelszo({ ...jelszo, uj: e.target.value })} />
          </label>
        </div>
        <div className="gombsor" style={{ marginTop: 12 }}>
          <button className="gomb-m csak-szoveg" disabled={!jelszo.regi || jelszo.uj.length < 10 || csere.isPending} onClick={() => csere.mutate()}>
            Jelszót cserélek
          </button>
        </div>
        <hr className="halk" />
        <div className="felkover">Hol vagy belépve</div>
        {s.isPending ? (
          <Toltes />
        ) : s.isError ? (
          <HibaSav hiba={s.error} />
        ) : (
          <table className="tabla" style={{ marginTop: 6 }}>
            <tbody>
              {sessions.map((x) => (
                <tr key={x.id}>
                  <td>
                    {x.clientKind === 'panel' ? 'Webes panel' : x.clientKind === 'web' ? 'Webes app' : 'Telefonos app'}
                    <div className="al">{eszkozNev(x.userAgent)}</div>
                  </td>
                  <td className="nt">{idopont(x.lastUsedAt, today())}</td>
                  <td className="jobb">
                    {x.current ? (
                      <span className="halvany">ez az</span>
                    ) : (
                      <button className="gomb-v" onClick={() => kilep.mutate(x.id)}>
                        Kiléptetem
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Fiok nyitva={beallit} bezar={() => setBeallit(false)} ikon="fiok" cim="Kétlépcsős belépés bekapcsolása" szeles>
        {beallit && (
          <KetlepcsosBeallitas
            kesz={() => {
              updateUser({ totpEnabled: true });
              setBeallit(false);
            }}
          />
        )}
      </Fiok>
      <Fiok
        nyitva={kikapcs}
        bezar={() => setKikapcs(false)}
        cim="Kétlépcsős belépés kikapcsolása"
        bev="Írd be a hitelesítő appban látható kódot."
        lab={
          <button className="gomb-e" disabled={kod.replace(/\s/g, '').length < 6 || ki.isPending} onClick={() => ki.mutate()}>
            Kikapcsolom
          </button>
        }
      >
        <input className="doboz szam" inputMode="numeric" value={kod} onChange={(e) => setKod(e.target.value)} />
      </Fiok>
    </div>
  );
}

/** „Chrome, Windows” a nyers böngésző-azonosító helyett. */
function eszkozNev(ua: string | null | undefined): string {
  if (!ua) return 'ismeretlen eszköz';
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /okhttp|Expo|Dalvik/i.test(ua) ? `${brand.name} app` : 'böngésző';
  const o = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return o ? `${b}, ${o}` : b;
}
