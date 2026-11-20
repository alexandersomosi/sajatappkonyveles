// SPEC §29.10 G – the guided first run: GET/POST /client/guided (registered in clientRoutes).
import type { Hono } from 'hono';
import { z } from 'zod';
import { GUIDED_ACTIONS, GUIDED_ORDER } from '../_shared/k29g.js';
import type { Deps } from '../deps.js';
import { auditC } from '../audit.js';
import { auth, readJson, type C, type Env } from '../http/core.js';
import { clientOfUser } from '../services/people.js';
import { buildGuided, guidedAction } from '../services/guided.js';

const GUIDED_KEYS = [...new Set(Object.values(GUIDED_ORDER).flat())] as [string, ...string[]];

export function registerClientK29gRoutes(r: Hono<Env>, deps: Deps): void {
  const client = (c: C) => clientOfUser(deps.db, auth(c).userId);

  r.get('/guided', async (c) => c.json(await buildGuided(deps, deps.db, await client(c))));

  r.post('/guided', async (c) => {
    const b = await readJson(c, z.strictObject({ action: z.enum(GUIDED_ACTIONS), key: z.enum(GUIDED_KEYS).optional() }));
    const cl = await client(c);
    const v = await guidedAction(deps, deps.db, cl, b.action, b.key as never);
    // only the pause / resume / done moments are worth a line in the log (not every step)
    if (b.action === 'later' || b.action === 'resume' || b.action === 'done_seen') await auditC(c, deps.db, `onboarding.guided_${b.action}`, { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { key: b.key ?? null } });
    return c.json(v);
  });
}
