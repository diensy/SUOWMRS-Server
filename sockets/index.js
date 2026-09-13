export const setupSockets = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Welcome heartbeat
    socket.emit('system:status', {
      connected: true,
      timestamp: new Date().toISOString(),
      message: 'SUOWMRS Telemetry Stream Connected (Phase 0 Scaffold)',
    });

    // Handle client ping
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });
};
