/**
 * Credit Check Middleware (Phase 9)
 *
 * Middleware to verify user has sufficient credits before
 * allowing access to paid features.
 *
 * Usage:
 *   app.post('/api/ai/generate', requireAuth, checkCredits('ugc_veo3'), handler)
 *
 * Returns 402 Payment Required if insufficient credits.
 */

import { Request, Response, NextFunction } from 'express';
import * as creditService from '../services/creditService.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      creditCost?: number;
      creditFeatureKey?: string;
    }
  }
}

/**
 * Middleware factory for credit checking
 * @param featureKey - The feature key to check credits for
 */
export function checkCredits(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get userId from auth (set by requireAuth middleware)
      const userId = (req as any).userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
      }

      // Check if user has enough credits
      const check = await creditService.checkCredits(userId, featureKey);

      if (!check.hasEnough) {
        console.log(`[CheckCredits] Insufficient credits for ${userId}: has ${check.balance}, needs ${check.required} for ${featureKey}`);

        return res.status(402).json({
          error: 'Insufficient credits',
          message: `You need ${check.required} credits for ${check.featureName}, but only have ${check.balance}`,
          required: check.required,
          balance: check.balance,
          featureKey: featureKey,
          featureName: check.featureName,
        });
      }

      // Attach credit info to request for later deduction
      req.creditCost = check.required;
      req.creditFeatureKey = featureKey;

      console.log(`[CheckCredits] ✅ User ${userId} has ${check.balance} credits (needs ${check.required} for ${featureKey})`);

      next();
    } catch (error: any) {
      console.error('[CheckCredits] Error checking credits:', error);
      return res.status(500).json({
        error: 'Credit check failed',
        message: error.message,
      });
    }
  };
}

/**
 * Middleware to deduct credits after successful API call
 * Use this AFTER the external API call succeeds
 *
 * Usage:
 *   // In your route handler, after successful API response:
 *   await deductCreditsFromRequest(req, { assetId: '...' });
 */
export async function deductCreditsFromRequest(
  req: Request,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const userId = (req as any).userId;
  const featureKey = req.creditFeatureKey;

  if (!userId || !featureKey) {
    console.warn('[DeductCredits] Missing userId or featureKey');
    return false;
  }

  const transaction = await creditService.deductCredits(userId, featureKey, metadata);

  if (!transaction) {
    console.error('[DeductCredits] Failed to deduct credits');
    return false;
  }

  return true;
}

/**
 * Dynamic credit check for routes where cost varies
 * (e.g., bulk operations, different quality levels)
 *
 * @param getFeatureKey - Function to determine feature key from request
 */
export function checkCreditsDynamic(
  getFeatureKey: (req: Request) => string | Promise<string>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const featureKey = await getFeatureKey(req);
      return checkCredits(featureKey)(req, res, next);
    } catch (error: any) {
      console.error('[CheckCreditsDynamic] Error:', error);
      return res.status(500).json({
        error: 'Credit check failed',
        message: error.message,
      });
    }
  };
}

/**
 * Check multiple credits at once (for bulk operations)
 * Returns 402 if insufficient for any operation
 */
export function checkCreditsMultiple(featureKeys: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
      }

      // Calculate total cost
      let totalRequired = 0;
      const breakdown: { featureKey: string; cost: number }[] = [];

      for (const featureKey of featureKeys) {
        const cost = await creditService.getFeatureCost(featureKey);
        totalRequired += cost;
        breakdown.push({ featureKey, cost });
      }

      // Get current balance
      const balance = await creditService.getBalance(userId);

      if (balance < totalRequired) {
        return res.status(402).json({
          error: 'Insufficient credits',
          message: `This operation requires ${totalRequired} credits, but you only have ${balance}`,
          required: totalRequired,
          balance,
          breakdown,
        });
      }

      // Attach for later
      req.creditCost = totalRequired;

      next();
    } catch (error: any) {
      console.error('[CheckCreditsMultiple] Error:', error);
      return res.status(500).json({
        error: 'Credit check failed',
        message: error.message,
      });
    }
  };
}
