import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../services/supabaseAuth';
import { storage } from '../storage';

/**
 * Extend Express Request type to include userId
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Authentication Middleware
 *
 * Validates the JWT token from the Authorization header and attaches
 * the authenticated user's ID to the request object.
 *
 * Usage:
 *   app.use('/api/*', requireAuth)
 *   app.post('/api/videos', async (req, res) => {
 *     const userId = req.userId; // Available after middleware
 *   })
 *
 * @param req Express request object
 * @param res Express response object
 * @param next Next function
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(req.headers['user-agent'] || '');

    // Mobile Debug: Log initial auth state
    if (isMobile) {
      console.log('[Auth Middleware Mobile Debug]', {
        path: req.path,
        hasAuthHeader: !!authHeader,
        headerFormat: authHeader?.substring(0, 20),
        userAgent: req.headers['user-agent']?.substring(0, 80),
      });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Auth Middleware] Missing or invalid auth header', {
        path: req.path,
        isMobile,
        hasHeader: !!authHeader,
        headerStart: authHeader?.substring(0, 10),
      });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header. Please provide a Bearer token.',
      });
      return;
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      console.error('[Auth Middleware] No token in Bearer header', { path: req.path, isMobile });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided in authorization header.',
      });
      return;
    }

    // Validate token using Supabase Admin client
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.error('[Auth Middleware] Token validation failed:', {
        error: error?.message || 'User not found',
        path: req.path,
        isMobile,
        tokenLength: token.length,
      });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token. Please log in again.',
      });
      return;
    }

    if (isMobile) {
      console.log('[Auth Middleware Mobile Debug] Token validated:', {
        userId: user.id,
        email: user.email,
        path: req.path,
      });
    }

    // Ensure user exists in database (auto-create if first time)
    // Mobile Fix: Retry with exponential backoff for slow network/trigger race conditions
    let existingUser = await storage.getUser(user.id);

    if (!existingUser) {
      console.log(`[Auth Middleware] User not found in DB, creating: ${user.id} (${user.email})`);

      // Helper function to wait with exponential backoff
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      try {
        await storage.createUser({
          id: user.id,
          email: user.email || 'unknown@example.com',
          fullName: user.user_metadata?.full_name || null,
        });
        console.log(`[Auth Middleware] User created successfully: ${user.id}`);

        // Verify user was created
        existingUser = await storage.getUser(user.id);
        if (!existingUser) {
          console.error(`[Auth Middleware] CRITICAL: User creation succeeded but getUser returned null for ${user.id}`);
          res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create user record. Please try again or contact support.',
          });
          return;
        }
      } catch (dbError: any) {
        console.error('[Auth Middleware] Failed to create user in database:', dbError);

        // Check if it's a duplicate key error (user created by trigger in parallel)
        if (dbError.code === '23505' || dbError.message?.includes('duplicate key')) {
          console.log(`[Auth Middleware] User ${user.id} already exists (parallel creation), retrying with backoff...`);

          // Mobile Fix: Retry up to 3 times with exponential backoff (100ms, 300ms, 900ms)
          let retryCount = 0;
          const maxRetries = 3;

          while (retryCount < maxRetries && !existingUser) {
            const backoffMs = 100 * Math.pow(3, retryCount); // 100ms, 300ms, 900ms
            console.log(`[Auth Middleware] Retry ${retryCount + 1}/${maxRetries} after ${backoffMs}ms...`);
            await wait(backoffMs);

            existingUser = await storage.getUser(user.id);
            if (existingUser) {
              console.log(`[Auth Middleware] User found on retry ${retryCount + 1}: ${user.id}`);
              break;
            }
            retryCount++;
          }

          // If still not found after retries, fail with helpful error
          if (!existingUser) {
            console.error(`[Auth Middleware] CRITICAL: User ${user.id} not found after ${maxRetries} retries (total wait: ${100 + 300 + 900}ms)`);
            res.status(500).json({
              error: 'Internal Server Error',
              message: 'Account synchronization in progress. Please wait a moment and try again.',
            });
            return;
          }
        } else {
          // Other database error - fail the request
          res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to initialize user account. Please try again.',
          });
          return;
        }
      }
    }

    // Attach user ID to request for downstream handlers
    req.userId = user.id;

    // Continue to next middleware/route handler
    next();
  } catch (error) {
    console.error('Auth middleware exception:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed due to server error.',
    });
    return;
  }
}
