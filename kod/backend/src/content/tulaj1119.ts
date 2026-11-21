// SPEC §27.9.2: editable content defaults of the owner orders of 2026-11-19, generated from kod/shared at start (journey,
// waiting cards, branch change, "Intézzük helyetted", issued-invoice wording, kérdőív/hub/kamara copy, the new step lock)
// plus the texts of the 10 new notification kinds (§27.8) and the §27 rewording of older texts. DB rows in content_texts
// override them; /admin/szovegek edits them with the usual placeholder check. Content keys are lower snake case
// (the admin route accepts /^[a-z0-9_.]{3,80}$/): JOURNEY_TEXTS.bandTodo → `bekotes.ut.band_todo`.
import {
  ASSIST_STATUS_CLIENT_TEXT,
  ASSIST_STATUS_CLIENT_TEXT_MH,
  ASSIST_STEP_LIST,
  ASSIST_TEXTS,
  GUIDE_DRAWN_NOTE,
  HUB_TEXTS,
  INVOICE_WORDING,
  JOURNEY_STEP_TEXTS,
  JOURNEY_TEXTS,
  KAMARA_TEXTS,
  KERDOIV_TEXTS,
  PATH_CHANGE_TEXTS,
  START_MODE_TEXTS,
  STEP_LOCK_DEFAULT_TEXTS,
  WAITING_ESCALATE_CALLBACK_TEXT,
  WAITING_ESCALATE_MESSAGE_TEXT,
  WAITING_ESCALATE_TEXT,
  WAITING_LATE_TEXTS,
  WAITING_MEANWHILE_TEXT,
  WAITING_TEXTS,
} from '../_shared/bekotes.js';
import { ASSIST_CLOSE_REASONS, PATH_CHANGE_BLOCKER_TEXT, PATH_CHANGE_BLOCKERS } from '../_shared/enums.js';

