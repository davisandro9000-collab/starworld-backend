// src/controllers/adminAuth.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ApiError } from '../lib/apiError.js';

const prisma = new PrismaClient();

export const adminLogin = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw ApiError.badRequest('Email and password required');
  }

  const admin = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!admin) {
    throw ApiError.unauthorized('Invalid admin credentials');
  }

  const isValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isValid) {
    throw ApiError.unauthorized('Invalid admin credentials');
  }

  const adminJwtSecret = process.env.ADMIN_JWT_SECRET;
  if (!adminJwtSecret) {
    throw ApiError.internal('Admin JWT secret not configured');
  }

  const token = jwt.sign(
    {
      adminId: admin.id,
      email: admin.email,
      username: admin.username,
      role: admin.role,
    },
    adminJwtSecret,
    { expiresIn: '1h' }
  );

  res.json({
    success: true,
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
    },
    token,
  });
};

export const adminGetMe = async (req: Request, res: Response) => {
  if (!req.admin) {
    throw ApiError.unauthorized('Not authenticated');
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: req.admin.id },
  });

  if (!admin) {
    throw ApiError.notFound('Admin not found');
  }

  res.json({
    success: true,
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
    },
  });
};