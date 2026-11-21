// SPEC §29.9.3–§29.9.6 – /admin/konzol/ugyfelek/:id: the client card with everything we store (one small endpoint per
// section), "Ügyfél szemével" (read-only phone frame), and the actions: header buttons "Üzenet", "Ár", "Zárolás" and
// "Műveletek" (with the v2 chevron). Every action is a dialog with its fields, the reason, the summary and "Megerősítem" (step-up first).
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as k from '../../../api/k29f';
import { adminAccountants, downloadFile } from '../../../api/endpoints';
import { downloadVia } from '../../../api/client';
import {
  CONSOLE_PROFILE_FIELDS,
  CONSOLE_PROFILE_LABELS,
  CONSOLE_NAV_FIELDS,
  CONSOLE_TEXTS,
  PRICE_OVERRIDE_LABELS,
  TERMINATION_KIND_LABELS,
  TERMINATION_SUB_REASON_LABELS,
  type ConsoleClientHeader,
  type ConsoleField,
  type ConsoleSection,
  type ConsoleSectionView,
} from '../../../_shared/k29f';
import { FEE_KIND_LABELS } from '../../../_shared/bekotes';
import { Fejlec, Fiok, HibaSav, Toltes } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { VezerloIkon } from '../../../_shared/v2/web';
import { usePirito } from '../../../ui/Pirito';
import { szam } from '../../../lib/format';
import { today } from '../../../lib/today';
import { LepcsoProvider, MuveletFiok, useLepcsos, type MuveletDef } from './lepcso';
import { AtutalasSzakasz } from './Atutalas';

const W = k.consoleWrite;
const DIJ_FAJTAK = ['eves_zaras', 'valtozas_egyszeru', 'valtozas_jogallas', 'megszuntetes', 'igazolas_jovedelem', 'igazolas_ado', 'igazolas_koma', 'igazolas_ev_kivonat', 'igazolas_egyeb'];
const parseFt = (s: string | null | undefined) => Number(String(s ?? '').replace(/[^\d]/g, '')) || 0;

