// src/services/auth.service.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ApiError } from '../lib/apiError.js';

// Get JWT secret with type safety
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return secret;
};

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  private generateTokens(userId: string, email: string) {
    const secret = getJwtSecret();
    const expiresIn = (process.env.JWT_EXPIRES_IN as string) || '15m';
    const refreshExpiresIn = (process.env.REFRESH_TOKEN_EXPIRES_IN as string) || '7d';

    const accessToken = jwt.sign(
      { userId, email },
      secret,
      { expiresIn: expiresIn } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId, email },
      secret,
      { expiresIn: refreshExpiresIn } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
  }

  async register(username: string, email: string, password: string, referralCode?: string) {
    // Validate inputs
    if (!username || username.length < 3) {
      throw ApiError.badRequest('Username must be at least 3 characters');
    }
    if (!email || !email.includes('@')) {
      throw ApiError.badRequest('Valid email is required');
    }
    if (!password || password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters');
    }

    // Check if user exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw ApiError.badRequest('Email already registered');
      }
      throw ApiError.badRequest('Username already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate unique referral code
    const userReferralCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Get Bronze tier
    const bronzeTier = await this.prisma.tier.findUnique({
      where: { slug: 'bronze' },
    });

    if (!bronzeTier) {
      throw ApiError.internal('Tier configuration missing');
    }

    // Handle referral if provided
    let referredBy = null;
    if (referralCode) {
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode },
      });
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    // Create user
    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        passwordHash: hashedPassword,
        referralCode: userReferralCode,
        referredById: referredBy,
        tierId: bronzeTier.id,
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        coinBalance: true,
        referralCode: true,
        payoutUnlocked: true,
        createdAt: true,
        tier: {
          select: {
            slug: true,
            name: true,
            colorHex: true,
          },
        },
      },
    });

    // Create referral event if referred
    if (referralCode && referredBy) {
      await this.prisma.referralEvent.create({
        data: {
          referrerId: referredBy,
          referredId: user.id,
        },
      });
    }

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.email);

    // Store refresh token hash
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 12);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashedRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { user, ...tokens };
  }

  async login(email: string, password: string) {
    // Validate inputs
    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required');
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tier: {
          select: {
            slug: true,
            name: true,
            colorHex: true,
          },
        },
      },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Check if banned
    if (user.isBanned) {
      throw ApiError.forbidden(`Account banned: ${user.banReason || 'Violation of terms'}`);
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.email);

    // Store refresh token hash
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 12);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashedRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        coinBalance: user.coinBalance,
        tier: user.tier,
        referralCode: user.referralCode,
        payoutUnlocked: user.payoutUnlocked,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw ApiError.badRequest('Refresh token required');
    }

    const secret = getJwtSecret();

    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, secret) as {
        userId: string;
        email: string;
      };

      // Check if token exists in DB and not revoked
      const storedTokens = await this.prisma.refreshToken.findMany({
        where: {
          userId: payload.userId,
          revoked: false,
          expiresAt: { gt: new Date() },
        },
      });

      // Find matching token
      let validToken = null;
      for (const token of storedTokens) {
        const isValid = await bcrypt.compare(refreshToken, token.tokenHash);
        if (isValid) {
          validToken = token;
          break;
        }
      }

      if (!validToken) {
        throw ApiError.unauthorized('Invalid refresh token');
      }

      // Generate new tokens
      const newTokens = this.generateTokens(payload.userId, payload.email);

      // Store new refresh token
      const newHashedToken = await bcrypt.hash(newTokens.refreshToken, 12);
      await this.prisma.refreshToken.create({
        data: {
          userId: payload.userId,
          tokenHash: newHashedToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Revoke old token
      await this.prisma.refreshToken.update({
        where: { id: validToken.id },
        data: { revoked: true },
      });

      return newTokens;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthorized('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw ApiError.unauthorized('Invalid refresh token');
      }
      throw error;
    }
  }

  async logout(userId: string, refreshToken: string) {
    // Find and revoke the refresh token
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revoked: false,
      },
    });

    for (const token of tokens) {
      const isValid = await bcrypt.compare(refreshToken, token.tokenHash);
      if (isValid) {
        await this.prisma.refreshToken.update({
          where: { id: token.id },
          data: { revoked: true },
        });
        break;
      }
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tier: {
          select: {
            slug: true,
            name: true,
            colorHex: true,
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      coinBalance: user.coinBalance,
      tier: user.tier,
      referralCode: user.referralCode,
      payoutUnlocked: user.payoutUnlocked,
      createdAt: user.createdAt,
    };
  }
}