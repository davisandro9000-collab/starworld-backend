// src/socket/admin.namespace.ts
import { Server, Namespace } from 'socket.io';
import { AuthSocket, adminSocketAuth } from './socketAuth.js';

export function setupAdminNamespace(io: Server) {
  const adminNamespace: Namespace = io.of('/admin');
  adminNamespace.use(adminSocketAuth);

  adminNamespace.on('connection', (socket: AuthSocket) => {
    const adminId = socket.admin!.id;
    console.log(`🔌 Admin ${adminId} connected to /admin namespace`);

    // Admin can listen to 'new_deposit' events (broadcasted from server)
    // They also receive 'user_banned' etc.

    socket.on('disconnect', () => {
      console.log(`🔌 Admin ${adminId} disconnected from /admin namespace`);
    });
  });

  return adminNamespace;
}