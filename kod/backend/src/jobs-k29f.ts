// SPEC §29.13 jobs of the new features: termination_effective 06:10 (applies effectiveOn: lifecycle 'megszunt',
// end of relationship, card stop, calendar feed revoke, the accountant's tasks).
import type { JobDef } from './jobs.js';
import { budapestParts } from './lib/dates.js';
import { jobTerminationEffective } from './services/konzol-muveletek.js';

export function jobDefsK29f(): JobDef[] {
  return [
    {
      name: 'termination_effective',
      slot: (now) => {
        const p = budapestParts(now);
        return p.hour * 60 + p.minute >= 6 * 60 + 10 ? p.date : null;
      },
      run: async (d) => ({ applied: await jobTerminationEffective(d) }),
    },
  ];
}
