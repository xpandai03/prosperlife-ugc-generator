/**
 * XPAND Credits Service (Phase 9)
 *
 * Core credit system business logic:
 * - Balance management
 * - Credit deduction and addition
 * - Transaction logging
 * - Pricing lookups
 */

import { db } from '../db.js';
import {
  userCredits,
  creditTransactions,
  creditPricing,
  globalCreditSettings,
  type UserCredits,
  type CreditTransaction,
  type CreditPricing,
  type GlobalCreditSettings,
  type InsertCreditTransaction,
} from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

// Default credits for new users (Prosper UGC Studio: 5000)
const DEFAULT_NEW_USER_CREDITS = 5000;

/**
 * Get user's current credit balance
 */
export async function getBalance(userId: string): Promise<number> {
  const [record] = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userId, userId));

  return record?.balance ?? 0;
}

/**
 * Get full user credits record (balance + lifetime stats)
 */
export async function getUserCredits(userId: string): Promise<UserCredits | null> {
  const [record] = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userId, userId));

  return record ?? null;
}

/**
 * Get credit cost for a specific feature
 */
export async function getFeatureCost(featureKey: string): Promise<number> {
  const [pricing] = await db
    .select()
    .from(creditPricing)
    .where(eq(creditPricing.featureKey, featureKey));

  if (!pricing) {
    console.warn(`[CreditService] No pricing found for feature: ${featureKey}`);
    return 0;
  }

  return pricing.creditCost;
}

/**
 * Get feature pricing details
 */
export async function getFeaturePricing(featureKey: string): Promise<CreditPricing | null> {
  const [pricing] = await db
    .select()
    .from(creditPricing)
    .where(eq(creditPricing.featureKey, featureKey));

  return pricing ?? null;
}

/**
 * Get all feature pricing (for admin dashboard)
 */
export async function getAllPricing(): Promise<CreditPricing[]> {
  return db.select().from(creditPricing).orderBy(creditPricing.featureName);
}

/**
 * Check if user has enough credits for a feature
 */
export async function checkCredits(userId: string, featureKey: string): Promise<{
  hasEnough: boolean;
  balance: number;
  required: number;
  featureName: string;
}> {
  const [balanceRecord, pricing] = await Promise.all([
    db.select().from(userCredits).where(eq(userCredits.userId, userId)),
    db.select().from(creditPricing).where(eq(creditPricing.featureKey, featureKey)),
  ]);

  const balance = balanceRecord[0]?.balance ?? 0;
  const required = pricing[0]?.creditCost ?? 0;
  const featureName = pricing[0]?.featureName ?? featureKey;

  return {
    hasEnough: balance >= required,
    balance,
    required,
    featureName,
  };
}

/**
 * Deduct credits for using a feature
 * Returns the transaction record or null if insufficient credits
 */
export async function deductCredits(
  userId: string,
  featureKey: string,
  metadata?: Record<string, unknown>
): Promise<CreditTransaction | null> {
  // Get current balance and pricing
  const [balanceRecord] = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userId, userId));

  const [pricing] = await db
    .select()
    .from(creditPricing)
    .where(eq(creditPricing.featureKey, featureKey));

  if (!pricing) {
    console.error(`[CreditService] No pricing for feature: ${featureKey}`);
    return null;
  }

  const currentBalance = balanceRecord?.balance ?? 0;
  const cost = pricing.creditCost;

  if (currentBalance < cost) {
    console.warn(`[CreditService] Insufficient credits for ${userId}: has ${currentBalance}, needs ${cost}`);
    return null;
  }

  const newBalance = currentBalance - cost;

  // Update balance
  if (balanceRecord) {
    await db
      .update(userCredits)
      .set({
        balance: newBalance,
        lifetimeUsed: sql`${userCredits.lifetimeUsed} + ${cost}`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, userId));
  } else {
    // Should not happen, but create record if missing
    await db.insert(userCredits).values({
      userId,
      balance: newBalance,
      lifetimePurchased: 0,
      lifetimeUsed: cost,
    });
  }

  // Log transaction
  const [transaction] = await db
    .insert(creditTransactions)
    .values({
      userId,
      amount: -cost,
      balanceAfter: newBalance,
      featureKey,
      description: `Used ${pricing.featureName}`,
      metadata: metadata ?? null,
    })
    .returning();

  console.log(`[CreditService] Deducted ${cost} credits from ${userId} for ${featureKey}. New balance: ${newBalance}`);

  return transaction;
}

/**
 * Deduct a specific amount of credits (for dynamic pricing)
 * Unlike deductCredits, this accepts a direct credit amount instead of a featureKey lookup
 * Returns the transaction record or null if insufficient credits
 */
