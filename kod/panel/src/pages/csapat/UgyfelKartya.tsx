// The client card of the service pages (SPEC §26.3, §27.2.5, §27.6.3): contact, onboarding state, accountant, the
// registration and the assisted request, the branch ("Útvonal") with its history, and – for csapat/admin – the
// "Útvonal módosítása" dialog the team uses after a callback (POST /team/clients/:id/path, §27.2.3).
import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { TeamClientCard } from '../../api/types';
import { useAuth } from '../../auth/Auth';
import { Fiok } from '../../ui/kozos';
import { usePirito } from '../../ui/Pirito';
import { ASSIST_KIND_LABELS, ASSIST_STATUS_LABELS, REGISTRATION_STATUS_LABELS, type BusinessStatus, type RegistrationStatus } from '../../_shared/enums';
import { LIFECYCLE_LABEL, MILESTONE_KOVETKEZO } from '../../lib/labels';
import { UTVONAL_CIMKE, nyitottAssist, utvonalSor } from '../../lib/helyettunk';
import { today } from '../../lib/today';

/** A filed bejelentés cannot be undone by a branch change (SPEC §27.2.3: never ignores 'bejelentes_bekuldve'). */
const BEKULDOTT: readonly RegistrationStatus[] = ['beadva', 'javitas', 'ellenorizve', 'kesz'];

export function utvonalNev(c: Pick<TeamClientCard, 'businessStatus' | 'registrationMode'>): string {
  if (!c.businessStatus) return 'Még nem válaszolt';
  if (c.businessStatus === 'inditas') return c.registrationMode === 'segitett' ? 'Most indítja – mi intézzük' : 'Most indítja';
  return UTVONAL_CIMKE.van;
}

/**
 * 11-19 javító kör 2: "következik: …" is the client's OWN next step (his journey's "Most ez jön"), so whoever calls him
 * sees what the app shows him. Older servers without `journeyNext` fall back to the milestone.
 */
export function KovetkezoLepes({ c, halvany = true }: { c: Pick<TeamClientCard, 'journeyNext' | 'milestone'>; /** false: a kék fejlécsávban (ott a szürke nem olvasható) */ halvany?: boolean }) {
  const j = c.journeyNext;
  const osztaly = halvany ? 'halvany' : undefined;
  if (j === undefined) return c.milestone ? <span className={osztaly}> · következik: {MILESTONE_KOVETKEZO[c.milestone]}</span> : null;
  if (!j) return null;
  return (
    <span className={osztaly}>
      {j.title ? (
        <>
          {' '}
          · most ez jön nála: {j.title}
          {j.actorLabel && j.actorLabel !== 'Te' ? ` (${j.actorLabel})` : ''}
        </>
      ) : null}
      {j.waiting ? <> · várunk: {j.waiting}</> : null}
    </span>
  );
}

