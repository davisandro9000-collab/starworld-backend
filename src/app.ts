import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import adminAuthRoutes from './routes/adminAuth.routes.js';
import depositRoutes from './routes/deposit.routes.js';
import adminDepositRoutes from './routes/adminDeposit.routes.js';
import userRoutes from './routes/user.routes.js';
import gameRoutes from './routes/game.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import adminTicketRoutes from './routes/adminTicket.routes.js';
import referralRoutes from './routes/referral.routes.js';
import ticketGameRoutes from './routes/ticketGame.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import debugRoutes from './routes/debug.routes.js';
import celebrityRoutes from './routes/celebrity.routes.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:4000'],
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan('dev'));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/admin/v1/auth', adminAuthRoutes);
  app.use('/api/v1/deposits', depositRoutes);
  app.use('/api/v1/admin/deposits', adminDepositRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/games', gameRoutes);
  app.use('/api/v1/tickets', ticketRoutes);
  app.use('/api/v1/admin/tickets', adminTicketRoutes);
  app.use('/api/v1/referrals', referralRoutes);
  app.use('/api/v1/tickets/game', ticketGameRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/debug', debugRoutes);
  app.use('/api/v1/celebrities', celebrityRoutes);

  app.get('/api/v1/test', (req, res) => {
    res.json({ message: 'StarWorld API is running!' });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

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