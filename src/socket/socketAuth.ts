import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';

export interface AuthSocket extends Socket {
  user?: { id: string; email: string };
  admin?: { id: string; email: string; role: string };
}

export const userSocketAuth = (socket: AuthSocket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string };
    socket.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
};

export const adminSocketAuth = (socket: AuthSocket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Admin token required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as { adminId: string; email: string; role: string };
    socket.admin = { id: decoded.adminId, email: decoded.email, role: decoded.role };
    next();
  } catch (err) {
    next(new Error('Invalid admin token'));
  }
};