export function UgyfelKartya({ c, onFrissult, rejtsAssist }: { c: TeamClientCard; onFrissult?: (c: TeamClientCard) => void; rejtsAssist?: boolean }) {
  const { isCsapat, isAdmin, isAccountant } = useAuth();
  return (
    <>
      <dl className="adatok tomor keskeny-adatok">
        <dt>E-mail</dt>
        {/* break after the @ rather than inside the domain */}
        <dd>{c.email.replace('@', `@${String.fromCharCode(0x200b)}`)}</dd>
        {c.phoneMasked && (
          <>
            <dt>Telefon</dt>
            <dd className="szam">{c.phoneMasked}</dd>
          </>
        )}
        <dt>Állapot</dt>
        <dd>
          {LIFECYCLE_LABEL[c.lifecycle]}
          {c.lifecycle === 'bekotes_alatt' && <KovetkezoLepes c={c} />}
        </dd>
        {c.accountant && (
          <>
            <dt>Könyvelője</dt>
            <dd>{c.accountant.name}</dd>
          </>
        )}
        <dt>Útvonal</dt>
        <dd>
          <Utvonal c={c} onFrissult={onFrissult} />
        </dd>
        {c.registration && (
          <>
            <dt>Vállalkozás</dt>
            <dd>
              {(() => {
                // a registration left by a branch change is not "Elállt" (SPEC §27.2.5)
                const felirat =
                  c.registration.status === 'elallt' && (c.registration.pathChanged || c.businessStatus === 'van') ? 'Útvonalat váltott (a kérdőív megmaradt)' : REGISTRATION_STATUS_LABELS[c.registration.status];
                return isCsapat || isAdmin ? <Link to={`/vallalkozas-inditas/${c.registration.id}`}>{felirat}</Link> : felirat;
              })()}
            </dd>
          </>
        )}
        {c.assist && !rejtsAssist && (
          <>
            <dt>Intézzük helyette</dt>
            <dd>
              <Link to={`/helyettunk/${c.assist.id}`}>
                {ASSIST_KIND_LABELS[c.assist.kind]}: {ASSIST_STATUS_LABELS[c.assist.status].toLowerCase()}
              </Link>
              {!nyitottAssist(c.assist.status) && <span className="halvany kicsi"> (lezárt)</span>}
            </dd>
          </>
        )}
      </dl>
      {isAccountant && !isAdmin && !isCsapat && c.lifecycle === 'bekotes_alatt' && (
        <p className="halvany kicsi" style={{ marginTop: 8 }}>Ha az ügyfél rossz választ adott, és már nem tudja maga módosítani, a csapat állítja át hívás után.</p>
      )}
    </>
  );
}

/**
 * Current branch + its history (max 5, newest first) + "Útvonal módosítása" for csapat/admin (SPEC §27.2.5).
 * `valtas`: inside another drawer (the callback drawer) the caller shows the form inline instead of a second drawer.
 */
export function Utvonal({ c, onFrissult, valtas }: { c: TeamClientCard; onFrissult?: (c: TeamClientCard) => void; valtas?: () => void }) {
  const { isCsapat, isAdmin } = useAuth();
  const [valt, setValt] = useState(false);
  const t = today();
  const tortenet = (c.pathHistory ?? []).slice(0, 5);
  const modosithat = (isCsapat || isAdmin) && c.lifecycle === 'bekotes_alatt';
  return (
    <>
      <b>{utvonalNev(c)}</b>
      {modosithat && (
        <>
          {' '}
          <button type="button" className="gomb-sz" style={{ marginLeft: 6 }} onClick={() => (valtas ? valtas() : setValt(true))}>
            Útvonal módosítása
          </button>
        </>
      )}
      {tortenet.length > 0 && (
        <ol className="idovonal halk utvonal-tortenet">
          {tortenet.map((h, i) => (
            <li key={i}>
              {utvonalSor(h, t)}
              {h.note && <div className="halvany kicsi">„{h.note}”</div>}
            </li>
          ))}
        </ol>
      )}
      {!valtas && <UtvonalFiok c={c} nyitva={valt} bezar={() => setValt(false)} kesz={(u) => onFrissult?.(u)} />}
    </>
  );
}

/** State + save of the staff branch change (SPEC §27.2.3). Note 1–500 chars; the server audits 'team.path_changed'. */
export function useUtvonalValtas(c: TeamClientCard, kesz: (c: TeamClientCard) => void) {
  const qc = useQueryClient();
  const pir = usePirito();
  const cel: BusinessStatus = c.businessStatus === 'inditas' ? 'van' : 'inditas';
  const [megj, setMegj] = useState('');
  const [adoszamTorol, setAdoszamTorol] = useState(false);
  const bekuldve = !!c.registration && BEKULDOTT.includes(c.registration.status);
  const tilt =
    c.lifecycle !== 'bekotes_alatt'
      ? 'A bekötése már kész: az útvonal itt nem módosítható.'
      : bekuldve
        ? 'A bejelentése már elment a NAV-hoz, ezt nem lehet visszacsinálni. Javításhoz vagy elálláshoz nyisd meg a Vállalkozás-indításban.'
        : null;
  const ment = useMutation({
    mutationFn: () => ep.teamPathChange(c.id, { businessStatus: cel, note: megj.trim(), clearAdoszam: cel === 'inditas' && adoszamTorol ? true : undefined }),
    onSuccess: (u) => {
      pir.ok(`Átállítottad: ${UTVONAL_CIMKE[cel].toLowerCase()}. Az ügyfél az appban már ezt látja.`);
      setMegj('');
      setAdoszamTorol(false);
      void qc.invalidateQueries({ queryKey: ['team'] });
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
      kesz(u);
    },
    onError: pir.hiba,
  });
  const mehet = !tilt && !!megj.trim() && megj.trim().length <= 500 && !ment.isPending;
  return { c, cel, megj, setMegj, adoszamTorol, setAdoszamTorol, tilt, ment, mehet };
}
export type UtvonalValtas = ReturnType<typeof useUtvonalValtas>;

