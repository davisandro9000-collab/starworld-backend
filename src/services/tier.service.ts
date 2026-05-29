import { PrismaClient } from '@prisma/client';
import { ApiError } from '../lib/apiError.js';
import { NotificationService } from './notification.service.js';

export class TierService {
  constructor(private prisma: PrismaClient) {}

  async checkAndUpgradeTier(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tier: true,
        deposits: { where: { status: 'credited' } },
        referralEventsAsReferrer: { where: { activated: true } }
      }
    });
    if (!user) throw ApiError.notFound('User not found');

    const totalDeposits = user.deposits.reduce((sum, d) => sum + (d.usdValue ? Number(d.usdValue) : 0), 0);
    const activatedReferrals = user.referralEventsAsReferrer.length;

    const platinumTier = await this.prisma.tier.findUnique({ where: { slug: 'platinum' } });
    if (platinumTier && totalDeposits >= Number(platinumTier.minDepositUsd)) {
      if (user.tier.slug !== 'platinum') {
        await this.upgradeUser(user.id, platinumTier.id, 'platinum');
      }
      return;
    }

    const silverTier = await this.prisma.tier.findUnique({ where: { slug: 'silver' } });
    if (silverTier && totalDeposits >= Number(silverTier.minDepositUsd) && activatedReferrals >= silverTier.requiredReferrals) {
      if (user.tier.slug !== 'silver') {
        await this.upgradeUser(user.id, silverTier.id, 'silver');
      }
      return;
    }

    if (user.tier.slug === 'bronze' && !user.payoutUnlocked && activatedReferrals >= 7) {
      await this.prisma.user.update({ where: { id: user.id }, data: { payoutUnlocked: true } });
      console.log(`✅ Bronze payout unlocked for user ${user.id}`);
    }
  }

  private async upgradeUser(userId: string, newTierId: string, tierSlug: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tierId: newTierId, payoutUnlocked: true }
    });
    console.log(`✅ User ${userId} upgraded to ${tierSlug} tier`);

    // Send notification and email about tier upgrade
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const notificationService = new NotificationService(this.prisma);
      await notificationService.notifyTierUpgrade(userId, user.username, user.email, tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1));
    }
  }

  async getUserTierInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tier: true,
        deposits: { where: { status: 'credited' } }
      }
    });
    if (!user) throw ApiError.notFound('User not found');

    const totalDeposited = user.deposits.reduce((sum, d) => sum + (d.usdValue ? Number(d.usdValue) : 0), 0);
    const activatedReferrals = await this.prisma.referralEvent.count({
      where: { referrerId: userId, activated: true }
    });
    const silverTier = await this.prisma.tier.findUnique({ where: { slug: 'silver' } });
    const platinumTier = await this.prisma.tier.findUnique({ where: { slug: 'platinum' } });

    return {
      currentTier: user.tier,
      totalDepositedUsd: totalDeposited,
      activatedReferrals,
      nextTier: totalDeposited >= 10 ? null : {
        tier: 'silver',
        requiredDeposit: 5,
        requiredReferrals: 3,
        progress: {
          deposit: Math.min(100, (totalDeposited / 5) * 100),
          referrals: Math.min(100, (activatedReferrals / 3) * 100)
        }
      },
      payoutUnlocked: user.payoutUnlocked
    };
  }
}