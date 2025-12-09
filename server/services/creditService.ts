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

// Default credits for new users
const DEFAULT_NEW_USER_CREDITS = 50;

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
 * Credit packages available for purchase
 */
export const CREDIT_PACKAGES = [
  { id: 'starter', name: 'Starter', credits: 100, priceUsd: 2.99, perCredit: 0.030 },
  { id: 'basic', name: 'Basic', credits: 500, priceUsd: 12.99, perCredit: 0.026 },
  { id: 'pro', name: 'Pro', credits: 1500, priceUsd: 34.99, perCredit: 0.023 },
  { id: 'business', name: 'Business', credits: 5000, priceUsd: 99.99, perCredit: 0.020 },
] as const;

export type CreditPackage = typeof CREDIT_PACKAGES[number];

/**
 * Get credit package by ID
 */
export function getCreditPackage(packageId: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === packageId);
}
