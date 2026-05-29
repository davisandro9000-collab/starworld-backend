import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';

const authService = new AuthService(prisma);

export const register = async (req: Request, res: Response) => {
  const { username, email, password, referralCode } = req.body;
  
  const result = await authService.register(username, email, password, referralCode);
  
  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  
  res.status(201).json({
    success: true,
    user: result.user,
    accessToken: result.accessToken,
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  const result = await authService.login(email, password);
  
  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  
  res.json({
    success: true,
    user: result.user,
    accessToken: result.accessToken,
  });
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  
  if (!refreshToken) {
    throw ApiError.badRequest('Refresh token required');
  }
  
  const result = await authService.refreshToken(refreshToken);
  
  // Set new refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  
  res.json({
    success: true,
    accessToken: result.accessToken,
  });
};

export const logout = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  
  if (refreshToken && req.user) {
    await authService.logout(req.user.id, refreshToken);
  }
  
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
};

export const getMe = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Not authenticated');
  }
  
  const user = await authService.getMe(req.user.id);
  res.json({ success: true, user });
};