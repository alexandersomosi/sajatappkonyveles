// k8 ALAP-B – the ONE e-mail template of every system mail (dizajn/email/sablon.html + elemek.md, owner-approved 11-20):
// blue header with the logo, white rounded card on grey, yellow button with dark text (max. one per mail; Outlook VML
// button), the footer outside the card. The template is copied here as a constant so it is part of the Docker image.
//  - Every value goes through esc(); ty() keeps the article and number + unit together (non-breaking space).
//  - "Adózz.hu" is ALWAYS a whole, explicit link (<a href="https://adozz.hu" …>Adózz.hu</a>) – mail clients otherwise link
//    "zz.hu" only (the "ó"), see K8_TERV "Próbalevél tanulságai". Never inside an existing <a>, never in <title> / preview.
//  - No large pale pastel box (owner rule): the tip and info blocks are white with a 4 px solid left bar.
//  - Mails without a structured `Level` are built from their plain text (paragraphs, a lone 6-digit code → code block,
//    a lone URL → the button or a link), so every mail gets the new look; the text/plain part stays the plain text.
import brand from '../_shared/brand.json' with { type: 'json' };
import { MAIL_BRAND_URL, MAIL_LOGO_URL, type MailFooterKind } from '../_shared/k8.js';

const F = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const C_TEXT = '#10152B';
const C_GREY = '#5B6478';
const C_BLUE = '#1428DB';
const NBSP = ' ';

export function esc(s: string | number): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Hungarian typography: the article "a"/"az" never ends a line; a number stays with its unit. */
export function ty(t: string): string {
  return String(t)
    .replace(/(^|[\s(>])([Aa]z?) /g, `$1$2${NBSP}`)
    .replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NBSP}`)
    .replace(/(\d) (?=óra|órán|percig|perc|Ft|nap)/g, `$1${NBSP}`);
}

/** "Adózz.hu" → the explicit brand link (input is already escaped HTML text without tags). */
export function brandLink(escapedText: string, color: string): string {
  // review A3: never inside a link that is already there (an URL holding "Adózz.hu" stays one link)
  return escapedText
    .split(/(<a\b[^>]*>[\s\S]*?<\/a>)/)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/Adózz\.hu/g, `<a href="${MAIL_BRAND_URL}" style="color:${color};text-decoration:none;">Adózz.hu</a>`)))
    .join('');
}

/** Bare URLs in an escaped text → links (the URL text stays as it is). */
function autoLink(escapedText: string): string {
  return escapedText.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" style="color:${C_BLUE};text-decoration:underline;">${u}</a>`);
}

/** Escaped, typographic, linked text of a block (user data is always escaped first). */
function txt(s: string, color: string): string {
  return brandLink(autoLink(ty(esc(s))), color).replace(/\n/g, '<br>');
}

