import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/prisma.js';
import authRoutes from './routes/auth.routes.js';
import adminAuthRoutes from './routes/adminAuth.routes.js';
import depositRoutes from './routes/deposit.routes.js';
import adminDepositRoutes from './routes/adminDeposit.routes.js';
import userRoutes from './routes/user.routes.js';
import adminUserRoutes from './routes/adminUser.routes.js';
import gameRoutes from './routes/game.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import adminTicketRoutes from './routes/adminTicket.routes.js';
import referralRoutes from './routes/referral.routes.js';
import ticketGameRoutes from './routes/ticketGame.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import debugRoutes from './routes/debug.routes.js';
import celebrityRoutes from './routes/celebrity.routes.js';
import adminAnalyticsRoutes from './routes/adminAnalytics.routes.js';
import adminCelebrityRoutes from './routes/adminCelebrity.routes.js';
import adminPrizeRoutes from './routes/adminPrize.routes.js';
import adminAuditRoutes from './routes/adminAudit.routes.js';
import footballRoutes from './routes/football.routes.js';
import adminFootballRoutes from './routes/adminFootball.routes.js';
import footballPredictionRoutes from './routes/footballPrediction.routes.js';
import adminFootballPredictionRoutes from './routes/adminFootballPrediction.routes.js';
import footballTicketResaleRoutes from './routes/footballTicketResale.routes.js';
import adminFootballTicketRoutes from './routes/adminFootballTicket.routes.js';

const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:4000'],
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan('dev'));

  // Health checks
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

  // API routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/admin/v1/auth', adminAuthRoutes);
  app.use('/api/v1/deposits', depositRoutes);
  // CRITICAL FIX: must be /api/admin/v1/deposits to match frontend
  app.use('/api/admin/v1/deposits', adminDepositRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/admin/v1/users', adminUserRoutes);
  app.use('/api/v1/games', gameRoutes);
  app.use('/api/v1/tickets', ticketRoutes);
  app.use('/api/admin/v1/tickets', adminTicketRoutes);
  app.use('/api/v1/referrals', referralRoutes);
  app.use('/api/v1/tickets/game', ticketGameRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/debug', debugRoutes);
  app.use('/api/v1/celebrities', celebrityRoutes);
  app.use('/api/admin/v1/analytics', adminAnalyticsRoutes);
  app.use('/api/admin/v1/celebrities', adminCelebrityRoutes);
  app.use('/api/admin/v1/prizes', adminPrizeRoutes);
  app.use('/api/admin/v1/audit', adminAuditRoutes);
  app.use('/api/v1/football', footballRoutes);
  app.use('/api/admin/v1/football', adminFootballRoutes);
  app.use('/api/v1/football/predictions', footballPredictionRoutes);
  app.use('/api/admin/v1/football/predictions', adminFootballPredictionRoutes);
  app.use('/api/v1/football/tickets', footballTicketResaleRoutes);
  app.use('/api/admin/v1/football/tickets', adminFootballTicketRoutes);

  // Test endpoint
  app.get('/api/v1/test', (req, res) => {
    res.json({ message: 'StarWorld API is running!' });
  });

  // 404 handler – must be last
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  return app;
};

export { createApp };