function muveletek(h: ConsoleClientHeader, accs: { id: string; displayName: string }[], profil: ConsoleSectionView | undefined): Record<string, MuveletDef> {
  const id = h.id;
  const t = today();
  return {
    uzenet: {
      cim: 'Üzenet az ügyfélnek',
      bev: 'Az Üzenetek közé kerül, feladó: Ügyfélszolgálat. Push és értesítés is megy.',
      indok: false,
      mezok: [{ kulcs: 'body', felirat: 'Üzenet', tipus: 'hosszu' }],
      osszegzes: () => `${h.name} megkapja az üzenetet az appban.`,
      kuld: (v) => W('POST', `/clients/${id}/messages`, { body: v.body ?? '' }),
      siker: () => 'Elküldted.',
    },
    ar: {
      cim: 'Ár, kedvezmény, ingyenes hónap',
      bev: 'Emelés csak 30 nap múlva kezdődő időszakra (ÁSZF 6.7) – az ügyfelet értesítjük. Kedvezmény a következő levonástól.',
      indok: true,
      mezok: [
        { kulcs: 'kind', felirat: 'Fajta', tipus: 'valaszto', alap: 'ingyenes_honap', opciok: Object.entries(PRICE_OVERRIDE_LABELS).map(([kk, f]) => ({ kulcs: kk, felirat: f })) },
        { kulcs: 'amountHuf', felirat: 'Havidíj (Ft)', tipus: 'szam', ha: (v) => v.kind === 'egyedi_ar' },
        { kulcs: 'percent', felirat: 'Kedvezmény (%)', tipus: 'szam', ha: (v) => v.kind === 'kedvezmeny_szazalek' },
        { kulcs: 'months', felirat: 'Hány hónap', tipus: 'szam', alap: '1', ha: (v) => v.kind === 'ingyenes_honap' },
        { kulcs: 'fromPeriod', felirat: 'Ettől (időszak kezdete)', tipus: 'datum', alap: t },
        { kulcs: 'untilPeriod', felirat: 'Eddig (nem kötelező)', tipus: 'datum', ha: (v) => v.kind !== 'ingyenes_honap' },
      ],
      osszegzes: (v) =>
        v.kind === 'egyedi_ar' ? `${h.name} havidíja ${szam(Number(v.amountHuf || 0))} Ft lesz ${v.fromPeriod ?? ''}-tól.` : v.kind === 'kedvezmeny_szazalek' ? `${v.percent || '?'}% kedvezmény ${v.fromPeriod ?? ''}-tól.` : `${v.months || '?'} hónapig nem vonunk le havidíjat ${v.fromPeriod ?? ''}-tól.`,
      kuld: (v) =>
        W('POST', `/clients/${id}/price`, {
          kind: v.kind,
          ...(v.kind === 'egyedi_ar' ? { amountHuf: Number(v.amountHuf) } : {}),
          ...(v.kind === 'kedvezmeny_szazalek' ? { percent: Number(v.percent) } : {}),
          ...(v.kind === 'ingyenes_honap' ? { months: Number(v.months) } : {}),
          fromPeriod: v.fromPeriod,
          ...(v.untilPeriod ? { untilPeriod: v.untilPeriod } : {}),
          reason: v.reason ?? '',
        }),
    },
    dij: {
      cim: 'Díj felvétele',
      bev: 'Az ügyfél az appban fizeti ki („Fizetek”). Admin-díjat soha nem vonunk le magától.',
      indok: true,
      mezok: [
        { kulcs: 'kind', felirat: 'Díj', tipus: 'valaszto', alap: 'eves_zaras', opciok: DIJ_FAJTAK.map((kk) => ({ kulcs: kk, felirat: (FEE_KIND_LABELS as Record<string, string>)[kk] ?? kk })) },
        { kulcs: 'amountHuf', felirat: 'Összeg (Ft) – üresen a díjtáblázat szerint', tipus: 'szam' },
        { kulcs: 'note', felirat: 'Mit lát az ügyfél (miért)' },
      ],
      osszegzes: (v) => `${h.name} fizetendő díjat kap: ${(FEE_KIND_LABELS as Record<string, string>)[v.kind ?? ''] ?? v.kind}${v.amountHuf ? `, ${szam(Number(v.amountHuf))} Ft` : ''}.`,
      kuld: (v) => W('POST', `/clients/${id}/fees`, { kind: v.kind, ...(v.amountHuf ? { amountHuf: Number(v.amountHuf) } : {}), note: v.note ?? '', reason: v.reason ?? '' }),
    },
    zarolas: {
      cim: 'Zárolás vagy türelmi idő',
      bev: '„Zárolva”: a könyvelés szünetel. „Türelmi idő”: az automatikus zárolás legfeljebb 30 napig nem kapcsol be.',
      indok: true,
      veszelyes: true,
      mezok: [
        { kulcs: 'mode', felirat: 'Mit?', tipus: 'valaszto', alap: 'zarolva', opciok: [{ kulcs: 'zarolva', felirat: 'Zárolom' }, { kulcs: 'feloldva', felirat: 'Türelmi időt adok' }] },
        { kulcs: 'until', felirat: 'Meddig', tipus: 'datum', sugo: 'Türelmi időnél kötelező (legfeljebb 30 nap).' },
      ],
      osszegzes: (v) => (v.mode === 'feloldva' ? `${h.name}: ${v.until || '?'}-ig nem zárolunk automatikusan.` : `${h.name} könyvelése szünetel${v.until ? ` ${v.until}-ig` : ''}. Az ügyfél ezt látja: „Szünetel a könyvelésed. Írj nekünk, ha kérdésed van.”`),
      kuld: (v) => W('POST', `/clients/${id}/lock`, { mode: v.mode, ...(v.until ? { until: v.until } : {}), reason: v.reason ?? '' }),
    },
    feloldas: {
      cim: 'Kézi zárolás / türelmi idő törlése',
      indok: true,
      mezok: [],
      osszegzes: () => 'Visszaáll az automatikus szabály (fizetés szerint).',
      kuld: (v) => W('DELETE', `/clients/${id}/lock`, { reason: v.reason ?? '' }),
    },
    szunet: {
      cim: 'Szüneteltetés indítása',
      bev: 'A havidíj helyett a rendelkezésre állási díj jár.',
      indok: true,
      mezok: [
        { kulcs: 'from', felirat: 'Ettől', tipus: 'datum', alap: t },
        { kulcs: 'to', felirat: 'Eddig (nem kötelező)', tipus: 'datum' },
      ],
      osszegzes: (v) => `${h.name} szüneteltet ${v.from ?? ''}-tól${v.to ? ` ${v.to}-ig` : ''}.`,
      kuld: (v) => W('POST', `/clients/${id}/pause`, { from: v.from, ...(v.to ? { to: v.to } : {}), reason: v.reason ?? '' }),
    },
    szunetVege: {
      cim: 'Szüneteltetés lezárása',
      indok: true,
      mezok: [{ kulcs: 'lastDay', felirat: 'Az utolsó szünetelő nap', tipus: 'datum', alap: t }],
      osszegzes: (v) => `A szünetelés ${v.lastDay ?? ''}-ig tart, utána újra havidíj.`,
      kuld: (v) => W('POST', `/clients/${id}/pause/close`, { lastDay: v.lastDay, reason: v.reason ?? '' }),
    },
    konyvelo: {
      cim: 'Másik könyvelő',
      bev: 'Az ügyfél és mindkét könyvelő értesítést kap.',
      indok: true,
      mezok: [{ kulcs: 'accountantId', felirat: 'Könyvelő', tipus: 'valaszto', opciok: accs.map((a) => ({ kulcs: a.id, felirat: a.displayName })) }],
      osszegzes: (v) => `${h.name} új könyvelője: ${accs.find((a) => a.id === v.accountantId)?.displayName ?? '?'}.`,
      kuld: (v) => W('POST', `/clients/${id}/accountant`, { accountantId: v.accountantId, reason: v.reason ?? '' }),
    },
    megerosito: {
      cim: 'Megerősítő levél',
      indok: false,
      mezok: [],
      osszegzes: () => `Megerősítő kódot küldünk ${h.email} címre. A kódot te nem látod.`,
      kuld: () => W('POST', `/clients/${id}/send-verification`, {}),
      siker: () => CONSOLE_TEXTS.sendCodeVerify,
    },
    jelszo: {
      cim: 'Jelszó-visszaállító levél',
      indok: false,
      mezok: [],
      osszegzes: () => `Visszaállító kódot küldünk ${h.email} címre. A kódot te nem látod, jelszót nem állítasz.`,
      kuld: () => W('POST', `/clients/${id}/send-password-reset`, {}),
      siker: () => CONSOLE_TEXTS.sendCodeReset,
    },
    export: {
      cim: 'Adatexport (GDPR)',
      bev: 'Minden adata és fájlja egy titkosított ZIP-ben. Elkészülés után egyszer letöltheted; naplózva.',
      indok: true,
      mezok: [],
      osszegzes: () => `${h.name} összes adatát kiexportáljuk.`,
      kuld: (v) => W<{ exportId: string }>('POST', `/clients/${id}/export`, { reason: v.reason ?? '' }),
      siker: () => 'Készül. Ha elkészült, a fejlécben letöltheted.',
    },
    forras: {
      cim: 'Forrásadat törlése (tiltakozás)',
      bev: 'Ha az ügyfél tiltakozik az ellen, hogy megjegyezzük, honnan jött (Adatkezelési tájékoztató 2.11.): a kampányjelölések, a webhely neve, a kezdőoldal és a hirdetési azonosítók törlődnek. Az összesítéshez csak a csatorna marad meg (például „YouTube”). Más nem változik.',
      indok: true,
      mezok: [],
      osszegzes: () => `${h.name} forrásadatának részleteit töröljük; csak a csatorna marad meg.`,
      kuld: (v) => W('POST', `/clients/${id}/source-erase`, { reason: v.reason ?? '' }),
      siker: () => 'Kész: a forrás részletei törölve, csak a csatorna maradt meg.',
    },
    felmondas: {
      cim: 'Felmondás',
      bev: 'ÁSZF 8.5: rendesen 30 nappal; azonnal csak 30 napnál régebbi tartozás vagy más 8.5. ok miatt. Az ügyfél felmondó levelet kap (PDF + e-mail).',
      indok: true,
      veszelyes: true,
      mezok: [
        { kulcs: 'kind', felirat: 'Mód', tipus: 'valaszto', alap: 'rendes', opciok: Object.entries(TERMINATION_KIND_LABELS).map(([kk, f]) => ({ kulcs: kk, felirat: f })) },
        { kulcs: 'subReason', felirat: 'ÁSZF 8.5. ok', tipus: 'valaszto', ha: (v) => v.kind === 'azonnali_mas', opciok: Object.entries(TERMINATION_SUB_REASON_LABELS).map(([kk, f]) => ({ kulcs: kk, felirat: f })) },
        { kulcs: 'when', felirat: 'Mikor?', tipus: 'valaszto', alap: 'idoszak_vege', ha: (v) => v.kind === 'ugyfel_kerte', opciok: [{ kulcs: 'idoszak_vege', felirat: 'A kifizetett időszak végén' }, { kulcs: 'azonnal', felirat: 'Azonnal, időarányos visszautalással' }] },
      ],
      osszegzes: (v) =>
        v.kind === 'rendes'
          ? `${h.name} szerződése 30 nap múlva (vagy a kifizetett időszak végén) szűnik meg. Addig nem vonunk le többet.`
          : v.kind === 'ugyfel_kerte'
            ? v.when === 'azonnal'
              ? `${h.name} szerződése ma megszűnik; a hátralévő napok díját visszautaljuk.`
              : `${h.name} szerződése a kifizetett időszak végén szűnik meg.`
            : `${h.name} szerződése MA megszűnik, a kártyája törlődik.`,
      kuld: (v) => W('POST', `/clients/${id}/terminate`, { kind: v.kind, ...(v.subReason ? { subReason: v.subReason } : {}), ...(v.kind === 'ugyfel_kerte' ? { when: v.when || 'idoszak_vege' } : {}), reason: v.reason ?? '' }),
      siker: (r) => `Felmondva. Hatály: ${(r as { effectiveOn: string }).effectiveOn}.`,
    },
    ujra: {
      cim: 'Újraaktiválás',
      bev: 'Az ügyfél újra elfogadja a szerződést és megadja a kártyáját; a bevezető ott folytatódik.',
      indok: true,
      mezok: [],
      osszegzes: () => `${h.name} fiókja újra él, „Bekötés alatt” állapotban.`,
      kuld: (v) => W('POST', `/clients/${id}/reactivate`, { reason: v.reason ?? '' }),
    },
    anonim: {
      cim: 'Törlés (anonimizálás)',
      bev: h.canAnonymize.ok ? 'A személyes adatai törlődnek; a törvény miatt megőrzendő iratok (díjszámlák, fizetések, adóiratok, azonosítás, napló) maradnak.' : `Most nem lehet: ${h.canAnonymize.blockers.join(' ')}`,
      indok: true,
      veszelyes: true,
      visszavonhatatlan: true,
      mezok: [{ kulcs: 'confirmName', felirat: `Írd be a nevét: ${h.name}` }],
      osszegzes: (v) => ((v.confirmName ?? '').trim().toLowerCase() === h.name.toLowerCase() ? `${h.name} adatait végleg anonimizáljuk.` : 'Írd be pontosan az ügyfél nevét.'),
      kuld: (v) => W('POST', `/clients/${id}/anonymize`, { reason: v.reason ?? '', confirmName: v.confirmName ?? '' }),
    },
    profil: {
      cim: 'Adatok szerkesztése',
      bev: 'Ugyanazok az ellenőrzések, mint az ügyfél űrlapján. Új e-mail-címet az ügyfél erősít meg. Üres mező = nem változik.',
      indok: false,
      mezok: [
        ...CONSOLE_PROFILE_FIELDS.map((f) => {
          const cur = profil?.fields?.find((x) => x.key === f);
          return { kulcs: f, felirat: `${CONSOLE_PROFILE_LABELS[f]}${cur?.nav ? ' (NAV-ból)' : ''}`, sugo: cur?.masked ? `Most: ${cur.value} – csak akkor írd be, ha változik.` : cur?.value ? `Most: ${cur.value}` : undefined };
        }),
        { kulcs: 'confirmNavOverride', felirat: CONSOLE_TEXTS.navOverride, tipus: 'jelolo' as const },
      ],
      osszegzes: (v) => {
        const m = CONSOLE_PROFILE_FIELDS.filter((f) => (v[f] ?? '').trim());
        return m.length ? `Módosul: ${m.map((f) => CONSOLE_PROFILE_LABELS[f]).join(', ')}. Az ügyfél értesítést kap.` : 'Még nem írtál át semmit.';
      },
      kuld: (v) => {
        const fields = Object.fromEntries(CONSOLE_PROFILE_FIELDS.filter((f) => (v[f] ?? '').trim()).map((f) => [f, v[f]!.trim()]));
        const nav = Object.keys(fields).some((f) => (CONSOLE_NAV_FIELDS as readonly string[]).includes(f));
        return W('PATCH', `/clients/${id}/profile`, { fields, ...(v.confirmNavOverride === '1' ? { confirmNavOverride: true } : {}), ...(nav || v.reason ? { reason: v.reason ?? '' } : {}) });
      },
    },
  };
}

