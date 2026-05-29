import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';
import {
  welcomeEmail,
  depositCreditedEmail,
  gameWinEmail,
  auctionWinEmail,
  referralActivatedEmail,
  tierUpgradeEmail,
} from '../email/templates/index.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@starworld.com';

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  async createNotification(
    userId: string,
    data: {
      type: string;
      title: string;
      body?: string;
      ctaLabel?: string;
      ctaUrl?: string;
      accentColor?: string;
    }
  ) {
    return this.prisma.userNotification.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        body: data.body,
        ctaLabel: data.ctaLabel,
        ctaUrl: data.ctaUrl,
        accentColor: data.accentColor,
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    try {
      await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
      console.log(`📧 Email sent to ${to}`);
    } catch (error) {
      console.error('Email send failed:', error);
    }
  }

  async notifyDepositCredited(userId: string, username: string, email: string, usdValue: number, coinsAwarded: number) {
    await this.createNotification(userId, {
      type: 'deposit_credited',
      title: 'Deposit Verified!',
      body: `$${usdValue} added → ${coinsAwarded} coins credited.`,
      accentColor: '#22C55E',
    });
    await this.sendEmail(email, depositCreditedEmail(username, usdValue, coinsAwarded).subject, depositCreditedEmail(username, usdValue, coinsAwarded).html);
  }

  async notifyGameWin(userId: string, username: string, email: string, gameType: string, coinsEarned: number) {
    await this.createNotification(userId, {
      type: 'game_win',
      title: 'You Won!',
      body: `You won ${coinsEarned} coins playing ${gameType}.`,
      accentColor: '#FFD700',
    });
    await this.sendEmail(email, gameWinEmail(username, gameType, coinsEarned).subject, gameWinEmail(username, gameType, coinsEarned).html);
  }

  async notifyAuctionWin(userId: string, username: string, email: string, eventName: string, bidCoins: number) {
    await this.createNotification(userId, {
      type: 'auction_win',
      title: 'Auction Won!',
      body: `You won the auction for ${eventName} with a bid of ${bidCoins} coins.`,
      ctaUrl: '/marketplace',
      accentColor: '#00E5FF',
    });
    await this.sendEmail(email, auctionWinEmail(username, eventName, bidCoins).subject, auctionWinEmail(username, eventName, bidCoins).html);
  }

  async notifyReferralActivated(referrerId: string, referrerUsername: string, referrerEmail: string, referredUsername: string, bonusCoins: number) {
    await this.createNotification(referrerId, {
      type: 'referral_activated',
      title: 'Referral Bonus!',
      body: `${referredUsername} made their first deposit. You earned ${bonusCoins} coins.`,
      accentColor: '#CD7F32',
    });
    await this.sendEmail(referrerEmail, referralActivatedEmail(referrerUsername, referredUsername, bonusCoins).subject, referralActivatedEmail(referrerUsername, referredUsername, bonusCoins).html);
  }

  async notifyTierUpgrade(userId: string, username: string, email: string, newTier: string) {
    await this.createNotification(userId, {
      type: 'tier_upgrade',
      title: 'Tier Upgrade!',
      body: `Congratulations! You are now ${newTier} tier with better rewards.`,
      accentColor: newTier === 'Platinum' ? '#E5E4E2' : newTier === 'Silver' ? '#C0C0C0' : '#CD7F32',
    });
    await this.sendEmail(email, tierUpgradeEmail(username, newTier).subject, tierUpgradeEmail(username, newTier).html);
  }

  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      this.prisma.userNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.userNotification.count({ where: { userId } }),
    ]);
    return { notifications, total, page, totalPages: Math.ceil(total / limit) };
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.prisma.userNotification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.userNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}