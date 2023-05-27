const socketServer = require('socket.io');
const listeners = require('./socket.listeners');
const authMiddleware = require('./authMiddleware');

const cors = {
  origin: '*',
  methods: ['GET', 'POST'],
};

function socketInit(httpServer, sessionManager) {
  const io = socketServer(httpServer, { cors });
  io.use(authMiddleware(sessionManager));
  return {
    io,
    init: () => {
      io.on('connection', socket => {
        listeners.onConnection(socket);
        socket.on('disconnecting', reason =>
          listeners.onDisconnect(socket, reason, sessionManager)
        );
        socket.on('message', (message, callback) =>
          listeners.onMessage(socket, message, callback, sessionManager)
        );
        socket.on('messageState', (change, callback) =>
          listeners.onMessageUpdate(socket, change, callback, sessionManager)
        );
        socket.on('rooms', (_, callback) => listeners.onRooms(socket, callback));

        socket.on('privateRoom', (privateRoomData, callback) =>
          listeners.onPrivateRoom(io, socket, privateRoomData, callback, sessionManager)
        );
        socket.on('exitPrivate', (privateRoomData, callback) => {
          listeners.onExitPrivateRoom(socket, privateRoomData, callback, sessionManager);
        });
        socket.on('adminAction', (action, callback) => {
          listeners.onAdminAction(socket, action, callback, sessionManager);
        });
        socket.on('notifyAction', (action, callback) => {
          listeners.onNotifyAction(socket, action, callback, sessionManager);
        });
      });
    },
  };
}

module.exports = socketInit;
