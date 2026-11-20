// SPEC §29.1.12 – the DEMO payment provider (PAYMENT_PROVIDER=demo): no money moves, no external call. The hosted page is
// our own DEMO pay page (/api/v1/payments/demo/fizetes?p=<paymentId>, routes/payments-k29.ts) with four buttons; its
// result is applied by the same service functions as a Stripe webhook. Saved-card charges succeed, except: an e-mail
// starting with "fail+" → declined, "auth+" → requires_auth (scenario chosen by the service, DEMO only).
import { randomBytes } from 'node:crypto';
import type { CardInfo, ChargeOutcome, PaymentProvider, ProviderHostedState, ProviderPaymentState } from './provider.js';

const rid = (p: string) => `${p}_${randomBytes(9).toString('hex')}`;

/** The DEMO card (brand 'demo', label "DEMO •••• 4242"), expiring at the end of (year + 3). */
export function demoCard(now: Date, pmRef?: string): CardInfo {
  return { brand: 'demo', last4: '4242', expMonth: 12, expYear: now.getUTCFullYear() + 3, paymentMethodRef: pmRef ?? rid('demo_pm') };
}

export function demoSessionRef(paymentId: string): string {
  return `demo_cs_${paymentId.replace(/-/g, '')}`;
}

export function createDemoProvider(o: { apiPublicUrl: string; now: () => Date }): PaymentProvider {
  const open = (ref: string): ProviderPaymentState => ({
    providerRef: ref,
    status: 'open',
    amountHuf: 0,
    chargeRef: null,
    card: null,
    failureCode: null,
    declineCode: null,
    refundedHuf: 0,
    metadata: {},
    customerRef: null,
  });
  return {
    name: 'demo',
    mode: 'demo',
    async ensureCustomer(i) {
      return `demo_cus_${i.clientId.replace(/-/g, '').slice(0, 16)}`;
    },
    async updateCustomer() {},
    async startHosted(i) {
      return { url: `${o.apiPublicUrl}/api/v1/payments/demo/fizetes?p=${encodeURIComponent(i.paymentId)}`, providerRef: demoSessionRef(i.paymentId), expiresAt: i.expiresAt };
    },
    async chargeSaved(i): Promise<ChargeOutcome> {
      const ref = rid('demo_pi');
      if (i.demoScenario === 'declined') return { kind: 'declined', providerRef: ref, code: 'card_declined', declineCode: 'insufficient_funds' };
      if (i.demoScenario === 'requires_auth') return { kind: 'requires_auth', providerRef: ref, redirectUrl: null };
      return { kind: 'succeeded', providerRef: ref, chargeRef: rid('demo_ch'), card: demoCard(o.now(), i.paymentMethodRef) };
    },
    async retrievePayment(ref) {
      return open(ref);
    },
    async retrieveHosted(ref): Promise<ProviderHostedState> {
      return { sessionRef: ref, mode: 'payment', status: 'open', paid: false, paymentRef: null, setupRef: null, card: null, customerRef: null, metadata: {}, payment: null };
    },
    async findPaymentByOurId() {
      return null;
    },
    async cancelPending() {},
    async expireHosted() {},
    async refund() {
      return { refundRef: rid('demo_re'), status: 'succeeded' as const };
    },
    async detachCard() {},
    verifyWebhook() {
      return null;
    },
  };
}
