import { PrismaClient } from '@prisma/client';
import { ApiError } from '../lib/apiError.js';
import { CoinService } from './coin.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { TierService } from './tier.service.js';
import { NotificationService } from './notification.service.js';

const REFERRAL_BONUS_COINS = 50;

export class ReferralService {
  private coinService: CoinService;
  private tierService: TierService;

  constructor(
    private prisma: PrismaClient,
    idempotencyService: IdempotencyService
  ) {
    this.coinService = new CoinService(prisma, idempotencyService);
    this.tierService = new TierService(prisma);
  }

  async getReferralStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, payoutUnlocked: true, totalReferrals: true }
    });
    if (!user) throw ApiError.notFound('User not found');
    const referrals = await this.prisma.referralEvent.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: {
            id: true,
            username: true,
            email: true,
            createdAt: true,
            deposits: { where: { status: 'credited' }, select: { usdValue: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    const activatedReferrals = referrals.filter(r => r.activated);
    const totalDepositsFromReferrals = activatedReferrals.reduce((sum, r) => {
      const depositSum = r.referred.deposits.reduce((s, d) => s + (Number(d.usdValue) || 0), 0);
      return sum + depositSum;
    }, 0);
    return {
      referralCode: user.referralCode,
      payoutUnlocked: user.payoutUnlocked,
      totalReferrals: user.totalReferrals,
      activatedCount: activatedReferrals.length,
      pendingCount: referrals.length - activatedReferrals.length,
      totalDepositsFromReferrals,
      referralUrl: `${process.env.FRONTEND_URL}/auth/register?ref=${user.referralCode}`,
      list: referrals.map(r => ({
        id: r.id,
        username: r.referred.username,
        email: r.referred.email,
        joinedAt: r.createdAt,
        activated: r.activated,
        activatedAt: r.activatedAt,
        bonusCoins: r.bonusCoins,
        totalDeposited: r.referred.deposits.reduce((s, d) => s + (Number(d.usdValue) || 0), 0)
      }))
    };
  }

  async activateReferral(referredUserId: string, idempotencyKey: string) {
    const referralEvent = await this.prisma.referralEvent.findUnique({
      where: { referredId: referredUserId },
      include: { referrer: true }
    });
    if (!referralEvent) return null;
    if (referralEvent.activated) return referralEvent;

    const bonusCoins = REFERRAL_BONUS_COINS;
    const updatedEvent = await this.prisma.$transaction(async (tx) => {
      const event = await tx.referralEvent.update({
        where: { id: referralEvent.id },
        data: { activated: true, activatedAt: new Date(), bonusCoins, bonusIssued: true }
      });
      const referrer = await tx.user.findUnique({ where: { id: referralEvent.referrerId }, select: { coinBalance: true } });
      const newBalance = referrer!.coinBalance + bonusCoins;
      await tx.user.update({ where: { id: referralEvent.referrerId }, data: { coinBalance: newBalance } });
      await tx.coinTransaction.create({
        data: {
          userId: referralEvent.referrerId,
          amount: bonusCoins,
          balanceAfter: newBalance,
          type: 'referral_bonus',
          referenceId: referralEvent.id,
          note: `Referral bonus for ${referredUserId}`,
          idempotencyKey
        }
      });
      await tx.user.update({ where: { id: referralEvent.referrerId }, data: { totalReferrals: { increment: 1 } } });
      return event;
    });

    // Send notification and email to referrer
    const referrer = await this.prisma.user.findUnique({ where: { id: referralEvent.referrerId } });
    const referredUser = await this.prisma.user.findUnique({ where: { id: referredUserId } });
    if (referrer && referredUser) {
      const notificationService = new NotificationService(this.prisma);
      await notificationService.notifyReferralActivated(
        referrer.id, referrer.username, referrer.email,
        referredUser.username, bonusCoins
      );
    }

    await this.tierService.checkAndUpgradeTier(referralEvent.referrerId);
    return updatedEvent;
  }

  async claimPayout(userId: string, idempotencyKey: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { payoutUnlocked: true, tier: true, coinBalance: true }
    });
    if (!user) throw ApiError.notFound('User not found');
    if (user.tier?.slug !== 'bronze') throw ApiError.badRequest('Payout only available for Bronze tier users');
    if (!user.payoutUnlocked) throw ApiError.badRequest('You need 7 activated referrals to unlock payout');
    const payoutCoins = 500;
    const result = await this.coinService.grantCoins(userId, payoutCoins, 'referral_payout', null, 'Referral payout (7 referrals)', idempotencyKey);
    return { success: true, coinsGranted: payoutCoins, newBalance: result.newBalance };
  }

  async getPendingPayouts() {
    const users = await this.prisma.user.findMany({
      where: { tier: { slug: 'bronze' }, payoutUnlocked: true },
      include: { referralEventsAsReferrer: { where: { activated: true } } }
    });
    return users.map(u => ({
      userId: u.id,
      username: u.username,
      email: u.email,
      activatedReferrals: u.referralEventsAsReferrer.length,
      coinBalance: u.coinBalance
    }));
  }

  async processPayout(userId: string, adminId: string, idempotencyKey: string) {
    return { success: true };
  }
}