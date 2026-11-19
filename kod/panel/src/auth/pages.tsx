// Staff login (+ TOTP step), password reset by e-mail code, forced 2FA setup (SPEC §4.1, §18).
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import QRCode from 'qrcode';
import brand from '../_shared/brand.json';
import { ApiError, setSession, updateUser } from '../api/client';
import { kezdolap } from '../lib/csapat';
import * as ep from '../api/endpoints';
import { useAuth } from './Auth';
import { Logo, DemoCimke } from '../ui/kozos';
import { emailOk } from '../lib/validate';

function BelepesKeret({ children }: { children: React.ReactNode }) {
  const { demo } = useAuth();
  return (
    <div className="belepes-oldal">
      <div className="belepes-bal">
        <div className="sor-flex" style={{ gap: 14 }}>
          <Logo size={48} />
          <div>
            <div style={{ fontWeight: 750, fontSize: 22, letterSpacing: '-.02em' }}>{brand.name}</div>
            <div style={{ color: 'var(--fejlec-halvany)', fontSize: 14.5 }}>Könyvelői és tulajdonosi felület</div>
          </div>
          {demo && <DemoCimke>DEMO – minta adatok</DemoCimke>}
        </div>
        <h1>Minden ügyfeled egy helyen: iratok, számlák, határidők.</h1>
        <p>Te hagyod jóvá a fizetendőt, az ügyfél azonnal látja a leveleddel együtt. A NAV-nak továbbra is te adod be.</p>
      </div>
      <div className="belepes-jobb">
        <div className="belepes-lap">{children}</div>
      </div>
    </div>
  );
}

