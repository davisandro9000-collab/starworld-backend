// src/socket/user.namespace.ts
import { Server, Namespace } from 'socket.io';
import { AuthSocket, userSocketAuth } from './socketAuth.js';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';

export function setupUserNamespace(io: Server) {
  const userNamespace: Namespace = io.of('/user');
  userNamespace.use(userSocketAuth);

  userNamespace.on('connection', (socket: AuthSocket) => {
    const userId = socket.user!.id;
    console.log(`🔌 User ${userId} connected to /user namespace`);

    // Join user's private room
    socket.join(`user:${userId}`);

    // Join auction rooms for real‑time bid updates
    socket.on('join_auction', (auctionId: string) => {
      socket.join(`auction:${auctionId}`);
      console.log(`User ${userId} joined auction room ${auctionId}`);
    });

    socket.on('leave_auction', (auctionId: string) => {
      socket.leave(`auction:${auctionId}`);
    });

    // Optionally, send live feed (broadcasted from server)
    // The client will listen to 'live_feed' event

    socket.on('disconnect', () => {
      console.log(`🔌 User ${userId} disconnected from /user namespace`);
    });
  });

  return userNamespace;
}