const blokk = (pad: string, belso: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:${pad};">${belso}</td></tr></table>`;

/** The building blocks of {{tartalom}} (elemek.md). */
export type Blokk =
  | { t: 'p'; s: string }
  | { t: 'kicsi'; s: string }
  | { t: 'kod'; kod: string }
  | { t: 'kv'; sorok: [string, string, boolean?][] }
  | { t: 'tipp'; s: string }
  | { t: 'info'; s: string }
  | { t: 'link'; s: string; href: string };

export function blokkHtml(b: Blokk): string {
  switch (b.t) {
    case 'p':
      return `<p style="margin:0 0 16px 0;font-family:${F};font-size:16px;line-height:25px;mso-line-height-rule:exactly;color:${C_TEXT};">${txt(b.s, C_TEXT)}</p>`;
    case 'kicsi':
      return `<p style="margin:0 0 16px 0;font-family:${F};font-size:14px;line-height:22px;mso-line-height-rule:exactly;color:${C_GREY};">${txt(b.s, C_GREY)}</p>`;
    case 'kod': {
      const k = esc(b.kod.replace(/\s+/g, ''));
      const shown = /^\d{6}$/.test(k) ? `${k.slice(0, 3)}&nbsp;${k.slice(3)}` : k;
      return blokk(
        '4px 0 20px 0',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#F3F5FB" style="background-color:#F3F5FB;border:1px solid #ECEFF6;border-radius:12px;padding:18px 12px;"><div class="kod" style="font-family:${F};font-size:36px;line-height:44px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:6px;color:${C_BLUE};padding-left:6px;">${shown}</div></td></tr></table>`,
      );
    }
    case 'kv':
      return blokk(
        '4px 0 20px 0',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECEFF6;">${b.sorok
          .map(
            ([k, v, kiemel]) =>
              `<tr><td class="kv-kulcs" valign="top" style="padding:11px 12px 11px 0;border-bottom:1px solid #ECEFF6;font-family:${F};font-size:14px;line-height:21px;mso-line-height-rule:exactly;color:${C_GREY};width:38%;">${txt(k, C_GREY)}</td><td class="kv-ertek" valign="top" align="right" style="padding:11px 0;border-bottom:1px solid #ECEFF6;font-family:${F};font-size:${kiemel ? 18 : 15}px;line-height:21px;mso-line-height-rule:exactly;font-weight:${kiemel ? 700 : 600};color:${C_TEXT};text-align:right;">${txt(v, C_TEXT)}</td></tr>`,
          )
          .join('')}</table>`,
      );
    case 'tipp':
      return blokk(
        '4px 0 20px 0',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid #ECEFF6;border-left:4px solid #FFC93C;border-radius:8px;padding:14px 16px;font-family:${F};font-size:14px;line-height:22px;mso-line-height-rule:exactly;color:${C_TEXT};"><strong>Tipp:</strong> ${txt(b.s, C_TEXT)}</td></tr></table>`,
      );
    case 'info':
      return blokk(
        '4px 0 20px 0',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid #ECEFF6;border-left:4px solid ${C_BLUE};border-radius:8px;padding:14px 16px;font-family:${F};font-size:14px;line-height:22px;mso-line-height-rule:exactly;color:${C_TEXT};">${txt(b.s, C_TEXT)}</td></tr></table>`,
      );
    case 'link':
      return `<p style="margin:0 0 16px 0;font-family:${F};font-size:14px;line-height:22px;mso-line-height-rule:exactly;"><a href="${esc(b.href)}" style="color:${C_BLUE};text-decoration:underline;">${ty(esc(b.s))}</a></p>`;
  }
}

/** A structured mail. `gomb` = the ONE main button; `link` = a smaller link under it. */
export interface Level {
  /** The hidden preview line next to the subject in the inbox (default: the first paragraph). */
  elonezet?: string;
  /** Heading and <title> (default: the subject). */
  cim: string;
  blokkok: Blokk[];
  gomb?: { szoveg: string; link: string } | null;
  link?: { szoveg: string; cel: string } | null;
  /** Why the reader got it (a kind, or a ready sentence). */
  lablec: MailFooterKind | { szoveg: string };
}

export const LABLEC_OK: Record<MailFooterKind, string> = {
  ugyfel: 'Ezt a levelet azért kaptad, mert az Adózz.hu-n van fiókod.',
  munkatars: 'Ezt a levelet azért kaptad, mert az Adózz.hu munkatársa vagy. Ügyféladatot ne továbbíts belőle.',
  fiok_nelkul: 'Ezt a levelet azért kaptad, mert ezzel az e-mail-címmel regisztrálni próbáltak az Adózz.hu-n.',
  kod: 'Ezt a levelet azért kaptad, mert ezzel az e-mail-címmel kódot kértek az Adózz.hu-n.',
  visszahivas: 'Ezt a levelet azért kaptad, mert visszahívást kértél tőlünk.',
};

const PREHEADER_FILL = '&#847;&zwnj;&nbsp;'.repeat(40);

