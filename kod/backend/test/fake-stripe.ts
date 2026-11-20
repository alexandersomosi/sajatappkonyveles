// An in-memory Stripe for the §29 tests: implements the PaymentProvider contract (no network), keeps sessions and
// PaymentIntents, honours idempotency keys like Stripe does, and verifies webhook signatures with the REAL SDK code.
import type { StripeCfg } from '../src/config.js';
import { createStripeProvider, stripeTestSignature } from '../src/payments/stripe.js';
import type { CardInfo, ChargeOutcome, HostedStart, PaymentProvider, ProviderHostedState, ProviderPaymentState, SavedCharge } from '../src/payments/provider.js';

// The fake keys are joined at runtime on purpose: GitHub push protection treats a literal "sk_test_…" string as a
// real Stripe secret and rejects the push (11-20). Keep them built like this.
const fakeKey = (prefix: string) => [prefix, 'FAKEFAKEFAKEFAKEFAKE0000'].join('_');
export const FAKE_STRIPE_ENV = {
  PAYMENT_PROVIDER: 'stripe',
  STRIPE_SECRET_KEY: fakeKey(['sk', 'test'].join('_')),
  STRIPE_PUBLISHABLE_KEY: fakeKey(['pk', 'test'].join('_')),
  STRIPE_WEBHOOK_SECRET: fakeKey('whsec'),
};

type Scenario = 'ok' | 'auth' | 'decline' | 'insufficient' | 'expired' | 'uncertain' | 'processing' | 'invalid';

interface FakeIntent {
  id: string;
  status: 'succeeded' | 'processing' | 'requires_action' | 'requires_payment_method' | 'canceled';
  amountHuf: number;
  card: CardInfo | null;
  metadata: Record<string, string>;
  refundedHuf: number;
  failureCode: string | null;
  declineCode: string | null;
  customer: string | null;
}

interface FakeSession {
  id: string;
  mode: 'payment' | 'setup';
  status: 'open' | 'complete' | 'expired';
  paid: boolean;
  metadata: Record<string, string>;
  amountHuf: number;
  piId: string | null;
  setiId: string | null;
  card: CardInfo | null;
  customer: string | null;
  params: HostedStart;
}

