// SPEC §29.1 – Stripe (Payments API only: Checkout Sessions + PaymentIntents; no Stripe Billing, no Stripe invoices).
// The official SDK, exact version pinned in package.json; apiVersion pinned to that SDK's default (= STRIPE_API_VERSION
// in shared k29.ts, compared by a test). Keys never leave this module and are never logged; metadata holds our ids only.
import Stripe from 'stripe';
import { STRIPE_API_VERSION } from '../_shared/k29.js';
import type { StripeCfg } from '../config.js';
import { hufToStripe, stripeToHuf } from './huf.js';
import { ProviderError, type CardInfo, type ChargeOutcome, type HostedStart, type PaymentProvider, type ProviderEvent, type ProviderHostedState, type ProviderPaymentState, type SavedCharge } from './provider.js';

export interface StripeProviderOptions {
  cfg: StripeCfg;
  /** Tests: a fetch that answers like the Stripe API (no network). */
  fetch?: typeof fetch;
  /** Tests: point the SDK at a local fake (host/port/protocol). */
  host?: string;
  port?: number;
  protocol?: 'http' | 'https';
}

const PI_EXPAND = ['latest_charge', 'payment_method'];

type AnyObj = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

function idOf(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string') return (v as { id: string }).id;
  return null;
}

function metaOf(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v as AnyObj)) if (typeof x === 'string') out[k] = x;
  return out;
}

/** card details from an expanded charge (payment_method_details.card) or an expanded PaymentMethod (card). */
export function cardFrom(charge: unknown, pm: unknown): CardInfo | null {
  const c = (charge as { payment_method_details?: { card?: AnyObj } } | null)?.payment_method_details?.card;
  const p = (pm as { card?: AnyObj; id?: string } | null)?.card;
  const src = c ?? p;
  if (!src) return null;
  return {
    brand: String(src.brand ?? 'card'),
    last4: String(src.last4 ?? ''),
    expMonth: typeof src.exp_month === 'number' ? src.exp_month : null,
    expYear: typeof src.exp_year === 'number' ? src.exp_year : null,
    paymentMethodRef: idOf(pm) ?? str((charge as { payment_method?: unknown } | null)?.payment_method),
  };
}

export function mapPaymentIntent(pi: AnyObj): ProviderPaymentState {
  const status = String(pi.status ?? '');
  const charge = pi.latest_charge && typeof pi.latest_charge === 'object' ? (pi.latest_charge as AnyObj) : null;
  const lastErr = (pi.last_payment_error ?? null) as { code?: string; decline_code?: string } | null;
  let mapped: ProviderPaymentState['status'];
  if (status === 'succeeded') mapped = 'succeeded';
  else if (status === 'processing') mapped = 'processing';
  else if (status === 'requires_action' || status === 'requires_confirmation') mapped = 'requires_auth';
  else if (status === 'canceled') mapped = 'canceled';
  else if (status === 'requires_payment_method') mapped = lastErr ? 'failed' : 'open';
  else mapped = 'open';
  // an off-session authentication_required leaves the PI in requires_payment_method with that error code
  if (mapped === 'failed' && lastErr?.code === 'authentication_required') mapped = 'requires_auth';
  const amount = typeof pi.amount === 'number' ? pi.amount : 0;
  return {
    providerRef: String(pi.id),
    status: mapped,
    amountHuf: amount % 100 === 0 ? stripeToHuf(amount) : Math.round(amount / 100),
    chargeRef: idOf(pi.latest_charge),
    card: cardFrom(charge, pi.payment_method && typeof pi.payment_method === 'object' ? pi.payment_method : null),
    failureCode: lastErr?.code ?? null,
    declineCode: lastErr?.decline_code ?? null,
    refundedHuf: charge && typeof charge.amount_refunded === 'number' ? Math.round(charge.amount_refunded / 100) : 0,
    metadata: metaOf(pi.metadata),
    customerRef: idOf(pi.customer),
    currency: typeof pi.currency === 'string' ? pi.currency : null,
  };
}

function isStripeError(e: unknown): e is { type: string; code?: string; decline_code?: string; statusCode?: number; raw?: AnyObj; payment_intent?: AnyObj; message: string } {
  return Boolean(e && typeof e === 'object' && typeof (e as { type?: unknown }).type === 'string' && String((e as { type: string }).type).startsWith('Stripe'));
}

