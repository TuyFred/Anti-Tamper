import { Server } from 'socket.io';
import { supabase } from '../config/supabase.js';
import { getUserProfile } from '../middleware/permissions.js';
import { isAllowedClientOrigin } from '../config/cors.js';

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

    if (socket.profile.is_approved) {
      socket.join('approved');
      if (socket.profile.role?.name === 'admin') {
        socket.join('admin');
      }
    }

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.profile.email}`);
    });
  });

  return io;
}