export async function deductCreditsAmount(
  userId: string,
  amount: number,
  description: string,
  metadata?: Record<string, unknown>
): Promise<CreditTransaction | null> {
  // Get current balance
  const [balanceRecord] = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userId, userId));

  const currentBalance = balanceRecord?.balance ?? 0;

  if (currentBalance < amount) {
    console.warn(`[CreditService] Insufficient credits for ${userId}: has ${currentBalance}, needs ${amount}`);
    return null;
  }

  const newBalance = currentBalance - amount;

  // Update balance
  if (balanceRecord) {
    await db
      .update(userCredits)
      .set({
        balance: newBalance,
        lifetimeUsed: sql`${userCredits.lifetimeUsed} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, userId));
  } else {
    // Should not happen, but create record if missing
    await db.insert(userCredits).values({
      userId,
      balance: newBalance,
      lifetimePurchased: 0,
      lifetimeUsed: amount,
    });
  }

  // Log transaction
  const [transaction] = await db
    .insert(creditTransactions)
    .values({
      userId,
      amount: -amount,
      balanceAfter: newBalance,
      featureKey: 'ugc_dynamic', // Dynamic UGC pricing
      description,
      metadata: metadata ?? null,
    })
    .returning();

  console.log(`[CreditService] Deducted ${amount} credits from ${userId} (dynamic). New balance: ${newBalance}`);

  return transaction;
}

/**
 * Add credits to user account (purchases, bonuses, refunds)
 */
export async function addCredits(
  userId: string,
  amount: number,
  description: string,
  stripePaymentId?: string,
  metadata?: Record<string, unknown>
): Promise<CreditTransaction> {
  // Get current balance
  const [balanceRecord] = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userId, userId));

  const currentBalance = balanceRecord?.balance ?? 0;
  const newBalance = currentBalance + amount;

  // Update or create balance record
  if (balanceRecord) {
    await db
      .update(userCredits)
      .set({
        balance: newBalance,
        lifetimePurchased: sql`${userCredits.lifetimePurchased} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, userId));
  } else {
    await db.insert(userCredits).values({
      userId,
      balance: newBalance,
      lifetimePurchased: amount,
      lifetimeUsed: 0,
    });
  }

  // Log transaction
  const [transaction] = await db
    .insert(creditTransactions)
    .values({
      userId,
      amount,
      balanceAfter: newBalance,
      featureKey: null,
      description,
      stripePaymentId: stripePaymentId ?? null,
      metadata: metadata ?? null,
    })
    .returning();

  console.log(`[CreditService] Added ${amount} credits to ${userId}. New balance: ${newBalance}`);

  return transaction;
}

/**
 * Get user's transaction history
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 50
): Promise<CreditTransaction[]> {
  return db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);
}

/**
 * Initialize credits for a new user (50 free credits)
 */
export async function initializeUserCredits(userId: string): Promise<UserCredits> {
  // Check if already exists
  const [existing] = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userId, userId));

  if (existing) {
    return existing;
  }

  // Create new record with free credits
  const [record] = await db
    .insert(userCredits)
    .values({
      userId,
      balance: DEFAULT_NEW_USER_CREDITS,
      lifetimePurchased: DEFAULT_NEW_USER_CREDITS,
      lifetimeUsed: 0,
    })
    .returning();

  // Log the welcome bonus
  await db.insert(creditTransactions).values({
    userId,
    amount: DEFAULT_NEW_USER_CREDITS,
    balanceAfter: DEFAULT_NEW_USER_CREDITS,
    featureKey: null,
    description: 'Welcome bonus credits',
    metadata: { type: 'welcome_bonus' },
  });

  console.log(`[CreditService] Initialized ${DEFAULT_NEW_USER_CREDITS} credits for new user ${userId}`);

  return record;
}

/**
 * Get global credit settings (markup factor, price per credit)
 */
export async function getGlobalSettings(): Promise<GlobalCreditSettings | null> {
  const [settings] = await db.select().from(globalCreditSettings).limit(1);
  return settings ?? null;
}

/**
 * Update global credit settings (admin only)
 */
export async function updateGlobalSettings(
  markupFactor: number,
  pricePerCreditUsd: number
): Promise<GlobalCreditSettings> {
  // Get existing record
  const [existing] = await db.select().from(globalCreditSettings).limit(1);

  if (existing) {
    const [updated] = await db
      .update(globalCreditSettings)
      .set({
        markupFactor: markupFactor.toFixed(2),
        pricePerCreditUsd: pricePerCreditUsd.toFixed(4),
        updatedAt: new Date(),
      })
      .where(eq(globalCreditSettings.id, existing.id))
      .returning();

    console.log(`[CreditService] Updated global settings: markup=${markupFactor}, price=${pricePerCreditUsd}`);
    return updated;
  }

  // Create if doesn't exist
  const [created] = await db
    .insert(globalCreditSettings)
    .values({
      markupFactor: markupFactor.toFixed(2),
      pricePerCreditUsd: pricePerCreditUsd.toFixed(4),
    })
    .returning();

  return created;
}

