// E-mail over SMTP (ZeptoMail / Brevo, STARTTLS) with nodemailer (SPEC §11.1).
// k8 ALAP-B: every mail's HTML part is the new template (notify/sablon.ts): a structured `level` when the caller has one,
// else built from the plain text. The text/plain part and the subjects are unchanged. DEMO stores the HTML image too.
// DEMO: nothing leaves the server; the mail goes to demo_outbox with a masked recipient and the
// log says only "mail not sent (DEMO)". Disabled (production without SMTP): send() returns
// 'disabled' and callers that need mail answer 503 not_configured.
import nodemailer, { type Transporter } from 'nodemailer';
import brand from '../_shared/brand.json' with { type: 'json' };
import type { Config } from '../config.js';
import type { Db } from '../db/client.js';
import { demoOutbox } from '../db/schema.js';
import { hmacHex } from '../lib/crypto.js';
import { maskEmail } from '../lib/validators.js';
import { log, safeErr } from '../log.js';
import type { MailFooterKind } from '../_shared/k8.js';
import { lablecOfTemplate, levelFromText, renderLevel, type Level } from './sablon.js';

export type MailResult = 'sent' | 'demo' | 'disabled';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  template: string;
  attachments?: MailAttachment[];
  /** k8: the structured content of the new template (else built from `text`). */
  level?: Level;
  /** k8: the footer reason when `level` is absent (else guessed from the template name). */
  lablec?: MailFooterKind;
  /** k8: the label of the button made from the trailing link (else a plain "Megnyitom" link). */
  gombSzoveg?: string | null;
}

export interface Mailer {
  readonly mode: Config['mail']['mode'];
  send(m: MailMessage): Promise<MailResult>;
}

/** k8: the HTML part of a mail (the new template). Never throws: a broken level falls back to the text paragraphs. */
export function htmlOfMail(m: MailMessage): string {
  try {
    return renderLevel(m.level ?? levelFromText(m.subject, m.text, { lablec: m.lablec ?? lablecOfTemplate(m.template), gombSzoveg: m.gombSzoveg ?? null }));
  } catch (err) {
    log().warn({ template: m.template, err: safeErr(err) }, 'mail template render failed');
    return htmlOf(m.subject, m.text);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function htmlOf(subject: string, text: string): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#E4E8F3;font-family:Geist,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#10152B">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="height:6px;background:#1428DB;border-radius:3px 3px 0 0"></div>
<div style="background:#fff;border-radius:0 0 18px 18px;padding:24px 24px 10px;font-size:16px;line-height:1.55">
<div style="font-weight:700;font-size:18px;margin-bottom:16px">${escapeHtml(brand.name)}</div>${paras}</div></div></body></html>`;
}

export function createMailer(cfg: Config, db: Db): Mailer {
  const mode = cfg.mail.mode;
  let transport: Transporter | null = null;
  if (mode === 'smtp') {
    transport = nodemailer.createTransport({
      host: cfg.mail.host,
      port: cfg.mail.port,
      secure: cfg.mail.port === 465,
      requireTLS: cfg.mail.port === 587,
      auth: cfg.mail.user ? { user: cfg.mail.user, pass: cfg.mail.pass } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return {
    mode,
    async send(m) {
      const toHash = hmacHex(cfg.auditIpSalt, `mail:${m.to}`).slice(0, 24);
      if (mode === 'demo') {
        // The DEMO outbox stores text only: an attachment is named at the end of the body, never stored a second time.
        const att = (m.attachments ?? []).map((a) => `\n\n[Csatolmány: ${a.filename}, ${Math.max(1, Math.round(a.content.length / 1024))} KB – DEMO módban nem megy ki levél, az iratot az appban találod.]`).join('');
        await db.insert(demoOutbox).values({ toHash, toDisplay: maskEmail(m.to), subject: m.subject, bodyText: `${m.text}${att}`, template: m.template, bodyHtml: htmlOfMail(m) });
        log().info({ template: m.template, toHash }, 'mail not sent (DEMO)');
        return 'demo';
      }
      if (mode === 'disabled' || !transport) {
        log().warn({ template: m.template, toHash }, 'mail not sent (not configured)');
        return 'disabled';
      }
      await transport.sendMail({
        from: cfg.mail.from,
        replyTo: cfg.mail.replyTo || undefined,
        to: m.to,
        subject: m.subject,
        text: m.text,
        html: htmlOfMail(m),
        ...(m.attachments?.length ? { attachments: m.attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) } : {}),
      });
      log().info({ template: m.template, toHash }, 'mail sent');
      return 'sent';
    },
  };
}