export function BelepesOldal() {
  const nav = useNavigate();
  const { frissit, kilep } = useAuth();
  const [email, setEmail] = useState('');
  const [jelszo, setJelszo] = useState('');
  const [mutasd, setMutasd] = useState(false);
  const [mfa, setMfa] = useState<string | null>(null);
  const [kod, setKod] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const [kuld, setKuld] = useState(false);
  const [ugyfel, setUgyfel] = useState(false);

  async function utana(r: Awaited<ReturnType<typeof ep.login>>) {
    if (r.user.role === 'client') {
      setSession(r);
      await kilep();
      setUgyfel(true);
      return;
    }
    setSession(r);
    await frissit();
    nav(kezdolap(r.user.role, r.user.role === 'accountant'), { replace: true });
  }

  async function belep(e: FormEvent) {
    e.preventDefault();
    setHiba(null);
    if (!emailOk(email)) return setHiba('Ez nem tűnik e-mail-címnek.');
    if (!jelszo) return setHiba('Írd be a jelszavad.');
    setKuld(true);
    try {
      await utana(await ep.login(email.trim(), jelszo));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'mfa_required') {
        const t = (err.body as { mfaToken?: string } | undefined)?.mfaToken;
        if (t) {
          setMfa(t);
          setJelszo('');
        } else setHiba('A kétlépcsős belépés nem indult el. Próbáld újra.');
      } else setHiba(err instanceof ApiError ? err.message : 'Nem sikerült belépni.');
    } finally {
      setKuld(false);
    }
  }
  async function totp(e: FormEvent) {
    e.preventDefault();
    if (!mfa) return;
    setHiba(null);
    setKuld(true);
    try {
      await utana(await ep.loginTotp(mfa, kod.replace(/\s/g, '')));
    } catch (err) {
      setHiba(err instanceof ApiError ? err.message : 'Nem jó a kód.');
    } finally {
      setKuld(false);
    }
  }

  if (ugyfel)
    return (
      <BelepesKeret>
        <h2>Ez a felület a könyvelőknek szól</h2>
        <p className="bev">Ügyfélként a telefonos appban vagy a webes appban látod a dossziédat és a fizetendőt.</p>
        <button className="gomb-m" onClick={() => setUgyfel(false)}>
          Vissza a belépéshez
        </button>
      </BelepesKeret>
    );

  return (
    <BelepesKeret>
      {!mfa ? (
        <form onSubmit={belep} noValidate>
          <h2>Belépés</h2>
          <p className="bev">Könyvelőként, ügyfélszolgálatosként vagy tulajdonosként lépj be.</p>
          <div className="lap">
            <label className="mezo">
              <span className="felirat">E-mail-cím</span>
              <input className="doboz" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </label>
            <label className="mezo">
              <span className="felirat">Jelszó</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <input className="doboz" type={mutasd ? 'text' : 'password'} autoComplete="current-password" value={jelszo} onChange={(e) => setJelszo(e.target.value)} />
                <button type="button" className="gomb-sz" onClick={() => setMutasd(!mutasd)}>
                  {mutasd ? 'Elrejt' : 'Mutasd'}
                </button>
              </span>
            </label>
            {hiba && (
              <div className="uzenet-sav hiba" style={{ marginTop: 14 }} role="alert">
                {hiba}
              </div>
            )}
            <button className="gomb-e" disabled={kuld} type="submit">
              {kuld ? 'Belépek…' : 'Belépés'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <Link className="gomb-sz" to="/jelszo">
                Elfelejtettem a jelszavam
              </Link>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={totp} noValidate>
          <h2>Kétlépcsős belépés</h2>
          <p className="bev">Írd be a hitelesítő appban látható 6 számjegyű kódot. Ha nincs nálad a telefonod, egy visszaállító kód is jó.</p>
          <div className="lap">
            <label className="mezo">
              <span className="felirat">Kód</span>
              <input className="doboz szam" inputMode="numeric" autoComplete="one-time-code" value={kod} onChange={(e) => setKod(e.target.value)} autoFocus />
            </label>
            {hiba && (
              <div className="uzenet-sav hiba" style={{ marginTop: 14 }} role="alert">
                {hiba}
              </div>
            )}
            <button className="gomb-e" disabled={kuld || kod.trim().length < 6} type="submit">
              {kuld ? 'Ellenőrzöm…' : 'Belépés'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button type="button" className="gomb-sz" onClick={() => setMfa(null)}>
                Vissza
              </button>
            </div>
          </div>
        </form>
      )}
    </BelepesKeret>
  );
}

export function JelszoOldal() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [email, setEmail] = useState(sp.get('email') ?? '');
  const [lepes, setLepes] = useState<'email' | 'kod' | 'kesz'>('email');
  const [kod, setKod] = useState('');
  const [uj, setUj] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const [kuld, setKuld] = useState(false);

  async function kerek(e: FormEvent) {
    e.preventDefault();
    setHiba(null);
    if (!emailOk(email)) return setHiba('Ez nem tűnik e-mail-címnek.');
    setKuld(true);
    try {
      await ep.forgotPassword(email.trim());
      setLepes('kod');
    } catch (err) {
      setHiba(err instanceof ApiError ? err.message : 'Nem sikerült.');
    } finally {
      setKuld(false);
    }
  }
  async function beallit(e: FormEvent) {
    e.preventDefault();
    setHiba(null);
    if (uj.length < 10) return setHiba('A jelszó legalább 10 karakter legyen.');
    setKuld(true);
    try {
      await ep.resetPassword(email.trim(), kod.trim(), uj);
      setLepes('kesz');
    } catch (err) {
      setHiba(err instanceof ApiError ? err.message : 'Nem sikerült.');
    } finally {
      setKuld(false);
    }
  }
  return (
    <BelepesKeret>
      {lepes === 'email' && (
        <form onSubmit={kerek} noValidate>
          <h2>Új jelszó</h2>
          <p className="bev">Küldünk egy 6 számjegyű kódot az e-mail-címedre. 15 percig érvényes.</p>
          <div className="lap">
            <label className="mezo">
              <span className="felirat">E-mail-cím</span>
              <input className="doboz" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </label>
            {hiba && <div className="uzenet-sav hiba" style={{ marginTop: 14 }}>{hiba}</div>}
            <button className="gomb-e" disabled={kuld} type="submit">
              Kódot kérek
            </button>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <Link className="gomb-sz" to="/belepes">
                Vissza a belépéshez
              </Link>
            </div>
          </div>
        </form>
      )}
      {lepes === 'kod' && (
        <form onSubmit={beallit} noValidate>
          <h2>Írd be a kódot</h2>
          <p className="bev">Ha van ilyen fiók, elküldtük a kódot ide: {email}. Nézd meg a levélszemétben is.</p>
          <div className="lap">
            <label className="mezo">
              <span className="felirat">Kód az e-mailből</span>
              <input className="doboz szam" inputMode="numeric" value={kod} onChange={(e) => setKod(e.target.value)} autoFocus />
            </label>
            <label className="mezo">
              <span className="felirat">Új jelszó</span>
              <input className="doboz" type="password" autoComplete="new-password" value={uj} onChange={(e) => setUj(e.target.value)} />
              <span className="sugo">Legalább 10 karakter. Ne az e-mail-címed legyen.</span>
            </label>
            {hiba && <div className="uzenet-sav hiba" style={{ marginTop: 14 }}>{hiba}</div>}
            <button className="gomb-e" disabled={kuld} type="submit">
              Beállítom
            </button>
          </div>
        </form>
      )}
      {lepes === 'kesz' && (
        <div>
          <h2>Kész, megvan az új jelszó</h2>
          <p className="bev">Minden eszközön kiléptettünk. Most lépj be az új jelszóval.</p>
          <button className="gomb-e" onClick={() => nav('/belepes')}>
            Belépés
          </button>
        </div>
      )}
    </BelepesKeret>
  );
}