/**
 * Update feature pricing (admin only)
 */
export async function updateFeaturePricing(
  featureKey: string,
  updates: { creditCost?: number; baseCostUsd?: number; isActive?: boolean }
): Promise<CreditPricing | null> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (updates.creditCost !== undefined) {
    updateData.creditCost = updates.creditCost;
  }
  if (updates.baseCostUsd !== undefined) {
    updateData.baseCostUsd = updates.baseCostUsd.toFixed(4);
  }
  if (updates.isActive !== undefined) {
    updateData.isActive = updates.isActive;
  }

  const [updated] = await db
    .update(creditPricing)
    .set(updateData)
    .where(eq(creditPricing.featureKey, featureKey))
    .returning();

  if (updated) {
    console.log(`[CreditService] Updated pricing for ${featureKey}:`, updates);
  }

  return updated ?? null;
}

/**
 * Admin: Manually add credits to any user
 */
export async function adminAddCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<CreditTransaction> {
  return addCredits(userId, amount, `Admin: ${reason}`, undefined, {
    type: 'admin_grant',
    reason,
  });
}

/**
 * Credit packages available for purchase (Updated Dec 2025)
 */
export const CREDIT_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 500,
    priceUsd: 9.99,
    perCredit: 0.020,
    stripePriceId: 'price_credit_starter',
  },
  {
    id: 'basic',
    name: 'Basic',
    credits: 1500,
    priceUsd: 24.99,
    perCredit: 0.0167,
    stripePriceId: 'price_credit_basic',
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 5000,
    priceUsd: 69.99,
    perCredit: 0.014,
    stripePriceId: 'price_credit_pro',
  },
  {
    id: 'agency',
    name: 'Agency',
    credits: 12000,
    priceUsd: 149.99,
    perCredit: 0.0125,
    stripePriceId: 'price_credit_agency',
    badge: 'Best Value',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    credits: 30000,
    priceUsd: 349.99,
    perCredit: 0.0117,
    stripePriceId: 'price_credit_enterprise',
    badge: 'High Volume',
  },
] as const;

export type CreditPackage = typeof CREDIT_PACKAGES[number];

/**
 * Get credit package by ID
 */
export function getCreditPackage(packageId: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === packageId);
}

// ==================== CONTENT ENGINE CREDITS (Jan 2026) ====================

/**
 * Content Engine credit costs (per minute of video)
 * Long-form video rendering is more expensive than short-form UGC
 */
export const CONTENT_ENGINE_CREDITS = {
  // Base cost per minute of video
  perMinute: 30,
  // Minimum credits (3-minute video)
  minimum: 90,
  // Maximum credits (10-minute video)
  maximum: 300,
} as const;

/**
 * Calculate credit cost for a Content Engine render
 * Based on target duration in seconds
 */
export function calculateContentEngineCredits(durationSeconds: number): number {
  const durationMinutes = durationSeconds / 60;
  const cost = Math.ceil(durationMinutes * CONTENT_ENGINE_CREDITS.perMinute);
  
  // Enforce min/max bounds
  return Math.max(
    CONTENT_ENGINE_CREDITS.minimum,
    Math.min(cost, CONTENT_ENGINE_CREDITS.maximum)
  );
}

/**
 * Check if user has enough credits for Content Engine render
 */
export async function checkContentEngineCredits(
  userId: string,
  durationSeconds: number
): Promise<{
  hasEnough: boolean;
  balance: number;
  required: number;
  durationMinutes: number;
}> {
  const balance = await getBalance(userId);
  const required = calculateContentEngineCredits(durationSeconds);
  const durationMinutes = Math.round(durationSeconds / 60);

  return {
    hasEnough: balance >= required,
    balance,
    required,
    durationMinutes,
  };
}

/**
 * Deduct credits for Content Engine render
 */
export async function deductContentEngineCredits(
  userId: string,
  durationSeconds: number,
  sceneSpecId: string,
  title: string
): Promise<CreditTransaction | null> {
  const cost = calculateContentEngineCredits(durationSeconds);
  const durationMinutes = Math.round(durationSeconds / 60);
  
  return deductCreditsAmount(
    userId,
    cost,
    `Content Engine: ${title} (${durationMinutes} min)`,
    {
      type: 'content_engine_render',
      sceneSpecId,
      durationSeconds,
      durationMinutes,
    }
  );
}
