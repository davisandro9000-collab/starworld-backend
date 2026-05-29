import { Request, Response, NextFunction } from 'express';
import { validate as isValidUUID } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip GET requests
  if (req.method === 'GET') return next();

  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header required' });
  }

  if (!isValidUUID(idempotencyKey)) {
    return res.status(400).json({ error: 'Idempotency-Key must be a valid UUID v4' });
  }

  req.idempotencyKey = idempotencyKey;
  next();
}
