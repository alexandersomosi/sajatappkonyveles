// SPEC §26.8.1: editable content defaults of the owner orders of 2026-11-18, generated from kod/shared at start
// (explainers, restricted-mode reasons, registration and callback texts). DB rows in content_texts override them;
// /admin/szovegek edits them with the usual placeholder check. Notification texts live in defaults.hu.json.
import { ONBOARDING_EXPLAINERS } from '../_shared/bekotes.js';
import { GROUP_PLACEHOLDERS_1119 } from './tulaj1119.js';
import { GROUP_PLACEHOLDERS_K28 } from './k28.js';
import { CALLBACK_CLOSE_REASONS, CLIENT_FEATURE_RULES, CLIENT_FEATURES, REGISTRATION_STATUS_CLIENT_TEXT, REGISTRATION_STATUSES } from '../_shared/enums.js';

/** Client wording of the callback states (SPEC §26.2.6). */
export const CALLBACK_STATUS_TEXT_DEFAULTS = {
  uj: 'Megkaptuk. Kollégánk 24–48 órán belül hív a {phoneMasked} számon.',
  folyamatban: '{staffFirstName} intézi a kérésedet. Hamarosan hív.',
  most_hiv: 'Most hív kollégánk, {staffFirstName}. Ha nem tudod felvenni, újra próbáljuk.',
  nem_ert_el: '{when} kerestünk, de nem értünk el. Újra próbáljuk.',
  hibas_szam: 'Nem értünk el a megadott számon. Írd be a jó számot, és újra hívunk.',
  kesobb: 'Megbeszéltük, hogy {when} körül hívunk újra.',
  lejart: 'Sajnáljuk, hogy még nem hívtunk. Hamarosan jelentkezünk.',
  teljesitve: 'Beszéltünk {when}. Ha még kérdésed van, írj nekünk.',
  sikertelen: 'Háromszor kerestünk, de nem értünk el. Írj nekünk üzenetet, vagy kérj új visszahívást.',
  visszavonva: 'Lemondtad a visszahívást.',
  lezarva: 'Lezártuk a kérésedet: {reasonText}.',
  regi_idopont: 'Kollégánk {when} körül hív a {phoneMasked} számon, ahogy korábban egyeztettük.',
} as const;
export type CallbackStatusTextKey = keyof typeof CALLBACK_STATUS_TEXT_DEFAULTS;

/** {reasonText} of a callback closed without a call. */
const CLOSE_REASON_TEXT: Record<(typeof CALLBACK_CLOSE_REASONS)[number], string> = {
  megoldva_uzenetben: 'üzenetben válaszoltunk',
  duplikalt: 'egy másik kérésed alapján intézzük',
  ugyfel_kerte: 'a kérésedre',
  egyeb: 'már nincs rá szükség',
};

