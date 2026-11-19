// Expo push (SPEC §11.2): POST https://exp.host/--/api/v2/push/send in batches of ≤ 100,
// receipts via /getReceipts; DeviceNotRegistered disables the token. DEMO/disabled: nothing is
// sent, in-app notifications still work, the log says "push not sent (DEMO)".
import type { Config } from '../config.js';
import { log } from '../log.js';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}
export interface PushTicket {
  token: string;
  ok: boolean;
  id?: string;
  error?: string;
}
export interface PushSender {
  readonly mode: Config['push']['mode'];
  send(msgs: PushMessage[]): Promise<PushTicket[]>;
  receipts(ids: string[]): Promise<Record<string, { ok: boolean; error?: string }>>;
}

const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

export function createPush(cfg: Config, fetchImpl: typeof fetch = fetch): PushSender {
  const mode = cfg.push.mode;
  const headers: Record<string, string> = { accept: 'application/json', 'content-type': 'application/json' };
  if (cfg.push.expoAccessToken) headers.authorization = `Bearer ${cfg.push.expoAccessToken}`;
  return {
    mode,
    async send(msgs) {
      if (mode !== 'expo') {
        if (msgs.length) log().info({ n: msgs.length }, mode === 'demo' ? 'push not sent (DEMO)' : 'push not sent (not configured)');
        return msgs.map((m) => ({ token: m.to, ok: false, error: mode === 'demo' ? 'DEMO' : 'NOT_CONFIGURED' }));
      }
      const out: PushTicket[] = [];
      for (let i = 0; i < msgs.length; i += 100) {
        const batch = msgs.slice(i, i + 100);
        const res = await fetchImpl(SEND_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(batch.map((m) => ({ to: m.to, title: m.title, body: m.body, data: m.data ?? {}, sound: 'default' }))),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          log().warn({ status: res.status }, 'expo push http error');
          out.push(...batch.map((m) => ({ token: m.to, ok: false, error: `HTTP_${res.status}` })));
          continue;
        }
        const json = (await res.json()) as { data?: { status: string; id?: string; details?: { error?: string } }[] };
        batch.forEach((m, j) => {
          const t = json.data?.[j];
          if (t?.status === 'ok') out.push({ token: m.to, ok: true, id: t.id });
          else out.push({ token: m.to, ok: false, error: t?.details?.error ?? 'UNKNOWN' });
        });
      }
      return out;
    },
    async receipts(ids) {
      if (mode !== 'expo' || ids.length === 0) return {};
      const out: Record<string, { ok: boolean; error?: string }> = {};
      for (let i = 0; i < ids.length; i += 300) {
        const res = await fetchImpl(RECEIPTS_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ids: ids.slice(i, i + 300) }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) continue;
        const json = (await res.json()) as { data?: Record<string, { status: string; details?: { error?: string } }> };
        for (const [id, r] of Object.entries(json.data ?? {})) out[id] = { ok: r.status === 'ok', error: r.details?.error };
      }
      return out;
    },
  };
}