/** Short, non-secret description of a Stripe error for logs and last_error (no request ids with keys, no payloads). */
export function safeStripeError(e: unknown): string {
  if (isStripeError(e)) return `${e.type}${e.code ? `:${e.code}` : ''}${e.statusCode ? `:${e.statusCode}` : ''}`.slice(0, 120);
  return (e instanceof Error ? e.name : 'Error').slice(0, 60);
}

export function createStripeProvider(o: StripeProviderOptions): PaymentProvider {
  const cfg = o.cfg;
  const config: Stripe.StripeConfig = {
    apiVersion: STRIPE_API_VERSION as Stripe.StripeConfig['apiVersion'],
    timeout: 20_000,
    maxNetworkRetries: 1,
    telemetry: false,
    appInfo: { name: 'Adozz' },
    ...(o.fetch ? { httpClient: Stripe.createFetchHttpClient(o.fetch) } : {}),
    ...(o.host ? { host: o.host } : {}),
    ...(o.port ? { port: o.port } : {}),
    ...(o.protocol ? { protocol: o.protocol } : {}),
  };
  const stripe = new Stripe(cfg.secretKey, config);
  const mode = cfg.mode;

  function wrap(e: unknown, what: string): never {
    if (isStripeError(e)) {
      const retryable = e.type === 'StripeConnectionError' || e.type === 'StripeAPIError' || e.type === 'StripeRateLimitError' || (e.statusCode ?? 0) >= 500;
      throw new ProviderError(`stripe ${what}: ${safeStripeError(e)}`, e.code ?? e.type, retryable);
    }
    throw new ProviderError(`stripe ${what}: ${safeStripeError(e)}`, 'network', true);
  }

  return {
    name: 'stripe',
    mode,

    async ensureCustomer(i) {
      try {
        const c = await stripe.customers.create({ email: i.email, name: i.name, metadata: { client_id: i.clientId }, preferred_locales: ['hu'] }, { idempotencyKey: `cus:${i.clientId}:${mode}` });
        return c.id;
      } catch (e) {
        return wrap(e, 'customer');
      }
    },

    async updateCustomer(customerRef, i) {
      try {
        const params: Stripe.CustomerUpdateParams = {};
        if (i.email !== undefined) params.email = i.email ?? '';
        if (i.name !== undefined) params.name = i.name ?? '';
        await stripe.customers.update(customerRef, params);
      } catch (e) {
        wrap(e, 'customer update');
      }
    },

    async startHosted(i: HostedStart) {
      const common = {
        customer: i.customerRef ?? undefined,
        client_reference_id: i.paymentId,
        metadata: i.metadata,
        locale: (cfg.locale || 'hu') as Stripe.Checkout.SessionCreateParams.Locale,
        origin_context: (i.platform === 'app' ? 'mobile_app' : 'web') as Stripe.Checkout.SessionCreateParams.OriginContext,
        expires_at: Math.floor(i.expiresAt.getTime() / 1000),
        success_url: i.successUrl,
        cancel_url: i.cancelUrl,
        // API 2026-10-28: payment_method_types → allowed_payment_method_types (card only)
        allowed_payment_method_types: ['card'] as Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[],
      };
      let params: Stripe.Checkout.SessionCreateParams;
      if (i.mode === 'setup') {
        params = { ...common, mode: 'setup', currency: 'huf', setup_intent_data: { metadata: i.metadata, description: i.description } };
      } else {
        params = {
          ...common,
          mode: 'payment',
          line_items: [{ price_data: { currency: 'huf', unit_amount: hufToStripe(i.amountHuf), product_data: { name: i.productName } }, quantity: 1 }],
          payment_intent_data: {
            ...(i.saveCard ? { setup_future_usage: 'off_session' as const } : {}),
            statement_descriptor_suffix: i.statementSuffix,
            description: i.description,
            metadata: i.metadata,
          },
          ...(i.submitMessage ? { custom_text: { submit: { message: i.submitMessage } } } : {}),
        };
      }
      try {
        const s = await stripe.checkout.sessions.create(params, { idempotencyKey: i.idempotencyKey });
        if (!s.url) throw new ProviderError('stripe checkout: no url', 'no_url', false);
        return { url: s.url, providerRef: s.id, expiresAt: new Date(s.expires_at * 1000) };
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        return wrap(e, 'checkout');
      }
    },

    async chargeSaved(i: SavedCharge): Promise<ChargeOutcome> {
      const params: Stripe.PaymentIntentCreateParams = {
        amount: hufToStripe(i.amountHuf),
        currency: 'huf',
        customer: i.customerRef ?? undefined,
        payment_method: i.paymentMethodRef,
        confirm: true,
        statement_descriptor_suffix: i.statementSuffix,
        description: i.description,
        metadata: i.metadata,
        allowed_payment_method_types: ['card'],
        ...(i.offSession ? { off_session: true } : { off_session: false, return_url: i.returnUrl }),
      };
      try {
        const pi = await stripe.paymentIntents.create(params, { idempotencyKey: i.idempotencyKey });
        const full = (await stripe.paymentIntents.retrieve(pi.id, { expand: PI_EXPAND })) as unknown as AnyObj;
        const st = mapPaymentIntent(full);
        if (st.status === 'succeeded') return { kind: 'succeeded', providerRef: st.providerRef, chargeRef: st.chargeRef, card: st.card ?? { brand: 'card', last4: '', expMonth: null, expYear: null, paymentMethodRef: i.paymentMethodRef } };
        if (st.status === 'processing') return { kind: 'processing', providerRef: st.providerRef };
        if (st.status === 'requires_auth') {
          const na = (full.next_action ?? null) as { redirect_to_url?: { url?: string } } | null;
          return { kind: 'requires_auth', providerRef: st.providerRef, redirectUrl: na?.redirect_to_url?.url ?? null };
        }
        return { kind: 'declined', providerRef: st.providerRef, code: st.failureCode ?? 'card_declined', ...(st.declineCode ? { declineCode: st.declineCode } : {}) };
      } catch (e) {
        if (isStripeError(e) && e.type === 'StripeCardError') {
          const pi = (e.raw?.payment_intent ?? e.payment_intent ?? null) as AnyObj | null;
          const ref = pi ? idOf(pi) : null;
          if (e.code === 'authentication_required') return { kind: 'requires_auth', providerRef: ref, redirectUrl: null };
          return { kind: 'declined', providerRef: ref, code: e.code ?? 'card_declined', ...(e.decline_code ? { declineCode: e.decline_code } : {}) };
        }
        if (isStripeError(e) && (e.type === 'StripeInvalidRequestError' || e.type === 'StripeAuthenticationError' || e.type === 'StripePermissionError' || e.type === 'StripeIdempotencyError')) {
          // our mistake or a reused key with other params – not a card decline, not "uncertain": stop and tell the admin
          throw new ProviderError(`stripe charge: ${safeStripeError(e)}`, e.code ?? e.type, false);
        }
        return { kind: 'uncertain', error: safeStripeError(e) };
      }
    },

    async retrievePayment(providerRef) {
      try {
        const pi = await stripe.paymentIntents.retrieve(providerRef, { expand: PI_EXPAND });
        return mapPaymentIntent(pi as unknown as AnyObj);
      } catch (e) {
        return wrap(e, 'retrieve');
      }
    },

    async retrieveHosted(sessionRef) {
      try {
        const s = (await stripe.checkout.sessions.retrieve(sessionRef, {
          expand: ['payment_intent', 'payment_intent.latest_charge', 'payment_intent.payment_method', 'setup_intent', 'setup_intent.payment_method'],
        })) as unknown as AnyObj;
        const piObj = s.payment_intent && typeof s.payment_intent === 'object' ? (s.payment_intent as AnyObj) : null;
        const siObj = s.setup_intent && typeof s.setup_intent === 'object' ? (s.setup_intent as AnyObj) : null;
        const payment = piObj ? mapPaymentIntent(piObj) : null;
        const card = payment?.card ?? (siObj ? cardFrom(null, siObj.payment_method) : null);
        return {
          sessionRef: String(s.id),
          mode: s.mode === 'setup' ? 'setup' : 'payment',
          status: s.status === 'complete' ? 'complete' : s.status === 'expired' ? 'expired' : 'open',
          paid: s.payment_status === 'paid' || (s.mode === 'setup' && siObj?.status === 'succeeded'),
          paymentRef: idOf(s.payment_intent),
          setupRef: idOf(s.setup_intent),
          card,
          customerRef: idOf(s.customer),
          metadata: metaOf(s.metadata),
          payment,
        } satisfies ProviderHostedState;
      } catch (e) {
        return wrap(e, 'session');
      }
    },

    async findPaymentByOurId(paymentId) {
      if (!/^[0-9a-f-]{36}$/.test(paymentId)) return null;
      try {
        const r = await stripe.paymentIntents.search({ query: `metadata['payment_id']:'${paymentId}'`, limit: 5 });
        const pi = r.data[0];
        if (!pi) return null;
        const full = await stripe.paymentIntents.retrieve(pi.id, { expand: PI_EXPAND });
        return mapPaymentIntent(full as unknown as AnyObj);
      } catch (e) {
        return wrap(e, 'search');
      }
    },

    async cancelPending(providerRef) {
      try {
        const pi = await stripe.paymentIntents.retrieve(providerRef);
        if (['requires_payment_method', 'requires_action', 'requires_confirmation'].includes(pi.status)) await stripe.paymentIntents.cancel(providerRef);
      } catch (e) {
        wrap(e, 'cancel');
      }
    },

    async expireHosted(sessionRef) {
      try {
        const s = await stripe.checkout.sessions.retrieve(sessionRef);
        if (s.status === 'open') await stripe.checkout.sessions.expire(sessionRef);
      } catch (e) {
        wrap(e, 'expire');
      }
    },

    async refund(i) {
      try {
        const r = await stripe.refunds.create({ payment_intent: i.providerRef, amount: hufToStripe(i.amountHuf), reason: 'requested_by_customer', metadata: i.metadata }, { idempotencyKey: i.idempotencyKey });
        const st = r.status === 'succeeded' ? 'succeeded' : r.status === 'failed' || r.status === 'canceled' ? 'failed' : 'pending';
        return { refundRef: r.id, status: st };
      } catch (e) {
        return wrap(e, 'refund');
      }
    },

    async detachCard(pmRef) {
      try {
        await stripe.paymentMethods.detach(pmRef);
      } catch (e) {
        // already detached is fine
        if (isStripeError(e) && e.type === 'StripeInvalidRequestError') return;
        wrap(e, 'detach');
      }
    },

    verifyWebhook(raw, headers) {
      const sig = headers['stripe-signature'];
      if (!sig || !cfg.webhookSecret) return null;
      try {
        const ev = stripe.webhooks.constructEvent(raw, sig, cfg.webhookSecret, 300) as unknown as AnyObj;
        const obj = ((ev.data as { object?: AnyObj } | undefined)?.object ?? {}) as AnyObj;
        return {
          id: String(ev.id),
          type: String(ev.type),
          livemode: Boolean(ev.livemode),
          created: new Date(Number(ev.created ?? 0) * 1000),
          objectId: String(obj.id ?? ''),
          object: {
            object: obj.object,
            mode: obj.mode,
            status: obj.status,
            payment_status: obj.payment_status,
            payment_intent: idOf(obj.payment_intent),
            setup_intent: idOf(obj.setup_intent),
            charge: idOf(obj.charge),
            customer: idOf(obj.customer),
            metadata: metaOf(obj.metadata),
            amount: obj.amount,
            amount_refunded: obj.amount_refunded,
            off_session: (obj as { setup_future_usage?: unknown }).setup_future_usage,
            last_payment_error_code: (obj.last_payment_error as { code?: string } | null)?.code ?? null,
            decline_code: (obj.last_payment_error as { decline_code?: string } | null)?.decline_code ?? null,
            card: cardFrom(null, obj),
          },
        } satisfies ProviderEvent;
      } catch {
        return null;
      }
    },
  };
}

/** Test helper: a signed Stripe-Signature header for a payload (the SDK's own generator). */
export function stripeTestSignature(payload: string, secret: string, timestampSec?: number): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret, ...(timestampSec ? { timestamp: timestampSec } : {}) });
}

export { STRIPE_API_VERSION };
