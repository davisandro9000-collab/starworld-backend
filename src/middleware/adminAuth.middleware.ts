// src/middleware/adminAuth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../lib/apiError.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        email: string;
        username: string;
        role: string;
      };
    }
  }
}

export const adminAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Admin token required');
    }

    const token = authHeader.substring(7);
    const adminJwtSecret = process.env.ADMIN_JWT_SECRET;
    
    if (!adminJwtSecret) {
      console.error('❌ ADMIN_JWT_SECRET is not defined');
      throw ApiError.internal('Admin authentication not configured');
    }
    
    const decoded = jwt.verify(token, adminJwtSecret) as {
      adminId: string;
      email: string;
      username: string;
      role: string;
    };

    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.adminId },
    });

    if (!admin) {
      throw ApiError.unauthorized('Admin account not found');
    }

    req.admin = {
      id: decoded.adminId,
      email: decoded.email,
      username: decoded.username,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized('Admin token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized('Invalid admin token'));
    } else {
      next(error);
    }
  }
};