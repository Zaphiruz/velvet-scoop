import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../services/jwt';
import { User } from '../models';

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.jwt || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const payload = verifyJwt(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  const user = await User.findById(payload.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  req.user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user || !user.admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}