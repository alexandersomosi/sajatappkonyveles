// SPEC §29.1.1 – the payment provider interface every flow uses. No Stripe type leaks into the services: Stripe objects
// are mapped to these plain shapes in stripe.ts; the DEMO provider (demo.ts) implements the same contract in-process.
export interface CardInfo {
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  /** Stripe PaymentMethod id (pm_…) or the DEMO card id. */
  paymentMethodRef: string | null;
}

export interface HostedStart {
  /** 'payment' = pay now (+ save the card when saveCard); 'setup' = save a card only, no money. */
  mode: 'payment' | 'setup';
  paymentId: string;
  clientId: string;
  customerRef: string | null;
  amountHuf: number;
  saveCard: boolean;
  productName: string;
  description: string;
  statementSuffix: string;
  submitMessage: string | null;
  successUrl: string;
  cancelUrl: string;
  platform: 'app' | 'web';
  expiresAt: Date;
  idempotencyKey: string;
  /** Our ids only – never a name, an e-mail or a tax number (§29.0 principle 7). */
  metadata: Record<string, string>;
}

export interface SavedCharge {
  paymentId: string;
  customerRef: string | null;
  paymentMethodRef: string;
  amountHuf: number;
  /** true = merchant-initiated (our scheduler); false = the client tapped "Fizetek" (on-session, 3DS via redirect). */
  offSession: boolean;
  /** For on-session charges: where the bank's check returns to. */
  returnUrl?: string;
  description: string;
  statementSuffix: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
  /** DEMO only: the scenario of this charge (from the client's e-mail: fail+… / auth+…). */
  demoScenario?: 'ok' | 'declined' | 'requires_auth';
}

export type ChargeOutcome =
  | { kind: 'succeeded'; providerRef: string; chargeRef: string | null; card: CardInfo }
  | { kind: 'processing'; providerRef: string }
  /** authentication_required (off-session) or requires_action (on-session: redirectUrl = the bank's page). */
  | { kind: 'requires_auth'; providerRef: string | null; redirectUrl?: string | null }
  | { kind: 'declined'; providerRef: string | null; code: string; declineCode?: string }
  /** Network / 5xx: the same idempotency key is retried the same day (Stripe returns the original result). */
  | { kind: 'uncertain'; error: string };

export interface ProviderPaymentState {
  providerRef: string;
  /** Stripe PaymentIntent status mapped: succeeded | processing | requires_action (auth) | requires_payment_method (failed) | canceled. */
  status: 'succeeded' | 'processing' | 'requires_auth' | 'failed' | 'canceled' | 'open';
  amountHuf: number;
  chargeRef: string | null;
  card: CardInfo | null;
  failureCode: string | null;
  declineCode: string | null;
  refundedHuf: number;
  metadata: Record<string, string>;
  customerRef: string | null;
  /** k7c2 B7: ISO currency of the PaymentIntent ('huf'); absent when unknown (DEMO). */
  currency?: string | null;
}

export interface ProviderHostedState {
  sessionRef: string;
  mode: 'payment' | 'setup';
  /** open | complete | expired */
  status: 'open' | 'complete' | 'expired';
  paid: boolean;
  paymentRef: string | null;
  setupRef: string | null;
  card: CardInfo | null;
  customerRef: string | null;
  metadata: Record<string, string>;
  payment: ProviderPaymentState | null;
}

export interface ProviderEvent {
  id: string;
  type: string;
  livemode: boolean;
  created: Date;
  /** The id of the object the event is about (cs_…, pi_…, seti_…, ch_…, dp_…, pm_…). */
  objectId: string;
  /** A few non-personal fields we need without another call (metadata, mode, payment_intent, status). */
  object: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: 'stripe' | 'demo';
  readonly mode: 'test' | 'live' | 'demo';
  /** Lazily creates the customer of a client (idempotency key cus:<clientId>:<mode>). DEMO returns a fake id. */
  ensureCustomer(i: { clientId: string; email: string; name: string }): Promise<string>;
  updateCustomer(customerRef: string, i: { email?: string | null; name?: string | null }): Promise<void>;
  /** Hosted page: first month + save card (mode payment + setup_future_usage) or card only (mode setup). */
  startHosted(i: HostedStart): Promise<{ url: string; providerRef: string; expiresAt: Date }>;
  /** Merchant- or client-initiated charge with the saved card. Never throws on a card decline: returns the outcome. */
  chargeSaved(i: SavedCharge): Promise<ChargeOutcome>;
  retrievePayment(providerRef: string): Promise<ProviderPaymentState>;
  retrieveHosted(sessionRef: string): Promise<ProviderHostedState>;
  /** Finds the PaymentIntent of one of our payments (by metadata.payment_id) – after an uncertain create. */
  findPaymentByOurId(paymentId: string): Promise<ProviderPaymentState | null>;
  /** Cancels an open PaymentIntent (requires_payment_method / requires_action / requires_confirmation) – never a paid one. */
  cancelPending(providerRef: string): Promise<void>;
  expireHosted(sessionRef: string): Promise<void>;
  refund(i: { providerRef: string; amountHuf: number; idempotencyKey: string; reason: string; metadata: Record<string, string> }): Promise<{ refundRef: string; status: 'succeeded' | 'pending' | 'failed' }>;
  detachCard(pmRef: string): Promise<void>;
  /** Verifies the signature (Stripe-Signature, tolerance 300 s); null = bad signature. */
  verifyWebhook(raw: string, headers: Record<string, string | undefined>): ProviderEvent | null;
}

/** A provider call failed for a reason that is not a card decline (network, 5xx, bad request). */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