export function UtvonalGomb({ v }: { v: UtvonalValtas }) {
  return (
    <button className="gomb-e" disabled={!v.mehet} onClick={() => v.ment.mutate()}>
      Átállítom: {UTVONAL_CIMKE[v.cel].toLowerCase()}
    </button>
  );
}

export function UtvonalTorzs({ v }: { v: UtvonalValtas }) {
  const { c, cel, megj, setMegj, adoszamTorol, setAdoszamTorol, tilt } = v;
  return (
    <div className="oszlop" style={{ gap: 14 }}>
      <p>
        Most: <b>{utvonalNev(c)}</b>. Csak hívás után, az ügyfél kérésére állítsd át. Az ügyfél a saját appjában addig maga is módosíthatja, amíg semmi nem ment el a NAV-hoz, és nem adott meg adószámot.
      </p>
      {tilt ? (
        <div className="uzenet-sav figyel">{tilt}</div>
      ) : (
        <>
          <div className="uzenet-sav info">
            <div>
              {cel === 'van' ? (
                <>
                  <b>Átállítás: már van vállalkozása.</b> A vállalkozás-indítása leáll („Útvonalat váltott”), a kérdőívre adott válaszai megmaradnak. Ha még nem küldtük be a meghatalmazást, a „vállalkozás bejelentése” kérése lezárul; ha már beküldtük, meghatalmazásként fut tovább.
                </>
              ) : (
                <>
                  <b>Átállítás: most indítja.</b> Visszakapja a vállalkozás bejelentését: ha korábban elkezdte a kérdőívet, onnan folytatja. A már megadott adatai megmaradnak.
                </>
              )}
            </div>
          </div>
          {cel === 'inditas' && c.businessStatus === 'van' && (
            <label className="jelolo">
              <input type="checkbox" checked={adoszamTorol} onChange={(e) => setAdoszamTorol(e.target.checked)} />
              <span>
                Az adószám nem az övé – törlöm a profilból
                <span className="sugo">Csak ha rossz adószámot írt be. A régi érték a naplóba kerül.</span>
              </span>
            </label>
          )}
          <label className="mezo">
            <span className="felirat">Miért állítod át? (csak mi látjuk, kötelező)</span>
            <textarea
              className="doboz"
              rows={3}
              maxLength={500}
              value={megj}
              placeholder="Például: telefonon kiderült, hogy 2019 óta egyéni vállalkozó, csak rossz gombot nyomott."
              onChange={(e) => setMegj(e.target.value)}
            />
            <span className="sugo">{megj.trim().length}/500 · Ne írj bele jelszót, kódot vagy adóazonosítót.</span>
          </label>
        </>
      )}
    </div>
  );
}

export function UtvonalFiok({ c, nyitva, bezar, kesz }: { c: TeamClientCard; nyitva: boolean; bezar: () => void; kesz: (c: TeamClientCard) => void }) {
  const v = useUtvonalValtas(c, (u) => {
    kesz(u);
    bezar();
  });
  return (
    <Fiok
      nyitva={nyitva}
      bezar={bezar}
      ikon="fiok"
      cim="Útvonal módosítása"
      bev={c.name}
      lab={
        <>
          <UtvonalGomb v={v} />
          <button className="gomb-sz" onClick={bezar}>
            Mégse
          </button>
        </>
      }
    >
      <UtvonalTorzs v={v} />
    </Fiok>
  );
}
