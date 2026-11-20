// SPEC §29.13 jobs of B1 (payments + fee invoices). Registered by ONE line in jobs.ts jobDefs(). The monthly charge
// itself stays in `billing` (06:00, runBillingJob → chargeSubscription dispatches on subscriptions.provider).
import type { JobDef } from './jobs.js';
import { budapestParts } from './lib/dates.js';
import { jobInvoicesIssue } from './payments/invoices.js';
import { jobPaymentsReconcile, jobPredebit, jobSuspensionWarning } from './services/payments.js';

const daily = (h: number, m: number) => (now: Date) => {
  const p = budapestParts(now);
  return p.hour * 60 + p.minute >= h * 60 + m ? p.date : null;
};

export function jobDefsK29(): JobDef[] {
  return [
    { name: 'predebit', slot: daily(10, 0), run: (d) => jobPredebit(d) },
    { name: 'suspension_warning', slot: daily(10, 5), run: (d) => jobSuspensionWarning(d) },
    {
      name: 'payments_reconcile',
      slot: (now) => {
        const p = budapestParts(now);
        return `${p.date}T${p.hour}:${Math.floor(p.minute / 15)}`;
      },
      run: (d) => jobPaymentsReconcile(d),
    },
    {
      name: 'invoices_issue',
      slot: (now) => {
        const p = budapestParts(now);
        return `${p.date}T${p.hour}:${p.minute}`;
      },
      run: (d) => jobInvoicesIssue(d),
    },
  ];
}