/** The template (dizajn/email/sablon.html, 2026-11-20 20:21) with the company line from brand.json. */
function sablon(): string {
  const p = brand.provider as { legalName: string; seat: string; taxNumber: string; supportEmail?: string };
  const support = p.supportEmail && /@/.test(p.supportEmail) ? p.supportEmail : 'ugyfelszolgalat@adozz.hu';
  return `<!doctype html>
<html lang="hu" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<title>{{cim_title}}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
  @media only screen and (max-width: 620px) {
    .kulso { padding: 16px 16px 24px 16px !important; }
    .fejlec { padding: 20px 20px !important; }
    .torzs { padding: 24px 20px 28px 20px !important; }
    .cim { font-size: 22px !important; line-height: 28px !important; }
    .kod { font-size: 32px !important; letter-spacing: 4px !important; padding-left: 4px !important; }
    .kv-kulcs { display: block !important; width: 100% !important; padding-bottom: 0 !important; border-bottom: 0 !important; }
    .kv-ertek { display: block !important; width: 100% !important; text-align: left !important; padding-top: 2px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .lablec, .lablec a { color: #9AA3B8 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#F3F5FB;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{{elonezet}}${PREHEADER_FILL}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F5FB;">
<tr><td align="center" class="kulso" style="padding:32px 16px 40px 16px;">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
  <tr><td bgcolor="${C_BLUE}" style="background-color:${C_BLUE};border-radius:16px 16px 0 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="fejlec" align="left" style="padding:24px 32px;">
        <a href="${MAIL_BRAND_URL}" style="text-decoration:none;"><img src="${MAIL_LOGO_URL}" width="170" height="46" alt="Adózz.hu" style="display:block;border:0;outline:none;text-decoration:none;width:170px;height:46px;font-family:${F};font-size:24px;font-weight:bold;color:#ffffff;"></a>
      </td>
    </tr></table>
  </td></tr>
  <tr><td class="torzs" bgcolor="#FFFFFF" style="background-color:#FFFFFF;border-radius:0 0 16px 16px;padding:32px 32px 36px 32px;font-family:${F};font-size:16px;line-height:25px;mso-line-height-rule:exactly;color:${C_TEXT};">
    <h1 class="cim" style="margin:0 0 16px 0;font-family:${F};font-size:24px;line-height:31px;mso-line-height-rule:exactly;font-weight:700;color:${C_TEXT};">{{cim}}</h1>
    {{tartalom}}
    {{#gomb}}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="left" style="padding:12px 0 4px 0;">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{gomb_link}}" style="height:48px;v-text-anchor:middle;width:300px;" arcsize="25%" stroke="f" fillcolor="#FFC93C"><w:anchorlock/><center style="color:#10152B;font-family:'Segoe UI',Arial,sans-serif;font-size:16px;font-weight:bold;">{{gomb_szoveg}}</center></v:roundrect><![endif]-->
      <!--[if !mso]><!-->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#FFC93C" style="background-color:#FFC93C;border-radius:12px;"><a href="{{gomb_link}}" style="display:inline-block;padding:14px 28px;font-family:${F};font-size:16px;line-height:20px;font-weight:700;color:#10152B;text-decoration:none;border-radius:12px;">{{gomb_szoveg}}</a></td></tr></table>
      <!--<![endif]-->
    </td></tr></table>
    {{/gomb}}
    {{#link}}
    <p style="margin:18px 0 0 0;font-family:${F};font-size:14px;line-height:22px;mso-line-height-rule:exactly;"><a href="{{link_cel}}" style="color:${C_BLUE};text-decoration:underline;">{{link_szoveg}}</a></p>
    {{/link}}
  </td></tr>
  <tr><td class="lablec" align="center" style="padding:24px 16px 0 16px;font-family:${F};font-size:12px;line-height:19px;mso-line-height-rule:exactly;color:${C_GREY};text-align:center;">
    <p style="margin:0 0 6px 0;"><a href="${MAIL_BRAND_URL}" style="color:${C_GREY};text-decoration:none;font-weight:700;">Adózz.hu</a> &ndash; ${esc(p.legalName)} &middot; <span style="white-space:nowrap;">${esc(p.seat)}</span> &middot; <span style="white-space:nowrap;">Adószám: ${esc(p.taxNumber)}</span></p>
    <p style="margin:0 0 6px 0;">Kérdésed van? Írj nekünk: <a href="mailto:${esc(support)}" style="color:${C_BLUE};text-decoration:underline;">${esc(support)}</a></p>
    <p style="margin:0;">{{lablec_ok}}</p>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
}

let SABLON: string | null = null;

/** The whole HTML mail of a `Level`. */
export function renderLevel(l: Level): string {
  SABLON ??= sablon();
  let h = SABLON;
  const blokkja = (nev: string, van: boolean) => {
    h = h.replace(new RegExp(String.raw`\{\{#${nev}\}\}([\s\S]*?)\{\{/${nev}\}\}`), van ? '$1' : '');
  };
  // max. one main button (elemek.md); the secondary link only next to it or alone
  const gomb = l.gomb && l.gomb.szoveg && l.gomb.link ? l.gomb : null;
  const link = l.link && l.link.szoveg && l.link.cel ? l.link : null;
  blokkja('gomb', Boolean(gomb));
  blokkja('link', Boolean(link));
  const firstText = l.blokkok.find((b): b is { t: 'p'; s: string } => b.t === 'p' && !/^Szia\b/.test(b.s))?.s ?? '';
  const lablec = typeof l.lablec === 'string' ? LABLEC_OK[l.lablec] : l.lablec.szoveg;
  const m: Record<string, string> = {
    elonezet: esc((l.elonezet ?? firstText).replace(/\s+/g, ' ').slice(0, 140)),
    cim_title: esc(l.cim),
    cim: brandLink(ty(esc(l.cim)), C_TEXT),
    tartalom: l.blokkok.map(blokkHtml).join('\n    '),
    gomb_szoveg: esc(gomb?.szoveg ?? ''),
    gomb_link: esc(gomb?.link ?? ''),
    link_szoveg: ty(esc(link?.szoveg ?? '')),
    link_cel: esc(link?.cel ?? ''),
    lablec_ok: brandLink(ty(esc(lablec)), C_GREY),
  };
  // one pass, so a value can never introduce a placeholder of its own
  return h.replace(/\{\{(\w+)\}\}/g, (all, k: string) => (k in m ? m[k]! : all));
}

/** Footer by template name when the caller did not say (staff mails, codes, callbacks). */
export function lablecOfTemplate(template: string): MailFooterKind {
  if (/^auth_staff_invite/.test(template)) return 'munkatars';
  if (/^auth_/.test(template)) return 'kod';
  if (/^(staff_|accountant_digest|team_|nav_hiba|invoice_failed|payment_disputed|registration_submitted|callback_(assigned|overdue)|assist_(task|approval_overdue))|_(admin|konyvelo)$|\.admin$/.test(template)) return 'munkatars';
  if (template === 'callback_received') return 'visszahivas';
  return 'ugyfel';
}

/**
 * A plain-text mail → the same template: paragraphs (blank line), a lone 6-digit code → code block, the trailing lone
 * URL → the button (`gombSzoveg`) or a link, the closing brand signature dropped (the header carries the logo).
 */
export function levelFromText(subject: string, text: string, o: { lablec: Level['lablec']; gombSzoveg?: string | null; cim?: string | null }): Level {
  const paras = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const blokkok: Blokk[] = [];
  let gomb: Level['gomb'] = null;
  let link: Level['link'] = null;
  const lastUrlIdx = (() => {
    for (let i = paras.length - 1; i >= 0; i--) if (/^https?:\/\/\S+$/.test(paras[i]!)) return i;
    return -1;
  })();
  paras.forEach((p, i) => {
    if (p === brand.name || p === `${brand.name} csapata` || p === brand.webName) return;
    if (/^\d{6}$/.test(p.replace(/\s/g, ''))) {
      blokkok.push({ t: 'kod', kod: p });
      return;
    }
    if (i === lastUrlIdx) {
      if (o.gombSzoveg) gomb = { szoveg: o.gombSzoveg, link: p };
      else link = { szoveg: 'Megnyitom', cel: p };
      return;
    }
    blokkok.push({ t: 'p', s: p });
  });
  // a code subject ("482913 – a megerősítő kódod") keeps the code out of the heading: it has its own block
  const cim = o.cim ?? subject.replace(/^\d{6}\s*[–-]\s*/, '').replace(/^./, (c) => c.toUpperCase());
  return { cim, blokkok, gomb, link, lablec: o.lablec };
}