function Mezok({ fields, id }: { fields: ConsoleField[]; id: string }) {
  const [nyitott, setNyitott] = useState<Record<string, string | null>>({});
  const pir = usePirito();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', columnGap: 24 }}>
      {fields.map((f) => (
        <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--hajszal)', fontSize: 14.5 }}>
          <span className="halvany">{f.label}</span>
          <span style={{ fontWeight: 550, overflowWrap: 'anywhere' }}>
            {nyitott[f.key] !== undefined ? nyitott[f.key] ?? '–' : f.value ?? <span className="halvany">–</span>}
            {f.nav ? <span className="cimke info" style={{ marginLeft: 6 }}>NAV-ból</span> : null}
            {f.masked && nyitott[f.key] === undefined ? (
              <button
                type="button"
                className="gomb-sz"
                style={{ marginLeft: 6 }}
                onClick={() =>
                  k
                    .consoleReveal(id, f.key)
                    .then((r) => setNyitott((o) => ({ ...o, [f.key]: r.value })))
                    .catch(pir.hiba)
                }
              >
                Mutasd
              </button>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function SzakaszNezet({ h, s, muvelet }: { h: ConsoleClientHeader; s: ConsoleSectionView; muvelet: (def: MuveletDef) => void }) {
  const pir = usePirito();
  const futtat = useLepcsos();
  const sorMuvelet = (a: string, rowId: string, cells: (string | null)[]): MuveletDef | null => {
    if (a === 'visszaterites') {
      const total = parseFt(cells[2]);
      const vissza = parseFt(cells[5]);
      return {
        cim: 'Visszatérítés',
        bev: 'A kártyára megy vissza; teljes összegnél sztornó, részösszegnél helyesbítő számla készül.',
        indok: true,
        veszelyes: true,
        mezok: [{ kulcs: 'amountHuf', felirat: `Összeg (legfeljebb ${szam(total - vissza)} Ft)`, tipus: 'szam', alap: String(total - vissza) }],
        osszegzes: (v) => `${szam(Number(v.amountHuf || 0))} Ft megy vissza ${h.name} kártyájára.`,
        kuld: (v) => k.consoleWrite('POST', `/payments/${rowId}/refund`, { amountHuf: Number(v.amountHuf), reason: v.reason ?? '' }),
      };
    }
    if (a === 'elengedes')
      return { cim: 'Díj elengedése', indok: true, mezok: [], osszegzes: () => `${cells[1]} (${cells[2]}) elengedve – nem kell kifizetni.`, kuld: (v) => k.consoleWrite('POST', `/clients/${h.id}/fees/${rowId}/waive`, { reason: v.reason ?? '' }) };
    if (a === 'levonas_most')
      return {
        cim: 'Levonom a mentett kártyáról',
        bev: 'Csak az ügyfél által megrendelt díjnál, a kártyás engedély alapján.',
        indok: true,
        veszelyes: true,
        mezok: [],
        osszegzes: () => `${cells[2]} levonása most ${h.name} mentett kártyájáról.`,
        kuld: (v) => k.consoleWrite('POST', `/clients/${h.id}/fees/${rowId}/charge-now`, { reason: v.reason ?? '' }),
        siker: (r) => (r as { message?: string }).message ?? CONSOLE_TEXTS.done,
      };
    if (a === 'ar_visszavonas') return { cim: 'Egyedi ár visszavonása', indok: true, mezok: [], osszegzes: () => 'A következő levonástól a díjtáblázat szerinti ár jár.', kuld: (v) => k.consoleWrite('DELETE', `/clients/${h.id}/price/${rowId}`, { reason: v.reason ?? '' }) };
    if (a === 'szamla_ujra') return { cim: 'Díjszámla újrapróbálása', indok: false, mezok: [], osszegzes: () => 'Előbb lekérdezzük, elkészült-e; csak utána állítjuk ki újra.', kuld: () => k.consoleWrite('POST', `/invoices/${rowId}/retry`, {}) };
    return null;
  };
  const MUVELET_FELIRAT: Record<string, string> = { visszaterites: 'Visszatérítés', elengedes: 'Elengedem', levonas_most: 'Levonom most', ar_visszavonas: 'Visszavonom', szamla_ujra: 'Újrapróbálom', megnyitas: 'Megnyitom' };
  return (
    <>
      {s.fields?.length ? (
        <div className="szak">
          <Mezok fields={s.fields} id={h.id} />
        </div>
      ) : null}
      {(s.tables ?? []).map((tb) => (
        <div key={tb.title} className="szak" style={{ padding: 0 }}>
          <div className="szak-fej" style={{ padding: '14px 22px 0' }}>
            <h2 style={{ fontSize: 16 }}>{tb.title}</h2>
          </div>
          {tb.rows.length ? (
            <div className="tabla-gorgo">
              <table className="tabla tomor">
                <thead>
                  <tr>
                    {tb.columns.map((c, i) => (
                      <th key={c} className={i === 0 ? 'elso' : undefined}>
                        {c}
                      </th>
                    ))}
                    <th className="utolso" />
                  </tr>
                </thead>
                <tbody>
                  {tb.rows.map((r, ri) => (
                    <tr key={r.id ?? ri}>
                      {r.cells.map((c, i) => (
                        <td key={i} className={i === 0 ? 'elso nt' : undefined} style={{ maxWidth: 360, overflowWrap: 'anywhere' }}>
                          {/* k7 integrator: a stored file ("/files/<id>") is a PDF button, not a raw path */}
                          {c && /^\/files\/[0-9a-f-]{36}$/.test(c) ? (
                            <button type="button" className="gomb-sz" onClick={() => void downloadFile(c.slice(7), `${r.cells[0] ?? 'irat'}.pdf`)}>
                              PDF
                            </button>
                          ) : (
                            (c ?? <span className="halvany">–</span>)
                          )}
                          {i === 0 && r.chip ? <span className={`cimke ${r.chip === 'Admin' ? 'info' : 'hiba'}`} style={{ marginLeft: 6 }}>{r.chip}</span> : null}
                        </td>
                      ))}
                      <td className="utolso" style={{ whiteSpace: 'nowrap' }}>
                        {(r.actions ?? []).map((a) => (
                          <button
                            key={a}
                            type="button"
                            className="gomb-sz"
                            style={{ marginLeft: 8 }}
                            onClick={() => {
                              if (a === 'megnyitas' && r.id)
                                return void futtat(() => k.consoleDocument(h.id, r.id!))
                                  .then((d) => (d.fileId ? downloadFile(d.fileId, `${d.title}.pdf`) : pir.hibaSzoveg('Nincs fájl.')))
                                  .catch(pir.hiba);
                              const def = r.id ? sorMuvelet(a, r.id, r.cells) : null;
                              if (def) muvelet(def);
                            }}
                          >
                            {MUVELET_FELIRAT[a] ?? a}
                          </button>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="halvany" style={{ padding: '6px 22px 16px' }}>
              Nincs adat.
            </p>
          )}
        </div>
      ))}
      {s.note ? (
        <div className="szak">
          <p className="halvany">{s.note}</p>
        </div>
      ) : null}
    </>
  );
}

function Telefon({ id, nyitva, bezar }: { id: string; nyitva: boolean; bezar: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'console', 'preview', id], queryFn: () => k.consolePreview(id), enabled: nyitva });
  const [ful, setFul] = useState(0);
  const p = q.data;
  return (
    <Fiok nyitva={nyitva} bezar={bezar} ikon="fooldal" cim={CONSOLE_TEXTS.preview} bev={CONSOLE_TEXTS.previewBanner}>
      {q.isPending ? (
        <Toltes />
      ) : q.isError ? (
        <HibaSav hiba={q.error} />
      ) : p ? (
        <div style={{ width: 390, maxWidth: '100%', margin: '0 auto', border: '10px solid #10152B', borderRadius: 36, overflow: 'hidden', background: '#fff' }}>
          <div style={{ background: 'var(--tintakek)', color: '#fff', padding: '18px 16px 14px' }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{CONSOLE_TEXTS.previewBanner}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{p.screens[ful]?.title}</div>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 8, background: '#EEF1FD' }}>
            {p.screens.map((s, i) => (
              <button key={s.key} type="button" className={`gomb-m csak-szoveg${i === ful ? ' on' : ''}`} style={{ height: 32, fontSize: 13, padding: '0 10px', background: i === ful ? '#fff' : undefined }} onClick={() => setFul(i)}>
                {s.title}
              </button>
            ))}
          </div>
          <div>
            {(p.screens[ful]?.lines ?? []).map((l, i) => (
              <div key={i} style={{ padding: '12px 16px', borderTop: i ? '10px solid var(--elvalaszto-sav)' : undefined }}>
                <div style={{ fontSize: 13.5, color: 'var(--halvany)' }}>{l.label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: l.tone === 'bad' ? 'var(--veszely)' : l.tone === 'warn' ? '#7A4B00' : 'var(--tinta)' }}>{l.value}</div>
              </div>
            ))}
            {!p.screens[ful]?.lines.length ? <p className="halvany" style={{ padding: 16 }}>Itt most nincs semmi.</p> : null}
          </div>
        </div>
      ) : null}
    </Fiok>
  );
}

function Tartalom() {
  const { id = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const szakasz = (sp.get('szakasz') as ConsoleSection) || 'profil';
  const qc = useQueryClient();
  const pir = usePirito();
  const futtat = useLepcsos();
  const h = useQuery({ queryKey: ['admin', 'console', 'client', id], queryFn: () => k.consoleClient(id) });
  const s = useQuery({ queryKey: ['admin', 'console', 'section', id, szakasz], queryFn: () => k.consoleSection(id, szakasz) });
  const profil = useQuery({ queryKey: ['admin', 'console', 'section', id, 'profil'], queryFn: () => k.consoleSection(id, 'profil') });
  const accs = useQuery({ queryKey: ['admin', 'accountants'], queryFn: adminAccountants });
  const [def, setDef] = useState<MuveletDef | null>(null);
  const [menu, setMenu] = useState(false);
  const [telefon, setTelefon] = useState(false);
  const [exportId, setExportId] = useState<string | null>(null);
  const exp = useQuery({ queryKey: ['admin', 'console', 'export', exportId], queryFn: () => k.consoleExportState(exportId!), enabled: Boolean(exportId), refetchInterval: (q) => (q.state.data?.status === 'kesz' ? false : 4000) });
  const frissit = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'console'] });
  };
  if (h.isPending) return <Toltes />;
  if (h.isError)
    return (
      <div className="tartalom">
        <HibaSav hiba={h.error} ujra={() => h.refetch()} />
      </div>
    );
  const c = h.data;
  const M = muveletek(c, (accs.data?.items ?? []).map((a) => ({ id: a.id, displayName: a.displayName })), profil.data);
  const nyit = (kulcs: string) => {
    setMenu(false);
    const d = M[kulcs]!;
    if (kulcs === 'export') {
      setDef({ ...d, kuld: async (v) => {
        const r = (await d.kuld(v)) as { exportId: string };
        setExportId(r.exportId);
        return r;
      } });
      return;
    }
    setDef(d);
  };
  const menuElemek: [string, string][] = [
    ['profil', 'Adatok szerkesztése'],
    ['dij', 'Díj felvétele'],
    ['szunet', 'Szüneteltetés indítása'],
    ['szunetVege', 'Szüneteltetés lezárása'],
    ['feloldas', 'Kézi zárolás törlése'],
    ['konyvelo', 'Másik könyvelő'],
    ['megerosito', 'Megerősítő levél'],
    ['jelszo', 'Jelszó-visszaállító levél'],
    ['export', 'Adatexport'],
    ...(c.anonymizedAt ? [] : [['forras', 'Forrásadat törlése'] as [string, string]]),
    ...(c.terminated ? (c.canReactivate ? [['ujra', 'Újraaktiválás'] as [string, string]] : []) : [['felmondas', 'Felmondás'] as [string, string]]),
    ...(c.anonymizedAt ? [] : [['anonim', 'Törlés (anonimizálás)'] as [string, string]]),
  ];
  return (
    <>
      <Fejlec
        felcim={
          <>
            <Link to="/admin/konzol" style={{ color: 'inherit' }}>
              Konzol
            </Link>{' '}
            ›{' '}
            <Link to="/admin/konzol/ugyfelek" style={{ color: 'inherit' }}>
              Ügyfelek
            </Link>
          </>
        }
        cim={c.name}
        mellek={
          <span className="cimkek" style={{ alignItems: 'center' }}>
            <span>{c.email}</span>
            <span className="cimke">{c.lifecycleLabel}</span>
            {c.regime ? <span className="cimke info">{c.regime === 'kata' ? 'Kata' : 'Átalány'}</span> : null}
            {c.accountant ? <span>· {c.accountant.name}</span> : null}
            {c.locked.length ? <span className="cimke hiba">Zárolt ({c.locked.join(', ')})</span> : null}
            {c.manualLock?.mode === 'feloldva' ? <span className="cimke figyel">Türelmi idő {c.manualLock.until}-ig</span> : null}
            {c.terminated ? <span className="cimke figyel">Felmondva · {c.terminated.reasonShort} · {c.terminated.effectiveOn}</span> : null}
            {c.anonymizedAt ? <span className="cimke">Anonimizált</span> : null}
          </span>
        }
        jobb={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', position: 'relative' }}>
            <button type="button" className="gomb-m" onClick={() => setTelefon(true)}>
              <I3 n="fooldal" s={22} /> {CONSOLE_TEXTS.preview}
            </button>
            {!c.anonymizedAt ? (
              <>
                <button type="button" className="gomb-m" onClick={() => nyit('uzenet')}>
                  <I3 n="uzenet" s={22} /> Üzenet
                </button>
                <button type="button" className="gomb-m" onClick={() => nyit('ar')}>
                  <I3 n="cimke" s={22} /> Ár
                </button>
                <button type="button" className="gomb-m" onClick={() => nyit('zarolas')}>
                  <I3 n="lakat" s={22} /> Zárolás
                </button>
                <button type="button" className="gomb-m csak-szoveg" style={{ fontWeight: 750 }} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                  {CONSOLE_TEXTS.actions} <VezerloIkon nev={menu ? 'chev-fel' : 'chev-le'} pt={18} />
                </button>
              </>
            ) : null}
            {menu ? (
              <div className="lap" role="menu" style={{ position: 'absolute', top: 46, right: 0, zIndex: 30, minWidth: 260, padding: 6, boxShadow: '0 8px 30px rgba(16,21,43,.18)' }}>
                {menuElemek.map(([kk, f]) => (
                  <button key={kk} type="button" role="menuitem" className="nav-elem" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', color: kk === 'anonim' || kk === 'felmondas' ? 'var(--veszely)' : undefined }} onClick={() => nyit(kk)}>
                    {f}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        }
        fulek={
          // 15 sections: two rows instead of a hidden horizontal scroll
          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, width: '100%' }}>
            {c.sections.map((x) => (
              <button key={x.key} type="button" className={`ful${szakasz === x.key ? ' on' : ''}`} onClick={() => setSp({ szakasz: x.key }, { replace: true })}>
                {x.label}
              </button>
            ))}
          </div>
        }
      />
      <div className="tartalom">
        {exportId ? (
          <div className="uzenet-sav info" style={{ marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>{exp.data?.status === 'kesz' ? 'Kész az adatexport.' : 'Készül az adatexport…'}</div>
            {exp.data?.status === 'kesz' ? (
              <button type="button" className="gomb-m" onClick={() => void futtat(() => downloadVia(`/admin/console/exports/${exportId}/download`, 'ugyfel-adatai.zip')).catch(pir.hiba)}>
                Letöltöm
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="lap k28">
          {s.isPending ? (
            <div className="szak">
              <Toltes />
            </div>
          ) : s.isError ? (
            <div className="szak">
              <HibaSav hiba={s.error} ujra={() => s.refetch()} />
            </div>
          ) : (
            <SzakaszNezet h={c} s={s.data} muvelet={setDef} />
          )}
        </div>
        {/* k8 ALAP-B: the client's díjbekérők (only shown when there is one or the server has k8) */}
        <div className="lap" style={{ marginTop: 16 }}>
          <AtutalasSzakasz clientId={id} />
        </div>
      </div>
      <MuveletFiok def={def} bezar={() => setDef(null)} kesz={frissit} />
      <Telefon id={id} nyitva={telefon} bezar={() => setTelefon(false)} />
    </>
  );
}

export default function KonzolUgyfelKartya() {
  return (
    <LepcsoProvider>
      <Tartalom />
    </LepcsoProvider>
  );
}
