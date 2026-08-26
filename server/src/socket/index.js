import { Server } from 'socket.io';
import { supabase } from '../config/supabase.js';
import { getUserProfile } from '../middleware/permissions.js';
import { isAllowedClientOrigin } from '../config/cors.js';
import { registerUserLocationHandlers } from './userLocation.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedClientOrigin(origin)) callback(null, true);
        else callback(new Error(`Socket CORS blocked: ${origin}`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return next(new Error('Invalid token'));

    const profile = await getUserProfile(user.id);
    if (!profile) return next(new Error('Profile not found'));

    socket.userId = user.id;
    socket.profile = profile;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.profile.email}`);

    socket.join('approved');
    socket.join(`user:${socket.userId}`);
    if (socket.profile.role?.name === 'admin') {
      socket.join('admin');
    }
    if (['admin', 'manager'].includes(socket.profile.role?.name)) {
      socket.join('managers');
    }

    registerUserLocationHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.profile.email}`);
    });
  });

  return io;
}
