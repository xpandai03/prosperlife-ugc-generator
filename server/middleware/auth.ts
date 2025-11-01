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
    // Split Database Fix: Handles Neon + Supabase auth separation
    let existingUser = await storage.getUser(user.id);

    if (!existingUser) {
      console.log(`[Auth Middleware] User not found by ID: ${user.id}, checking by email: ${user.email}`);

      // CRITICAL FIX: Check if user exists with same email but different ID
      // This handles the split database issue (Supabase auth vs Neon app DB)
      const userByEmail = user.email ? await storage.getUserByEmail(user.email) : null;

      if (userByEmail) {
        console.log(`[Auth Middleware] Found user by email with different ID`, {
          authUserId: user.id,
          dbUserId: userByEmail.id,
          email: user.email,
        });

        // Update the user ID to match Supabase auth
        try {
          const updatedUser = await storage.updateUserIdByEmail(user.email!, user.id);
          if (updatedUser) {
            console.log(`[Auth Middleware] Successfully reconciled user ID for ${user.email}`);
            existingUser = updatedUser;
          } else {
            console.error(`[Auth Middleware] Failed to update user ID for ${user.email}`);
            res.status(500).json({
              error: 'Internal Server Error',
              message: 'Failed to reconcile user account. Please contact support.',
            });
            return;
          }
        } catch (updateError: any) {
          console.error('[Auth Middleware] Error updating user ID:', updateError);
          res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to reconcile user account. Please contact support.',
          });
          return;
        }
      } else {
        // User doesn't exist by ID or email - create new user
        console.log(`[Auth Middleware] Creating new user: ${user.id} (${user.email})`);

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

          // Check if it's a duplicate key error (race condition with trigger or parallel request)
          if (dbError.code === '23505' || dbError.message?.includes('duplicate key')) {
            console.log(`[Auth Middleware] Duplicate key error, attempting to fetch user again`);

            // Try to get user by ID one more time
            existingUser = await storage.getUser(user.id);

            // If still not found, try by email
            if (!existingUser && user.email) {
              existingUser = await storage.getUserByEmail(user.email);

              if (existingUser && existingUser.id !== user.id) {
                // Reconcile the ID mismatch
                try {
                  existingUser = await storage.updateUserIdByEmail(user.email, user.id);
                } catch (reconcileError) {
                  console.error('[Auth Middleware] Failed to reconcile after duplicate key error:', reconcileError);
                }
              }
            }

            if (!existingUser) {
              console.error(`[Auth Middleware] CRITICAL: Duplicate key error but user not found: ${user.id}`);
              res.status(500).json({
                error: 'Internal Server Error',
                message: 'Account synchronization error. Please try again or contact support.',
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
