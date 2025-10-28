import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../services/supabaseAuth';

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