export function generatedDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of ONBOARDING_EXPLAINERS) {
    out[`bekotes.magyarazat.${e.key}.cim`] = e.title;
    out[`bekotes.magyarazat.${e.key}.mi`] = e.what;
    out[`bekotes.magyarazat.${e.key}.miert`] = e.why;
    out[`bekotes.magyarazat.${e.key}.hol`] = e.where;
  }
  for (const f of CLIENT_FEATURES) {
    const reason = CLIENT_FEATURE_RULES[f].reason;
    if (reason) out[`korlatozott.${f}`] = reason;
  }
  out['korlatozott.aktivalas_hint'] = 'Még {n} lépés, és minden megnyílik.';
  out['korlatozott.aktivalas_hint_reszlet'] = 'Még {n} lépés, és minden megnyílik. Ebből {m} a tiéd, a többi a mi dolgunk.';
  out['korlatozott.aktivalas_hint_mienk'] = 'Még {n} lépés, és minden megnyílik. Ezek már a mi dolgunk: szólunk, ha kész.';
  out['bekotes.zarolt.bejelentes_utan'] = 'Ha beküldted a bejelentést, ez is megnyílik.';
  out['bekotes.zarolt.elofizetes_adoszam_utan'] = 'Akkor kérjük a kártyádat, ha már megvan az adószámod. Addig minden ingyenes.';
  out['bekotes.zarolt.nav_bekotes'] = 'Ha megvan az adószámod, a könyvelőd beköti a számláidat.';
  // round 1 (2026-11-19): the meghatalmazás opens after the megbízási szerződés; nobody pays before the branch question
  out['bekotes.zarolt.szerzodes_utan'] = 'Előbb fogadd el a megbízási szerződést. Utána megmutatjuk, kinek és hogyan adsz meghatalmazást.';
  out['adatok.stop.nem_afamentes'] =
    'Ez az adószám nem alanyi ÁFA-mentes vállalkozásé (a középső számjegye nem 1). Szolgáltatásunk most az ÁFA-mentes egyéni vállalkozóknak szól. Nézd meg még egyszer, vagy kérj visszahívást, és megbeszéljük.';
  out['bekotes.zarolt.elagazas'] = 'Előbb válaszolj: van már egyéni vállalkozásod? Utána megmutatjuk, mikor jön az előfizetés.';
  for (const s of REGISTRATION_STATUSES) out[`vallalkozas.allapot.${s}`] = REGISTRATION_STATUS_CLIENT_TEXT[s];
  out['vallalkozas.stop.tobb_20m'] =
    'Ennyi bevétel mellett nem lehetsz alanyi ÁFA-mentes. Szolgáltatásunk most az ÁFA-mentes egyéni vállalkozóknak szól. Ha kérdésed van, kérj visszahívást.';
  out['vallalkozas.stop.kizaro_ok'] = 'Ha a felsoroltak közül valami igaz rád, most nem lehetsz egyéni vállalkozó. Ha bizonytalan vagy, kérj visszahívást, és megbeszéljük.';
  out['vallalkozas.stop.mar_van_vallalkozas'] = 'Egyszerre csak egy egyéni vállalkozásod lehet. Ha már van, válaszd azt, hogy „Mégis van vállalkozásom”.';
  out['vallalkozas.hint.koltseghanyad'] = 'A tevékenységed alapján a költséghányadod várhatóan {ratio}%. 2027-től az általános költséghányad 50%. {firstName} megerősíti.';
  out['vallalkozas.hint.koltseghanyad_kulonleges'] = 'A tevékenységed alapján a költséghányadod várhatóan {ratio}%. {firstName} megerősíti.';
  out['vallalkozas.hint.koltseghanyad_konyvelo'] = 'A költséghányadot {firstName} mondja meg.';
  out['vallalkozas.hint.jarulek_fo'] = 'Főállásban akkor is fizetsz havonta legalább {amount} járulékot (TB + szocho), ha kevés a bevételed. Negyedévente egyben utalod.';
  out['vallalkozas.hint.jarulek_mellek'] = 'Mellékállásban nincs legkisebb járulék: csak a tényleges jövedelmed után fizetsz.';
  out['vallalkozas.hint.jarulek_nyugdij'] = 'Saját jogú nyugdíjasként nem fizetsz TB-járulékot és szochót, csak SZJA-t a tényleges jövedelmed után.';
  out['vallalkozas.utmutato.elavult'] = '2027-től a vállalkozások nyilvántartását a kamara vezeti. Ezt az útmutatót frissítjük. Addig kérj visszahívást, és segítünk.';
  out['vallalkozas.adoszam.nem_afamentes'] = 'Ez az adószám nem ÁFA-mentes vállalkozásé. Nézd meg még egyszer, vagy írj nekünk.';
  out['visszahivas.igeret'] = 'Kollégánk 24–48 órán belül felhív. Munkanapokon 9 és 17 óra között telefonálunk. Nem feltétlenül {firstName} hív elsőként, hanem valaki a csapatunkból.';
  out['visszahivas.hivoszam'] = 'Erről a számról hívunk: {callerId}';
  out['visszahivas.csalas'] = 'Telefonon soha nem kérjük a jelszavadat, a belépési kódjaidat vagy a kártyaadataidat. Ha valaki ezt kéri, tedd le, és írj nekünk az alkalmazásban.';
  out['visszahivas.adatkezeles'] = 'A megadott számon ezzel a kéréssel kapcsolatban hívunk. A hívásról rövid jegyzetet írunk, a hívást nem rögzítjük. Részletek az Adatkezelési tájékoztatóban.';
  out['visszahivas.toast'] = 'Megkaptuk. Kollégánk 24–48 órán belül hív.';
  for (const [k, v] of Object.entries(CALLBACK_STATUS_TEXT_DEFAULTS)) out[`visszahivas.allapot.${k}`] = v;
  for (const [k, v] of Object.entries(CLOSE_REASON_TEXT)) out[`visszahivas.lezaras_ok.${k}`] = v;
  out['visszahivas.regi_idopont_megjegyzes'] = 'Korábban egyeztetett hívás: {date} {time} ({channel})';
  return out;
}

/** SPEC §26.8.1: placeholders allowed per content group (an admin may use them even where the default does not). */
const GROUP_PLACEHOLDERS: [string, string[]][] = [
  ['bekotes.magyarazat.', ['firstName', 'havidij']],
  ['korlatozott.', ['firstName', 'n', 'm']],
  ['vallalkozas.', ['firstName', 'ratio', 'amount', 'amountKepesites', 'hatarido']],
  ['visszahivas.', ['firstName', 'callerId', 'phoneMasked', 'staffFirstName', 'when', 'reasonText']],
];
export function groupPlaceholders(key: string): string[] {
  return [...GROUP_PLACEHOLDERS_K28, ...GROUP_PLACEHOLDERS_1119, ...GROUP_PLACEHOLDERS].find(([p]) => key.startsWith(p))?.[1] ?? [];
}
