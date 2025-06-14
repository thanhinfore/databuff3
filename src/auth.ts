import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { config } from './config';

export interface AuthRequest extends Request {
  user?: { id: string; roles: string[] };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), config.jwtSecret) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = { id: user.id, roles: user.roles as string[] };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

export const requireRole = (role: string) => (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.roles.includes(role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
};