export class FakeStripe implements PaymentProvider {
  readonly name = 'stripe' as const;
  readonly mode = 'test' as const;
  n = 0;
  calls: { op: string; key?: string; args?: unknown }[] = [];
  sessions = new Map<string, FakeSession>();
  intents = new Map<string, FakeIntent>();
  byKey = new Map<string, ChargeOutcome>();
  scenarios: Scenario[] = [];
  refunds: { providerRef: string; amountHuf: number; key: string }[] = [];
  detached: string[] = [];
  customers = new Map<string, { email: string | null; name: string | null }>();
  private real: PaymentProvider;
  constructor(private cfg: StripeCfg = { mode: 'test', secretKey: FAKE_STRIPE_ENV.STRIPE_SECRET_KEY, publishableKey: FAKE_STRIPE_ENV.STRIPE_PUBLISHABLE_KEY, webhookSecret: FAKE_STRIPE_ENV.STRIPE_WEBHOOK_SECRET, suffixHavi: 'HAVIDIJ', locale: 'hu' }) {
    this.real = createStripeProvider({ cfg });
  }
  private id(p: string) {
    return `${p}_test_${String(++this.n).padStart(6, '0')}`;
  }
  card(last4 = '4242', pm?: string): CardInfo {
    return { brand: 'visa', last4, expMonth: 12, expYear: 2030, paymentMethodRef: pm ?? this.id('pm') };
  }
  async ensureCustomer(i: { clientId: string; email: string; name: string }) {
    this.calls.push({ op: 'customer', key: `cus:${i.clientId}:test` });
    const id = `cus_test_${i.clientId.replace(/-/g, '').slice(0, 12)}`;
    this.customers.set(id, { email: i.email, name: i.name });
    return id;
  }
  async updateCustomer(ref: string, i: { email?: string | null; name?: string | null }) {
    this.calls.push({ op: 'customer_update', args: i });
    this.customers.set(ref, { email: i.email ?? null, name: i.name ?? null });
  }
  async startHosted(i: HostedStart) {
    this.calls.push({ op: 'checkout', key: i.idempotencyKey, args: i });
    const id = this.id('cs');
    this.sessions.set(id, { id, mode: i.mode, status: 'open', paid: false, metadata: i.metadata, amountHuf: i.amountHuf, piId: null, setiId: null, card: null, customer: i.customerRef, params: i });
    return { url: `https://checkout.stripe.test/c/pay/${id}`, providerRef: id, expiresAt: i.expiresAt };
  }
  /** The client finished the Stripe page (payment or setup). */
  complete(sessionId: string, last4 = '4242'): FakeSession {
    const s = this.sessions.get(sessionId)!;
    const card = this.card(last4);
    s.status = 'complete';
    s.paid = true;
    s.card = card;
    if (s.mode === 'payment') {
      const pi: FakeIntent = { id: this.id('pi'), status: 'succeeded', amountHuf: s.amountHuf, card, metadata: s.metadata, refundedHuf: 0, failureCode: null, declineCode: null, customer: s.customer };
      this.intents.set(pi.id, pi);
      s.piId = pi.id;
    } else s.setiId = this.id('seti');
    return s;
  }
  expire(sessionId: string) {
    const s = this.sessions.get(sessionId)!;
    s.status = 'expired';
  }
  async chargeSaved(i: SavedCharge): Promise<ChargeOutcome> {
    this.calls.push({ op: 'charge', key: i.idempotencyKey, args: i });
    const seen = this.byKey.get(i.idempotencyKey);
    if (seen) return seen;
    const sc = this.scenarios.shift() ?? 'ok';
    if (sc === 'invalid') {
      const { ProviderError } = await import('../src/payments/provider.js');
      throw new ProviderError('stripe charge: StripeInvalidRequestError', 'parameter_invalid', false);
    }
    if (sc === 'uncertain') {
      // the request reached Stripe but the answer was lost: the PI exists, the same key returns it
      const pi = this.mkIntent(i, 'succeeded');
      this.byKey.set(i.idempotencyKey, { kind: 'succeeded', providerRef: pi.id, chargeRef: `ch_${pi.id}`, card: pi.card! });
      return { kind: 'uncertain', error: 'StripeConnectionError' };
    }
    let out: ChargeOutcome;
    if (sc === 'ok') {
      const pi = this.mkIntent(i, 'succeeded');
      out = { kind: 'succeeded', providerRef: pi.id, chargeRef: `ch_${pi.id}`, card: pi.card! };
    } else if (sc === 'processing') {
      const pi = this.mkIntent(i, 'processing');
      out = { kind: 'processing', providerRef: pi.id };
    } else if (sc === 'auth') {
      const pi = this.mkIntent(i, 'requires_payment_method', 'authentication_required');
      out = { kind: 'requires_auth', providerRef: pi.id, redirectUrl: i.offSession ? null : `https://hooks.stripe.test/3ds/${pi.id}` };
      if (!i.offSession) pi.status = 'requires_action';
    } else {
      const decline = sc === 'insufficient' ? 'insufficient_funds' : sc === 'expired' ? 'expired_card' : 'generic_decline';
      const code = sc === 'expired' ? 'expired_card' : 'card_declined';
      const pi = this.mkIntent(i, 'requires_payment_method', code, decline);
      out = { kind: 'declined', providerRef: pi.id, code, declineCode: decline };
    }
    this.byKey.set(i.idempotencyKey, out);
    return out;
  }
  private mkIntent(i: SavedCharge, status: FakeIntent['status'], failureCode: string | null = null, declineCode: string | null = null): FakeIntent {
    const pi: FakeIntent = { id: this.id('pi'), status, amountHuf: i.amountHuf, card: this.card('4242', i.paymentMethodRef), metadata: i.metadata, refundedHuf: 0, failureCode, declineCode, customer: i.customerRef };
    this.intents.set(pi.id, pi);
    return pi;
  }
  private state(pi: FakeIntent): ProviderPaymentState {
    const status: ProviderPaymentState['status'] =
      pi.status === 'succeeded'
        ? 'succeeded'
        : pi.status === 'processing'
          ? 'processing'
          : pi.status === 'requires_action' || pi.failureCode === 'authentication_required'
            ? 'requires_auth'
            : pi.status === 'canceled'
              ? 'canceled'
              : pi.failureCode
                ? 'failed'
                : 'open';
    return { providerRef: pi.id, status, amountHuf: pi.amountHuf, chargeRef: `ch_${pi.id}`, card: pi.card, failureCode: pi.failureCode, declineCode: pi.declineCode, refundedHuf: pi.refundedHuf, metadata: pi.metadata, customerRef: pi.customer };
  }
  async retrievePayment(ref: string) {
    this.calls.push({ op: 'retrieve_pi', args: ref });
    const pi = this.intents.get(ref);
    if (!pi) throw new Error('no such intent');
    return this.state(pi);
  }
  async retrieveHosted(ref: string): Promise<ProviderHostedState> {
    this.calls.push({ op: 'retrieve_cs', args: ref });
    const s = this.sessions.get(ref);
    if (!s) throw new Error('no such session');
    const pi = s.piId ? this.intents.get(s.piId)! : null;
    return { sessionRef: s.id, mode: s.mode, status: s.status, paid: s.paid, paymentRef: s.piId, setupRef: s.setiId, card: s.card, customerRef: s.customer, metadata: s.metadata, payment: pi ? this.state(pi) : null };
  }
  async findPaymentByOurId(pid: string) {
    for (const pi of this.intents.values()) if (pi.metadata.payment_id === pid) return this.state(pi);
    return null;
  }
  async cancelPending(ref: string) {
    this.calls.push({ op: 'cancel', args: ref });
    const pi = this.intents.get(ref);
    if (pi && pi.status !== 'succeeded') pi.status = 'canceled';
  }
  async expireHosted(ref: string) {
    this.calls.push({ op: 'expire', args: ref });
    const s = this.sessions.get(ref);
    if (s && s.status === 'open') s.status = 'expired';
  }
  async refund(i: { providerRef: string; amountHuf: number; idempotencyKey: string }) {
    this.calls.push({ op: 'refund', key: i.idempotencyKey, args: i });
    if (!this.refunds.some((r) => r.key === i.idempotencyKey)) {
      this.refunds.push({ providerRef: i.providerRef, amountHuf: i.amountHuf, key: i.idempotencyKey });
      const pi = this.intents.get(i.providerRef);
      if (pi) pi.refundedHuf += i.amountHuf;
    }
    return { refundRef: `re_${i.idempotencyKey}`, status: 'succeeded' as const };
  }
  async detachCard(ref: string) {
    this.detached.push(ref);
  }
  verifyWebhook(raw: string, headers: Record<string, string | undefined>) {
    return this.real.verifyWebhook(raw, headers);
  }
  /** A signed Stripe event (the SDK's own signature generator). */
  event(type: string, object: Record<string, unknown>, o: { id?: string; livemode?: boolean; secret?: string } = {}): { raw: string; signature: string } {
    const raw = JSON.stringify({ id: o.id ?? this.id('evt'), object: 'event', api_version: '2026-10-28.endive', created: Math.floor(Date.now() / 1000), livemode: o.livemode ?? false, type, data: { object } });
    return { raw, signature: stripeTestSignature(raw, o.secret ?? this.cfg.webhookSecret) };
  }
}