/** 2FA setup: secret + QR (otpauth URL), code, then the 10 recovery codes shown once. */
export function KetlepcsosBeallitas({ kotelezo, kesz }: { kotelezo?: boolean; kesz?: () => void }) {
  const [adat, setAdat] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [kod, setKod] = useState('');
  const [kodok, setKodok] = useState<string[] | null>(null);
  const [hiba, setHiba] = useState<string | null>(null);
  const [masolva, setMasolva] = useState(false);
  // More than 10 minutes after signing in the server also wants the current password (403 reauth_required):
  // the field appears, and both setup and enable are sent with it.
  const [jelszoKell, setJelszoKell] = useState(false);
  const [jelszo, setJelszo] = useState('');
  const [jelszoHiba, setJelszoHiba] = useState<string | null>(null);
  const [indul, setIndul] = useState(false);
  const { user } = useAuth();
  /** true when the error was a "give me your password" answer (field shown / wrong password marked). */
  function ujraHitelesites(e: unknown): boolean {
    if (!(e instanceof ApiError)) return false;
    if (e.fields?.currentPassword) {
      setJelszoKell(true);
      setJelszoHiba(e.fields.currentPassword);
      return true;
    }
    if (e.code === 'reauth_required') {
      setJelszoKell(true);
      setJelszoHiba(null);
      return true;
    }
    return false;
  }
  async function indit(pw?: string) {
    setHiba(null);
    setJelszoHiba(null);
    setIndul(true);
    try {
      const r = await ep.totpSetup(pw || undefined);
      setAdat(r);
      setQr(await QRCode.toDataURL(r.otpauthUrl, { margin: 1, width: 200, color: { dark: '#10152B', light: '#FFFFFF' } }));
    } catch (e) {
      if (!ujraHitelesites(e)) setHiba(e instanceof ApiError ? e.message : 'Nem sikerült elindítani.');
    } finally {
      setIndul(false);
    }
  }
  useEffect(() => {
    void indit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function bekapcs(e: FormEvent) {
    e.preventDefault();
    // Enter in the password field before the key exists: that is "Tovább", not "Bekapcsolom".
    if (!adat) {
      if (jelszo) void indit(jelszo);
      return;
    }
    setHiba(null);
    setJelszoHiba(null);
    try {
      const r = await ep.totpEnable(kod.replace(/\s/g, ''), jelszoKell ? jelszo : undefined);
      setJelszo('');
      setKodok(r.recoveryCodes);
    } catch (err) {
      if (!ujraHitelesites(err)) setHiba(err instanceof ApiError ? err.message : 'Nem jó a kód.');
    }
  }
  const jelszoMezo = (sugo: boolean) => (
    <label className="mezo">
      <span className="felirat">Mostani jelszó</span>
      <input
        className={jelszoHiba ? 'doboz hibas' : 'doboz'}
        type="password"
        autoComplete="current-password"
        value={jelszo}
        onChange={(e) => {
          setJelszo(e.target.value);
          setJelszoHiba(null);
        }}
      />
      {jelszoHiba ? <span className="hiba-szoveg">{jelszoHiba}</span> : sugo ? <span className="sugo">Biztonsági okból kérjük: több mint 10 perce léptél be.</span> : null}
    </label>
  );
  if (kodok)
    return (
      <div className="oszlop">
        <div className="uzenet-sav siker">
          <div>
            <b>Bekapcsoltad a kétlépcsős belépést.</b> Másold ki, töltsd le vagy nyomtasd ki ezeket a visszaállító kódokat, és tedd el biztos helyre (ne ezen a gépen). Mindegyik egyszer használható. Többet nem mutatjuk.
          </div>
        </div>
        <div className="kod-doboz">{kodok.join('\n')}</div>
        <div className="gombsor">
          <button
            type="button"
            className="gomb-sz"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(kodok.join('\n'));
                setMasolva(true);
              } catch {
                setMasolva(false);
              }
            }}
          >
            {masolva ? 'Kimásolva' : 'Kimásolom'}
          </button>
          <button type="button" className="gomb-sz" onClick={() => letolt(kodok)}>
            Letöltöm (.txt)
          </button>
          <button type="button" className="gomb-sz" onClick={() => nyomtat(kodok)}>
            Kinyomtatom
          </button>
        </div>
        <div className="gombsor">
          <button className="gomb-e" onClick={kesz}>
            Eltettem, tovább
          </button>
        </div>
      </div>
    );
  return (
    <form className="oszlop" onSubmit={bekapcs}>
      {kotelezo && (
        <div className="uzenet-sav figyel">
          {user?.role === 'admin'
            ? 'A tulajdonosi felülethez kétlépcsős belépés kell (a szerver beállítása: STAFF_TOTP_REQUIRED). Ez pár perc.'
            : user?.role === 'csapat'
              ? 'A tulajdonos beállítása szerint az ügyfélszolgálati felülethez kétlépcsős belépés kell. Ez pár perc.'
              : 'A tulajdonos beállítása szerint a könyvelői felülethez kétlépcsős belépés kell. Ez pár perc.'}
        </div>
      )}
      {jelszoKell && !adat && (
        // the key is only issued after the password: one field, one button, then the QR code appears
        <div className="oszlop" style={{ maxWidth: 420 }}>
          <div className="uzenet-sav info">
            <div>Biztonsági okból előbb add meg a mostani jelszavadat: több mint 10 perce léptél be.</div>
          </div>
          {jelszoMezo(false)}
          {hiba && <div className="uzenet-sav hiba">{hiba}</div>}
          <div className="gombsor">
            <button className="gomb-e" type="button" disabled={!jelszo || indul} onClick={() => void indit(jelszo)}>
              {indul ? 'Ellenőrzöm…' : 'Tovább'}
            </button>
          </div>
        </div>
      )}
      {!(jelszoKell && !adat) && (
        <>
      <ol style={{ paddingLeft: 20, display: 'grid', gap: 6 }}>
        <li>Nyisd meg a telefonodon a hitelesítő appot (például Google Authenticator, Microsoft Authenticator vagy 1Password).</li>
        <li>Olvasd be a kódot, vagy írd be kézzel a kulcsot.</li>
        <li>Írd be ide az appban látható 6 számjegyet.</li>
      </ol>
      <div className="sor-flex" style={{ alignItems: 'flex-start', gap: 20 }}>
        {qr ? <img src={qr} width={200} height={200} alt="QR-kód a hitelesítő apphoz" style={{ borderRadius: 12, boxShadow: '0 0 0 1px var(--hajszal)' }} /> : <div style={{ width: 200, height: 200 }} className="betoltes">…</div>}
        <div className="oszlop" style={{ flex: 1 }}>
          <div className="mezo">
            <span className="felirat">Kulcs kézi beíráshoz</span>
            <div className="kod-doboz">{adat?.secret.replace(/(.{4})/g, '$1 ').trim() ?? '…'}</div>
          </div>
          <label className="mezo">
            <span className="felirat">6 számjegyű kód</span>
            <input className="doboz szam" inputMode="numeric" value={kod} onChange={(e) => setKod(e.target.value)} />
          </label>
          {jelszoKell && jelszoMezo(true)}
          {hiba && <div className="uzenet-sav hiba">{hiba}</div>}
          <div className="gombsor">
            <button className="gomb-e" type="submit" disabled={!adat || kod.replace(/\s/g, '').length !== 6 || (jelszoKell && !jelszo)}>
              Bekapcsolom
            </button>
          </div>
        </div>
      </div>
        </>
      )}
    </form>
  );
}

