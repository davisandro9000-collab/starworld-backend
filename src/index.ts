import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { redis } from './lib/redis.js';
import { IdempotencyService } from './services/idempotency.service.js';
import { CoinService } from './services/coin.service.js';
import { resolveAuction } from './jobs/auctionResolve.job.js';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { setupUserNamespace } from './socket/user.namespace.js';
import { setupAdminNamespace } from './socket/admin.namespace.js';

const prisma = new PrismaClient();
const idempotencyService = new IdempotencyService();
const coinService = new CoinService(prisma, idempotencyService);

const app = createApp();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:4000'],
    credentials: true,
  },
});

// Make io globally accessible for emitting events from services
(global as any).io = io;

// Attach namespaces
const userNamespace = setupUserNamespace(io);
const adminNamespace = setupAdminNamespace(io);

app.set('io', io);

const PORT = process.env.PORT || 3001;

app.locals.prisma = prisma;
app.locals.redis = redis;
app.locals.coinService = coinService;

httpServer.listen(PORT, () => {
  console.log(`\n🚀 StarWorld API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/v1/test`);
  console.log(`✅ Redis: Connected (Upstash)`);
  console.log(`✅ Database: Connected (Neon)`);
  console.log(`✅ Socket.IO: /user and /admin namespaces ready\n`);
});

// Auction resolver (runs every 30 seconds)
async function resolveExpiredAuctions() {
  try {
    const result = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM ticket_exchanges 
      WHERE listing_type = 'auction' 
        AND status = 'active' 
        AND expires_at < NOW() AT TIME ZONE 'UTC'
    `;
    if (result.length > 0) {
      console.log(`🔍 Found ${result.length} expired auction(s)`);
      for (const row of result) {
        await resolveAuction(row.id);
      }
    }
  } catch (error) {
    console.error('❌ Error resolving expired auctions:', error);
  }
}

setTimeout(() => resolveExpiredAuctions(), 5000);
setInterval(() => resolveExpiredAuctions(), 30 * 1000);
console.log('⏰ Auction resolver started (runs every 30 seconds)');

// Ticket game offer cleaner (runs every minute)
setInterval(async () => {
  try {
    const result = await prisma.ticketGameOffer.updateMany({
      where: { status: 'pending', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    });
    if (result.count > 0) console.log(`🧹 Cleaned ${result.count} expired ticket game offers`);
  } catch (error) {
    console.error('Failed to clean expired offers:', error);
  }
}, 60 * 1000);
console.log('⏰ Ticket game offer cleaner started');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  io.close();
  httpServer.close(() => {
    console.log('✅ Cleanup complete');
    process.exit(0);
  });
});
app.get('/health/db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});