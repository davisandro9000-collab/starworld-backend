import { PrismaClient } from '@prisma/client';
import { IdempotencyService } from './idempotency.service.js';

export class CoinService {
  constructor(
    private prisma: PrismaClient,
    private idempotency: IdempotencyService
  ) {}

  async grantCoins(
    userId: string,
    amount: number,
    type: string,
    referenceId: string | null,
    note: string,
    idempotencyKey: string
  ): Promise<{ success: boolean; newBalance: number; executed: boolean; transactionId?: string }> {
    const result = await this.idempotency.process(
      idempotencyKey,
      86400,
      async () => {
        return await this.prisma.$transaction(async (tx: any) => {
          // Get current balance
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { coinBalance: true }
          });
          
          if (!user) {
            throw new Error('User not found');
          }
          
          const currentBalance = user.coinBalance;
          const newBalance = currentBalance + amount;
          
          if (newBalance < 0) {
            throw new Error(`Insufficient balance. Current: ${currentBalance}, Requested debit: ${Math.abs(amount)}`);
          }

          // Update user balance
          const updatedUser = await tx.user.update({
            where: { id: userId },
            data: { coinBalance: newBalance }
          });

          // Create transaction record
          const transaction = await tx.coinTransaction.create({
            data: {
              userId,
              amount,
              balanceAfter: newBalance,
              type,
              referenceId,
              note,
              idempotencyKey
            }
          });

          return { 
            success: true, 
            newBalance: updatedUser.coinBalance,
            transactionId: transaction.id,
            executed: true 
          };
        });
      }
    );

    return result.result;
  }

  async deductCoins(
    userId: string,
    amount: number,
    type: string,
    referenceId: string | null,
    note: string,
    idempotencyKey: string
  ): Promise<{ success: boolean; newBalance: number; executed: boolean; transactionId?: string }> {
    return this.grantCoins(userId, -Math.abs(amount), type, referenceId, note, idempotencyKey);
  }

  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coinBalance: true }
    });
    return user?.coinBalance ?? 0;
  }
}