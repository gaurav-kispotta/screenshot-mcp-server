import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  name: string;
  role: string;
}

// JWT authentication middleware
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication token required' });
    return;
  }
  
  try {
    // Get JWT secret from environment or config
    const secret = process.env.JWT_SECRET || 'change-this-in-production';
    
    // Verify token
    const user = jwt.verify(token, secret) as AuthUser;
    
    // Attach user to request object
    (req as any).user = user;
    
    next();
  } catch (error) {
    res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
}

// Role-based access control middleware
export function authorizeRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthUser;
    
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    
    if (roles.includes(user.role)) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
  };
}

// Rate limiting by client IP helper
export function getRateLimit(windowMs: number, maxRequests: number) {
  return {
    windowMs,
    max: maxRequests,
    message: {
      success: false,
      error: 'Too many requests, please try again later'
    }
  };
}
