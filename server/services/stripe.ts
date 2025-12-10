/**
 * Stripe Service (Phase 9: XPAND Credits)
 *
 * Handles Stripe API interactions for credit package purchases
 * Supports white-label: checks DB stripe_settings first, falls back to env vars
 * Documentation: https://stripe.com/docs/api
 */

import Stripe from 'stripe';
import { CREDIT_PACKAGES, type CreditPackage } from './creditService';
import { storage } from '../storage';

// Environment variables (fallback)
const ENV_STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const ENV_STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const ENV_PRICE_ID_STARTER = process.env.STRIPE_PRICE_ID_STARTER;
const ENV_PRICE_ID_BASIC = process.env.STRIPE_PRICE_ID_BASIC;
const ENV_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO;
const ENV_PRICE_ID_BUSINESS = process.env.STRIPE_PRICE_ID_BUSINESS;

// Cached Stripe instance (may be replaced by DB settings)
let cachedStripe: Stripe | null = null;
let cachedSecretKey: string | null = null;

if (!ENV_STRIPE_SECRET_KEY) {
  console.warn('[Stripe] Warning: STRIPE_SECRET_KEY not configured in env vars');
}

/**
 * Get Stripe instance - checks DB settings first, falls back to env vars
 */
async function getStripeInstance(): Promise<Stripe | null> {
  try {
    const dbSettings = await storage.getStripeSettings();
    const secretKey = dbSettings?.secretKey || ENV_STRIPE_SECRET_KEY;

    if (!secretKey) {
      console.warn('[Stripe] No secret key available (DB or env)');
      return null;
    }

    // If key changed or first init, create new instance
    if (cachedSecretKey !== secretKey) {
      cachedSecretKey = secretKey;
      cachedStripe = new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' as any });
      console.log('[Stripe] Initialized with', dbSettings?.secretKey ? 'DB settings' : 'env vars');
    }

    return cachedStripe;
  } catch (error) {
    console.error('[Stripe] Error getting Stripe instance:', error);
    // Fallback to env on error
    if (ENV_STRIPE_SECRET_KEY && !cachedStripe) {
      cachedStripe = new Stripe(ENV_STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' as any });
      cachedSecretKey = ENV_STRIPE_SECRET_KEY;
    }
    return cachedStripe;
  }
}

/**
 * Get webhook secret - checks DB settings first, falls back to env vars
 */
async function getWebhookSecret(): Promise<string | null> {
  try {
    const dbSettings = await storage.getStripeSettings();
    return dbSettings?.webhookSecret || ENV_STRIPE_WEBHOOK_SECRET || null;
  } catch {
    return ENV_STRIPE_WEBHOOK_SECRET || null;
  }
}

/**
 * Get price ID for a package - checks DB settings first, falls back to env vars
 */
async function getPriceId(packageId: string): Promise<string | null> {
  try {
    const dbSettings = await storage.getStripeSettings();
    switch (packageId) {
      case 'starter':
        return dbSettings?.priceIdStarter || ENV_PRICE_ID_STARTER || null;
      case 'basic':
        return dbSettings?.priceIdBasic || ENV_PRICE_ID_BASIC || null;
      case 'pro':
        return dbSettings?.priceIdPro || ENV_PRICE_ID_PRO || null;
      case 'business':
        return dbSettings?.priceIdBusiness || ENV_PRICE_ID_BUSINESS || null;
      default:
        return null;
    }
  } catch {
    // Fallback to env on error
    switch (packageId) {
      case 'starter': return ENV_PRICE_ID_STARTER || null;
      case 'basic': return ENV_PRICE_ID_BASIC || null;
      case 'pro': return ENV_PRICE_ID_PRO || null;
      case 'business': return ENV_PRICE_ID_BUSINESS || null;
      default: return null;
    }
  }
}

// Legacy: Initialize default Stripe SDK from env for backwards compat
const stripe = ENV_STRIPE_SECRET_KEY
  ? new Stripe(ENV_STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' as any })
  : null;

// Legacy subscription params (deprecated)
export interface CreateCheckoutSessionParams {
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}

// Phase 9: Credit package checkout params
export interface CreateCreditCheckoutParams {
  userId: string;
  userEmail: string;
  packageId: string; // 'starter', 'basic', 'pro', 'business'
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export const stripeService = {
  /**
   * Create a Stripe Checkout Session for Pro subscription
   *
   * @param params - User ID, email, and redirect URLs
   * @returns Checkout session ID and URL
   */
  async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<CheckoutSessionResponse> {
    if (!stripe || !STRIPE_PRICE_ID_PRO) {
      console.error('[Stripe] Configuration check failed:', {
        stripeInitialized: !!stripe,
        secretKeyPresent: !!STRIPE_SECRET_KEY,
        priceIdPresent: !!STRIPE_PRICE_ID_PRO,
        priceIdValue: STRIPE_PRICE_ID_PRO ? `${STRIPE_PRICE_ID_PRO.substring(0, 10)}...` : 'undefined'
      });
      throw new Error('Stripe is not configured');
    }

    console.log('[Stripe] Creating checkout session:', {
      userId: params.userId,
      email: params.userEmail,
    });

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: STRIPE_PRICE_ID_PRO,
            quantity: 1,
          },
        ],
        customer_email: params.userEmail,
        client_reference_id: params.userId, // Link session to our user
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        allow_promotion_codes: true, // Enable promo codes
        billing_address_collection: 'required',
        subscription_data: {
          metadata: {
            userId: params.userId,
          },
        },
      });

      console.log('[Stripe] Checkout session created:', {
        sessionId: session.id,
        url: session.url,
      });

      return {
        sessionId: session.id,
        url: session.url!,
      };
    } catch (error: any) {
      console.error('[Stripe] Error creating checkout session:', error);
      throw new Error(`Stripe error: ${error.message}`);
    }
  },

  /**
   * Phase 9: Create a Stripe Checkout Session for credit package purchase
   * Uses DB settings if available, falls back to env vars
   *
   * @param params - User ID, email, package ID, and redirect URLs
   * @returns Checkout session ID and URL
   */
  async createCreditCheckoutSession(
    params: CreateCreditCheckoutParams
  ): Promise<CheckoutSessionResponse> {
    // Get dynamic Stripe instance (checks DB first)
    const stripeInstance = await getStripeInstance();
    if (!stripeInstance) {
      console.error('[Stripe] Configuration check failed: No Stripe instance available');
      throw new Error('Stripe is not configured');
    }

    // Find the credit package
    const creditPackage = CREDIT_PACKAGES.find(p => p.id === params.packageId);
    if (!creditPackage) {
      throw new Error(`Invalid credit package: ${params.packageId}`);
    }

    // Check for configured price ID (DB or env)
    const priceId = await getPriceId(params.packageId);

    console.log('[Stripe] Creating credit checkout session:', {
      userId: params.userId,
      email: params.userEmail,
      package: creditPackage.name,
      credits: creditPackage.credits,
      priceUsd: creditPackage.priceUsd,
      usingPriceId: !!priceId,
    });

    try {
      // Build line items - use price ID if available, otherwise use price_data
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
        ? [{ price: priceId, quantity: 1 }]
        : [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${creditPackage.name} Credit Pack`,
                description: `${creditPackage.credits} XPAND Credits for Streamline AI`,
              },
              unit_amount: Math.round(creditPackage.priceUsd * 100), // Stripe uses cents
            },
            quantity: 1,
          }];

      const session = await stripeInstance.checkout.sessions.create({
        mode: 'payment', // One-time payment, not subscription
        payment_method_types: ['card'],
        line_items: lineItems,
        customer_email: params.userEmail,
        client_reference_id: params.userId, // Link session to our user
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        allow_promotion_codes: true,
        metadata: {
          userId: params.userId,
          packageId: creditPackage.id,
          credits: creditPackage.credits.toString(),
          type: 'credit_purchase',
        },
      });

      console.log('[Stripe] Credit checkout session created:', {
        sessionId: session.id,
        url: session.url,
        credits: creditPackage.credits,
      });

      return {
        sessionId: session.id,
        url: session.url!,
      };
    } catch (error: any) {
      console.error('[Stripe] Error creating credit checkout session:', error);
      throw new Error(`Stripe error: ${error.message}`);
    }
  },

  /**
   * Create or retrieve a Stripe Customer for a user
   *
   * @param email - User's email
   * @param userId - User's ID (stored in metadata)
   * @returns Stripe Customer ID
   */
  async createCustomer(email: string, userId: string): Promise<string> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    console.log('[Stripe] Creating customer:', { email, userId });

    try {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          userId,
        },
      });

      console.log('[Stripe] Customer created:', {
        customerId: customer.id,
        email: customer.email,
      });

      return customer.id;
    } catch (error: any) {
      console.error('[Stripe] Error creating customer:', error);
      throw new Error(`Stripe error: ${error.message}`);
    }
  },

  /**
   * Get customer's active subscriptions
   *
   * @param customerId - Stripe Customer ID
   * @returns List of active subscriptions
   */
  async getActiveSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 10,
      });

      return subscriptions.data;
    } catch (error: any) {
      console.error('[Stripe] Error fetching subscriptions:', error);
      throw new Error(`Stripe error: ${error.message}`);
    }
  },

  /**
   * Create a Stripe Customer Portal session
   *
   * Allows users to manage their subscription, update payment method, view invoices
   *
   * @param customerId - Stripe Customer ID
   * @param returnUrl - URL to return to after portal session
   * @returns Portal session URL
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    console.log('[Stripe] Creating portal session:', { customerId });

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      console.log('[Stripe] Portal session created:', {
        url: session.url,
      });

      return session.url;
    } catch (error: any) {
      console.error('[Stripe] Error creating portal session:', error);
      throw new Error(`Stripe error: ${error.message}`);
    }
  },

  /**
   * Verify Stripe webhook signature
   * Uses DB settings if available, falls back to env vars
   *
   * @param payload - Raw request body
   * @param signature - Stripe-Signature header
   * @returns Parsed Stripe event
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    try {
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error: any) {
      console.error('[Stripe] Webhook signature verification failed:', error);
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
  },

  /**
   * Verify Stripe webhook signature (async version)
   * Checks DB settings first, falls back to env vars
   *
   * @param payload - Raw request body
   * @param signature - Stripe-Signature header
   * @returns Parsed Stripe event
   */
  async verifyWebhookSignatureAsync(payload: string | Buffer, signature: string): Promise<Stripe.Event> {
    const stripeInstance = await getStripeInstance();
    if (!stripeInstance) {
      throw new Error('Stripe is not configured');
    }

    const webhookSecret = await getWebhookSecret();
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured (DB or env)');
    }

    try {
      return stripeInstance.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error: any) {
      console.error('[Stripe] Webhook signature verification failed:', error);
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
  },
};
