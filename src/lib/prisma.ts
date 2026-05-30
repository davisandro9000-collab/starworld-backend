import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 10000,  // wait up to 10 seconds for a transaction
    timeout: 15000,  // transaction timeout 15 seconds
  },
});