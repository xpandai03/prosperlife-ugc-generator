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

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header. Please provide a Bearer token.',
      });
      return;
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided in authorization header.',
      });
      return;
    }

    // Validate token using Supabase Admin client
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.error('Auth middleware error:', error?.message || 'User not found');
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token. Please log in again.',
      });
      return;
    }

    // Ensure user exists in database (auto-create if first time)
    let existingUser = await storage.getUser(user.id);

    if (!existingUser) {
      console.log(`[Auth Middleware] User not found in DB, creating: ${user.id} (${user.email})`);
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
          console.log(`[Auth Middleware] User ${user.id} already exists (parallel creation), continuing...`);
          // Fetch again in case it was created by trigger
          existingUser = await storage.getUser(user.id);
          if (!existingUser) {
            res.status(500).json({
              error: 'Internal Server Error',
              message: 'User synchronization error. Please log out and log back in.',
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