function letolt(kodok: string[]) {
  const szoveg = `${brand.name} – visszaállító kódok (mindegyik egyszer használható)\r\n\r\n${kodok.join('\r\n')}\r\n`;
  const url = URL.createObjectURL(new Blob([szoveg], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-visszaallito-kodok.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function nyomtat(kodok: string[]) {
  // A hidden iframe: no pop-up window, no inline script (CSP), only the codes on the page.
  const f = document.createElement('iframe');
  f.style.position = 'fixed';
  f.style.width = '0';
  f.style.height = '0';
  f.style.border = '0';
  document.body.appendChild(f);
  const d = f.contentDocument;
  if (!d) return f.remove();
  const h = d.createElement('h1');
  h.textContent = `${brand.name} – visszaállító kódok`;
  h.style.font = '600 18px sans-serif';
  const p = d.createElement('pre');
  p.textContent = kodok.join('\n');
  p.style.font = '16px/1.8 monospace';
  d.body.append(h, p);
  f.contentWindow?.focus();
  f.contentWindow?.print();
  setTimeout(() => f.remove(), 1000);
}

export function KotelezoKetlepcsosOldal() {
  const nav = useNavigate();
  const { frissit, kilep, user, betoltve } = useAuth();
  if (betoltve && !user) return <Navigate to="/belepes" replace />;
  return (
    <BelepesKeret>
      <h2>Kétlépcsős belépés</h2>
      <p className="bev">
        {user?.role === 'admin'
          ? 'Az üzleti adatokhoz és a könyvelők kezeléséhez férsz hozzá, ezért a fiókodat egy második lépéssel is védjük.'
          : user?.role === 'csapat'
            ? 'Ügyfelek elérhetőségét és üzeneteit látod, ezért a fiókodat egy második lépéssel is védjük.'
            : 'Ügyfelek adóadatait és okmányait látod, ezért a fiókodat egy második lépéssel is védjük.'}
      </p>
      <div className="lap">
        <KetlepcsosBeallitas
          kotelezo
          kesz={async () => {
            updateUser({ totpEnabled: true });
            await frissit();
            nav('/', { replace: true });
          }}
        />
      </div>
      <p className="halvany kicsi" style={{ marginTop: 14, textAlign: 'center' }}>
        Most nem érsz rá?{' '}
        <button type="button" className="gomb-sz" onClick={() => void kilep().then(() => nav('/belepes', { replace: true }))}>
          Kilépek
        </button>
      </p>
    </BelepesKeret>
  );
}
