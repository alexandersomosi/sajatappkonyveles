// E-mail over SMTP (Brevo: smtp-relay.brevo.com:587 STARTTLS) with nodemailer (SPEC §11.1).
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
import { log } from '../log.js';

export type MailResult = 'sent' | 'demo' | 'disabled';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface Mailer {
  readonly mode: Config['mail']['mode'];
  send(m: { to: string; subject: string; text: string; template: string; attachments?: MailAttachment[] }): Promise<MailResult>;
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
        await db.insert(demoOutbox).values({ toHash, toDisplay: maskEmail(m.to), subject: m.subject, bodyText: `${m.text}${att}`, template: m.template });
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
        html: htmlOf(m.subject, m.text),
        ...(m.attachments?.length ? { attachments: m.attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) } : {}),
      });
      log().info({ template: m.template, toHash }, 'mail sent');
      return 'sent';
    },
  };
}