/** "bandTodo" → "band_todo" (content keys are lower snake case). */
export function snake(k: string): string {
  return k.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** {reasonText} of an assist the team closed (client status line "Lezártuk a kérésedet: {reasonText}."). */
const ASSIST_CLOSE_REASON_TEXT: Record<(typeof ASSIST_CLOSE_REASONS)[number], string> = {
  nincs_belepese: 'a jóváhagyáshoz Ügyfélkapu+ vagy DÁP kell, ezt a hívásban megbeszéltük',
  magam_intezem: 'mégis magad intézed',
  nem_ertuk_el: 'többször kerestünk, de nem értünk el',
  utvaltas: 'már van vállalkozásod',
  duplikalt: 'egy másik kérésed alapján intézzük',
  egyeb: 'már nincs rá szükség',
};

/** Journey rows' extra texts that have no shared constant (statuses of special rows, locks of the sequential rows). */
export const JOURNEY_EXTRA_TEXTS = {
  row_kihagyva: 'Nem kell',
  javitas_status: 'Egy dolgot javítanod kell. Megírtuk, mit és hogyan.',
  javitas_gomb: 'Megnézem, mit javítsak',
  zarolt_kerdoiv: 'Előbb add meg az adataidat.',
  zarolt_bejelentes: 'Előbb töltsd ki a kérdőívet.',
  zarolt_bejelentes_segitett: 'Ha engedélyezted, {firstName} beküldi.',
  zarolt_ertesites: 'Ha beküldted a bejelentést, töltsd fel itt a NAV-os értesítést.',
  zarolt_atnezes: 'A feltöltött értesítés után jön.',
  zarolt_vegso: 'Előbb töltsd ki a kérdőívet.',
  zarolt_vegso_tevekenyseg: 'Előbb megírjuk a tevékenységed sorát.',
  zarolt_kamara: 'Az adószámod után jön.',
  zarolt_visszahivas: 'Előbb kérj visszahívást.',
  zarolt_nav_bekotes: 'A NAV-meghatalmazás után {firstName} beköti.',
  ut_status_nincs: 'Válaszolj egy kérdésre',
  // 11-19 javító kör 2: waiting rows say who works on what (the filing itself stays the client's job).
  bejelentes_var_status: 'Előbb megírjuk a tevékenység-sorodat (Csapatunk)',
  bejelentes_var_gomb: 'Útmutató',
  atnezes_adoszam_cim: 'Adószámod',
  atnezes_adoszam_status: 'Átnéztük az értesítést. Most a NAV adja meg az adószámodat',
} as const;

export function tulaj1119Defaults(): Record<string, string> {
  const out: Record<string, string> = {};
  // ---------- journey (§27.4.2) ----------
  for (const [k, v] of Object.entries(JOURNEY_TEXTS)) out[`bekotes.ut.${snake(k)}`] = v;
  for (const [k, v] of Object.entries(JOURNEY_EXTRA_TEXTS)) out[`bekotes.ut.${k}`] = v;
  for (const [step, t] of Object.entries(JOURNEY_STEP_TEXTS)) {
    out[`bekotes.ut.lepes.${step}.cim`] = t.title;
    if (t.time) out[`bekotes.ut.lepes.${step}.ido`] = t.time;
    if (t.actionLabel) out[`bekotes.ut.lepes.${step}.gomb`] = t.actionLabel;
    if (t.timeSegitett) out[`bekotes.ut.lepes.${step}.ido_segitett`] = t.timeSegitett;
    if (t.actionLabelSegitett) out[`bekotes.ut.lepes.${step}.gomb_segitett`] = t.actionLabelSegitett;
  }
  // ---------- waiting cards (§27.4.3) ----------
  for (const [k, v] of Object.entries(WAITING_TEXTS)) {
    out[`bekotes.varakozas.${k}.felso`] = v.kicker;
    out[`bekotes.varakozas.${k}.cim`] = v.title;
    out[`bekotes.varakozas.${k}.szoveg`] = v.body;
    // k8: no turnaround promise – an empty time makes no content key (the row shows no time)
    if (v.time) out[`bekotes.varakozas.${k}.ido`] = v.time;
  }
  out['bekotes.varakozas.eszkalacio'] = WAITING_ESCALATE_TEXT;
  out['bekotes.varakozas.eszkalacio_hivas'] = WAITING_ESCALATE_CALLBACK_TEXT;
  out['bekotes.varakozas.eszkalacio_uzenet'] = WAITING_ESCALATE_MESSAGE_TEXT;
  out['bekotes.varakozas.addig'] = WAITING_MEANWHILE_TEXT;
  for (const [k, v] of Object.entries(WAITING_LATE_TEXTS)) out[`bekotes.varakozas.${k}`] = v;
  // ---------- branch change (§27.2) and the start mode question (§27.3.1) ----------
  for (const [k, v] of Object.entries(PATH_CHANGE_TEXTS)) out[`bekotes.ut.valtas.${snake(k)}`] = v;
  for (const b of PATH_CHANGE_BLOCKERS) out[`bekotes.ut.zarolt.${b}`] = PATH_CHANGE_BLOCKER_TEXT[b];
  out['bekotes.ut.path_required'] = 'Előbb válaszolj a kérdésre: van már egyéni vállalkozásod?';
  for (const [k, v] of Object.entries(START_MODE_TEXTS)) out[`bekotes.ut.mod.${snake(k)}`] = v;
  // ---------- "Intézzük helyetted" (§27.3) ----------
  for (const [k, v] of Object.entries(ASSIST_TEXTS)) out[`helyettunk.${snake(k)}`] = v;
  for (const [k, v] of Object.entries(ASSIST_STATUS_CLIENT_TEXT)) out[`helyettunk.allapot.${k}`] = v;
  // 11-19 javítás: 'egyeztetve' once the client gave everything (contract + data) – the default text is conditional.
  out['helyettunk.allapot.egyeztetve.kesz'] = 'Beszéltünk. {firstName} hamarosan beküldi a meghatalmazást, utána jóváhagyod.';
  for (const [k, v] of Object.entries(ASSIST_STATUS_CLIENT_TEXT_MH)) if (v) out[`helyettunk.allapot.${k}.mh`] = v;
  for (const [kind, list] of Object.entries(ASSIST_STEP_LIST)) list.forEach((x, i) => (out[`helyettunk.lepesek.${kind}.${i + 1}`] = x.text));
  for (const r of ASSIST_CLOSE_REASONS) out[`helyettunk.lezaras_ok.${r}`] = ASSIST_CLOSE_REASON_TEXT[r];
  out['helyettunk.hiba.szerzodes'] = 'Előbb az ügyfélnek el kell fogadnia a szerződést.';
  out['helyettunk.hiba.bejelentes_ugyfel'] = 'A bejelentést {firstName} küldi be. Ha mégis magad küldted be, előbb mondd le a kérést.';
  out['helyettunk.hiba.tevekenyseg'] = 'Előbb megírjuk a tevékenységed sorát.';
  // ---------- issued invoices (§27.5) ----------
  for (const [k, v] of Object.entries(INVOICE_WORDING)) out[`szamlak.${snake(k)}`] = v;
  // ---------- new business (§27.4.4) ----------
  for (const [k, v] of Object.entries(KAMARA_TEXTS)) out[`vallalkozas.kamara.${snake(k)}`] = v;
  for (const [k, v] of Object.entries(KERDOIV_TEXTS)) out[`vallalkozas.kerdoiv.${snake(k)}`] = v;
  for (const [k, v] of Object.entries(HUB_TEXTS)) out[`vallalkozas.kozpont.${snake(k)}`] = v;
  out['vallalkozas.utmutato.rajz_megjegyzes'] = GUIDE_DRAWN_NOTE;
  // 11-19 javító kör 2: the hub while the ÖVTJ line is still being written (no "Kész az útmutatód" next to "ne kezdd el").
  out['vallalkozas.allapot.utmutato_varakozik'] = 'Már átnézheted az útmutatót. A tevékenység-sorodat még megírjuk, utána bejelentheted.';
  // ---------- the new step lock (§27.4.2) ----------
  for (const [k, v] of Object.entries(STEP_LOCK_DEFAULT_TEXTS)) out[k] = v;
  // ---------- §27 rewording of older texts (old texts: tulaj1119_regi.ts) ----------
  out['bekotes.zarolt.nav_bekotes'] = 'Ha megvan az adószámod, {firstName} beköti a kiállított számláidat.';
  out['vallalkozas.hint.jarulek_fo'] = 'Főállásban akkor is fizetsz havonta legalább {amount} járulékot (TB + szocho), ha kevés a bevételed. Negyedévente fizeted.';
  out['vallalkozas.hint.jarulek_fo_kepesites'] =
    'Főállásban akkor is fizetsz havonta legalább {amount} járulékot (TB + szocho), ha kevés a bevételed. Ha a munkádhoz szakképzettség kell, legalább {amountKepesites}. Negyedévente fizeted.';
  out['visszahivas.csalas'] =
    'Telefonon soha nem kérjük a jelszavadat, a belépési kódjaidat vagy a kártyaadataidat, és nem lépünk be helyetted. Ha valaki ezt kéri, tedd le, és írj nekünk az alkalmazásban.';
  // k7b: the only allowed time promise, word for word
  out['notif.callback_received.body'] =
    'A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. A {phoneMasked} számon keresünk. Telefonon soha nem kérjük a jelszavadat, a kódjaidat vagy a kártyaadataidat, és nem lépünk be helyetted.';
  out['notif.registration_done.body'] = 'Rögzítettük az adószámodat. Jöhet a következő lépés.';
  out['notif.registration_done.kamara.title'] = 'Elindult a vállalkozásod!';
  out['notif.registration_done.kamara.body'] = 'Rögzítettük az adószámodat. Jöhet a következő lépés. Ne felejtsd el a kamarai regisztrációt: {hatarido}.';
  out['notif.registration_checked.body'] = 'Átnéztük a NAV-os értesítést. Ha megjött az adószámod, írd be az alkalmazásban.';
  // 11-19 javítás: the assisted client (mode 'segitett') – our accountant filed it, we record the adószám.
  out['notif.registration_checked.segitett.title'] = 'Átnéztük a bejelentésedet';
  out['notif.registration_checked.segitett.body'] = 'Átnéztük a NAV-os értesítést. Ha megjön az adószámod, rögzítjük, és szólunk.';
  out['notif.registration_reminder.tevekenyseg_segitett.title'] = 'Kiválasztottuk a tevékenységed kódját';
  out['notif.registration_reminder.tevekenyseg_segitett.body'] = 'Nézd át az adataidat, és engedélyezd a bejelentést. Utána {firstName} beküldi. A NAV-os űrlapot nem kell kitöltened.';
  out['notif.registration_reminder.adatlap.title'] = 'Folytasd a kérdőívet';
  out['notif.registration_submitted.title'] = '{clientName} feltöltötte a NAV-os értesítést';
  // ---------- notifications of §27.8 ----------
  const n = (kind: string, title: string, body: string, variant?: string) => {
    const k = variant ? `notif.${kind}.${variant}` : `notif.${kind}`;
    out[`${k}.title`] = title;
    out[`${k}.body`] = body;
  };
  // k7b (SZOVEG_JAVITAS_LEVELEK 11, 12, 23–26): the client learns what the meghatalmazás is for and what the ONYA is
  n('assist_started', 'Beszéltünk – így haladunk', 'Ha megadtad az adataidat és elfogadtad a szerződést, {firstName} beküldi a NAV-nak a meghatalmazást, hogy a nevedben intézhesse az ügyeidet. Utána értesítést kapsz, és 4 napod lesz jóváhagyni.');
  n('assist_mh_filed', 'Hagyd jóvá a meghatalmazást {hatarido}', '{firstName} beküldte a NAV-nak, hogy intézhesse helyetted a NAV-os ügyeidet. Hagyd jóvá a NAV online felületén (ONYA), lépésről lépésre megmutatjuk.');
  n('assist_mh_reminder', 'Még nem hagytad jóvá a meghatalmazást', 'Még {hatarido} van időd. A NAV online felületén (ONYA) hagyod jóvá, az appban megmutatjuk, hogyan.');
  n('assist_mh_reminder', 'Még nem hagytad jóvá a meghatalmazást', 'Még {hatarido} van időd. A NAV online felületén (ONYA) hagyod jóvá, az appban megmutatjuk, hogyan.', 'elso');
  n('assist_mh_reminder', 'Ma hagyd jóvá a meghatalmazást', 'Ma van az utolsó nap: lépj be a NAV online felületére (ONYA), és hagyd jóvá. Ha ma kimarad, a NAV törli a kérést, és újra kell kezdeni.', 'utolso_nap');
  n('assist_mh_expired', 'Újra beküldjük a meghatalmazást', 'A 4 nap alatt nem érkezett jóváhagyás, ezért a NAV törölte a meghatalmazást. {firstName} újra beküldi, és szólunk, amikor jóváhagyhatod.');
  n('assist_consent_needed', 'Él a meghatalmazás – nézd át az adataidat', 'Ha rendben vannak, engedélyezd a bejelentést.');
  n('assist_consent_needed', 'Engedélyezd újra a bejelentést', 'Módosult a kérdőív, ezért nézd át újra.', 'ujra');
  n('assist_ev_filed', 'Bejelentettük a vállalkozásodat!', 'Elment a NAV-hoz. Rögzítjük az adószámodat, és szólunk.');
  n('kamara_reminder', 'Ne felejtsd el: kamarai regisztráció', '{hatarido} regisztrálj a kamaránál.');
  n('assist_task', 'Küldd be a meghatalmazást: {clientName}', 'Egyeztettünk vele. UJEGYKE meghatalmazottként: {ugycsoportok}.');
  n('assist_task', 'Küldd be a meghatalmazást: {clientName}', 'Egyeztettünk vele. UJEGYKE meghatalmazottként: {ugycsoportok}.', 'ujegyke');
  n('assist_task', 'Jóváhagyta: {clientName}', 'Nézd meg az ONYA-ban, hogy él-e a meghatalmazás.', 'ellenorzes');
  n('assist_task', 'Beküldheted: {clientName} bejelentése', 'Engedélyezte a bejelentést. Küldd be a Vállalkozói Ügysegédben, meghatalmazottként.', 'bejelentes');
  n('assist_task', 'Küldd be újra a meghatalmazást: {clientName}', '4 napon belül nem lett jóváhagyva, ezért a NAV törölte.', 'ujra');
  n('assist_task', 'Nézd meg most: él-e {clientName} meghatalmazása?', 'Jelezte, hogy jóváhagyta, de a NAV 4 napja letelt. Nézd meg az ONYA-ban: ha él, „Él a meghatalmazás”; ha nem, „Nem él – a NAV törölte”, és küldd be újra.', 'ellenorzes_kesik');
  n('assist_task', 'Nézd át: {clientName} bejelentése', '{firstName} beküldte. Ellenőrizd az értesítést, és rögzítsd az adószámot.', 'atnezes');
  n('assist_approval_overdue', 'Ma jár le a jóváhagyás: {clientName}', 'Még nem hagyta jóvá. Hívd fel.');
  // 11-19 javító kör 2: our own step is late (daily, working days 09:00).
  n('assist_task', 'Késik: {clientName} – {what}', 'Lejárt a határidőnk, az ügyfél várja. Intézd ma, vagy írj neki, mikor lesz kész.', 'kesik');
  n('client_path_changed', '{clientName} módosította a válaszát', 'Van már vállalkozása? Eddig: „{fromLabel}”, most: „{toLabel}”.');
  return out;
}

/** SPEC §26.8.1 / §27.9.2: placeholders allowed per new content group (an admin may use them even where the default does not). */
export const GROUP_PLACEHOLDERS_1119: [string, string[]][] = [
  ['bekotes.ut.', ['firstName', 'n', 'remaining', 'actor', 'date', 'hatarido', 'days', 'title', 'reason']],
  ['bekotes.varakozas.', ['firstName', 'hatarido', 'title', 'phoneMasked', 'date']],
  ['helyettunk.', ['firstName', 'accountantName', 'hatarido', 'date', 'days', 'reasonText', 'kozossegi', 'phoneMasked']],
  ['szamlak.', ['n', 'sum']],
  ['vallalkozas.kamara.', ['hatarido', 'date']],
  ['vallalkozas.kerdoiv.', ['startText', 'afaLimit']],
  ['vallalkozas.kozpont.', ['n', 'i']],
];
