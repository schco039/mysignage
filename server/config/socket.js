const { Server } = require('socket.io');
const { setupPlayerHandlers } = require('../socket/playerHandlers');

const SOCKET_OPTIONS = {
  pingInterval: 45000,
  pingTimeout: 45000,
  maxHttpBufferSize: 10e7,
  cors: { origin: '*' },
};

function setupSocket(httpServer) {
  // Three Socket.IO instances for different piSignage player generations
  const ioDefault = new Server(httpServer, SOCKET_OPTIONS);
  const ioNew = new Server(httpServer, { ...SOCKET_OPTIONS, path: '/newsocket.io' });
  const ioWs = new Server(httpServer, {
    ...SOCKET_OPTIONS,
    path: '/wssocket.io',
    transports: ['websocket'],
  });

  // Register identical handlers on all three
  setupPlayerHandlers(ioDefault, 'legacy');
  setupPlayerHandlers(ioNew, 'new');
  setupPlayerHandlers(ioWs, 'websocket');

  // Return the "new" instance as primary for emitting from controllers
  return { ioDefault, ioNew, ioWs, io: ioNew };
}

module.exports = { setupSocket };
