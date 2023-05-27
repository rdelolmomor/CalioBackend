const { getInSocketRooms, getConnectionSocketRooms } = require('./socket.rooms');
const {
  onMessageAnswer,
  onMessageMention,
  onNormalMessage,
  onUpdateMessageState,
  onProcessPrivateRoom,
  checkMessageError,
} = require('./socket.utils');
const {
  changePrivateRoomStatus,
  createUserRole,
  getRoomById,
} = require('../db/rooms');
const { changeRole, getRoleByUserAndRoom } = require('../db/users');
const { getOtherLoginFromPrivateRoomName } = require('../lib/helper');
const { ROLES, getRoleByText } = require('../lib/Role');
const { SOCKET_ROOMS } = require('../sockets/socket.rooms');

/**
 * Función que se llama para hacer una comprobación de la sesión y del rol de la sala que se especifica
 * @param {*} sessionManager
 * @param {string} login
 * @param {string} token
 * @param {number} roomId
 * @returns {Promise<{ seesion? , actualRoom? , error?  }>}
 */
async function checkSessionAndRole(sessionManager, login, token, roomId) {
  try {
    const session = await sessionManager.getSession(login, token);
    if (!session) return { error: 'Sesión inválida' };
    //console.log('login de sesión', session.rooms);
    const actualRoom = session.rooms.filter(room => room.roomId === roomId)[0];
    if (!actualRoom) return { error: 'No tienes acceso a la sala' };
    //console.log('checkSessionAndRole ', actualRoom);
    return { session, actualRoom };
  } catch (err) {
    throw err;
  }
}

const TAG = '[SOCKET.LISTENERS]';

function onConnection(socket) {
  console.time('(%) onConnection');
  const { login, name, rooms, platformId } = socket.session;
  const connectionNotification = {
    login,
    name: name.toLowerCase(),
    status: 'online',
  };
  rooms.forEach(({ roomId, role, private }) => {
    const joiningSocketRooms = getInSocketRooms(role.role, roomId, platformId, private);
    socket.join(joiningSocketRooms);
    const { in: roomsIn, out: roomsOut } = getConnectionSocketRooms(role.role, roomId, platformId);
    const data = { ...connectionNotification, roomId, role: role.role };
    socket.to(roomsIn).except(roomsOut).emit('online', data);
  });
  socket.join(socket.handshake.auth.login);
  console.timeEnd('(%) onConnection');
}

module.exports.onConnection = onConnection;

async function onDisconnect(socket, reason, sessionManager) {
  console.time('(%) onDisconnect');
  try {
    // TODO: Hacer algo con el motivo de desconexión.
    const { login, token } = socket.handshake.auth;
    await sessionManager.unlinkSocket(login, token);
    const { rooms, platformId, name } = socket.session;
    const connectionNotification = {
      login: login,
      name: name.toLowerCase(),
      status: 'offline',
    };
    rooms.forEach(({ roomId, role }) => {
      const connectionSocketRooms = getConnectionSocketRooms(role.role, roomId, platformId);
      const { in: roomsIn, out: roomsOut } = connectionSocketRooms;
      socket.to(roomsIn).except(roomsOut).emit('online', connectionNotification);
    });
    console.timeEnd('(%) onDisconnect');
  } catch (err) {
    console.timeEnd('(%) onDisconnect');
    console.error(`${TAG} Error en "disconnect" para ${socket.id}: ${err.toString()}`);
  }
}

module.exports.onDisconnect = onDisconnect;

async function onMessageUpdate(socket, change, clientCallback, sessionManager) {
  console.time('(%) onMessageUpdate');
  try {
    const { login, token } = socket.handshake.auth;
    const check = await checkSessionAndRole(sessionManager, login, token, change.roomId);
    if (check.error) {
      return clientCallback(check);
    }
    const { session, actualRoom } = check;
    if (change.stateId > 5 || change.stateId < 0) {
      console.timeEnd('(%) onMessageUpdate');
      return clientCallback({ error: 'Modificación de estado no permitida' });
    }
    if (actualRoom.role.role !== 'C1') {
      console.timeEnd('(%) onMessageUpdate');
      return clientCallback({ error: 'El usuario no tiene permisos para asignarse mensajes.' });
    }
    const response = await onUpdateMessageState(
      socket,
      actualRoom.role.role,
      session.platformId,
      change
    );
    console.timeEnd('(%) onMessageUpdate');
    clientCallback(response);
  } catch (err) {
    console.log('Error en onMessageUpdate', err);
    console.timeEnd('(%) onMessageUpdate');
    clientCallback({ error: err.toString() });
  }
}

module.exports.onMessageUpdate = onMessageUpdate;



async function onMessage(socket, message, clientCallback, sessionManager) {
  console.time('(%) onMessage');
  try {
    const { login, token } = socket.handshake.auth;
    const check = await checkSessionAndRole(sessionManager, login, token, message.roomId);
    if (check.error) return clientCallback(check);
    const { actualRoom, session } = check;
    const error = checkMessageError(actualRoom, message.message);
    if (error) return clientCallback(error);
    message.emitter = login;
    message.name = session.name.toLowerCase();
    message.avatar = session.avatar;
    message.platformId = session.platformId;
    let response;
    if (typeof message.previousId === 'number') {//Si es respuesta
      response = await onMessageAnswer(message, actualRoom, socket);
    } else if (typeof message.receiver === 'string') {//Si es mención
      response = await onMessageMention(message, actualRoom, socket);
    } else {//Si es mensaje normal
      response = await onNormalMessage(message, actualRoom, socket);
    }
    console.timeEnd('(%) onMessage');
    clientCallback(response);
  } catch (err) {
    console.timeEnd('(%) onMessage');
    console.error(`${TAG} (onMessage) Error: ${err.toString()}`, err);
    clientCallback({ error: err.toString() });
  }
}

module.exports.onMessage = onMessage;


async function onRooms(socket, clientCallback) {
  const rooms = socket.rooms;
  console.log(`${TAG} onRooms:`, rooms);
  clientCallback(Array.from(rooms));
}

module.exports.onRooms = onRooms;

async function onPrivateRoom(io, socket, privateRoomData, clientCallback, sessionManager) {
  console.time('(%) onPrivateRoom');
  try {
    const { login, token } = socket.handshake.auth;
    const { roomId } = privateRoomData;
    const check = await checkSessionAndRole(sessionManager, login, token, roomId);
    if (check.error) return clientCallback(check);
    const { actualRoom: actualRoomFromCreator, session } = check;
    console.log(`${TAG} (onPrivateRoom) Pasamos el primer filtro de comprobaciones`);
    const response = await onProcessPrivateRoom(
      io,
      socket,
      privateRoomData,
      login,
      actualRoomFromCreator.role,
      session.name
    );
    if (!response.error) {
      console.log(`${TAG} (onPrivateRoom) Añadiendo sala a SessionManager`);
      sessionManager.joinUsersPrivateRoom([login, privateRoomData.guestLogin], response);
    }
    console.timeEnd('(%) onPrivateRoom');
    clientCallback(response);
  } catch (err) {
    console.timeEnd('(%) onPrivateRoom');
    console.error(`${TAG} (onPrivateRoom) Error: ${err.toString()}`, err);
    clientCallback({ error: err.toString() });
  }
}

module.exports.onPrivateRoom = onPrivateRoom;

/**
 * Recibe la solicitud de salida de una sala privada y establece dicha
 * sala a ACTIVA = NO
 * @param {*} socket
 * @param {*} privateRoomData
 * @param {*} clientCallback
 * @param {*} sessionManager
 */
async function onExitPrivateRoom(socket, privateRoomData, clientCallback, sessionManager) {
  console.time('(%) onExitPrivateRoom');
  try {
    const { login, token } = socket.handshake.auth;
    const { roomId } = privateRoomData;
    console.log(`${TAG} Recibido evento 'exitPrivateRoom' de ${login}:`, privateRoomData);
    const check = await checkSessionAndRole(sessionManager, login, token, roomId);
    if (check.error) return clientCallback(check);
    const { actualRoom } = check;
    const isRoomClosed = await changePrivateRoomStatus(false, roomId);
    if (!isRoomClosed) {
      // console.log(`${TAG} No se ha modificado el estado de la sala ${roomId}`);
      return clientCallback({ error: `No se ha modificado el estado de la sala ${roomId}` });
    }
    console.log(`${TAG} Se ha desactivado correctamente la sala`, actualRoom.roomName);
    const otherLogin =
      actualRoom.userLogind || getOtherLoginFromPrivateRoomName(actualRoom.roomName.toUpperCase(), login);
    // console.log('Identificado el otro usuario en la sala privada:', otherLogin);
    socket.to(otherLogin).emit('exitPrivate', privateRoomData);
    console.timeEnd('(%) onExitPrivateRoom');
    clientCallback(privateRoomData);
  } catch (err) {
    console.timeEnd('(%) onExitPrivateRoom');
    console.lerror(`${TAG} (onExitPrivateRoom) Error: ${err.toString()}`, err);
    clientCallback({ error: err.toString() });
  }
}

module.exports.onExitPrivateRoom = onExitPrivateRoom;

const ADMIN_TYPES = ['POPUP', 'DISCONNECT', 'UPDATE_ROOM'];
const ADMIN_CHANNELS = {
  POPUP: 'adminPopup',
  DISCONNECT: 'forceDisconnect',
  UPDATE_ROOM: 'updateRoom',
};

/**
 * Recibe la acción del panel de administración
 *
 * @param {*} socket Parametros del socket recibido
 * @param {*} action Parametros de la acción a realizar
 * @param {*} callback
 * @param {*} sessionManager Parametros de la sesión
 */
async function onAdminAction(socket, action, callback, sessionManager) {
  try {
    const { login, token } = socket.handshake.auth;
    const check = await checkSessionAndRole(sessionManager, login, token, action.roomId);
    if (check.error) throw new Error(check.error);
    const { actualRoom } = check;
    if (!ADMIN_TYPES.includes(action.type)) return callback({ error: 'Acción no definida' });
    if (actualRoom.role.role !== 'Z2') return callback({ error: 'No tienes permisos' });
    const { receiver, payload, type } = action;
    const payloadRole = getRoleByText(payload.role);
    const channel = ADMIN_CHANNELS[type];
    if (!channel) return callback({ error: 'Acción no definida' });
    //*ACTUALIZAR UN ROL EN UNA SALA
    if (type === 'UPDATE_ROOM') {
      const userRole = await getRoleByUserAndRoom(receiver, payload.roomId);
      if (
        userRole.error &&
        userRole.error === 'El usuario no tiene acceso a la sala especificada.'
      ) {
        const role = await createUserRole(receiver, payload.roomId, payloadRole);
        if (!role) return callback({ error: 'No se pudo crear el rol' });
        const room = await getRoomById(payload.roomId);
        const isSessionUpdated = sessionManager.updateUserRole(
          receiver,
          payload.roomId,
          payloadRole,
          room
        );
        if (!isSessionUpdated) return callback({ error: 'El usuario debe estar conectado' });
        socket.to(receiver).emit(channel, { ...room, role, roomId: payload.roomId });
        return callback(true);
      } else if (userRole.error) return callback(userRole);
      //Se actualiza la sesión de receptor en roomId y rol
      const isSessionUpdated = sessionManager.updateUserRole(receiver, payload.roomId, payloadRole);
      if (!isSessionUpdated) return callback({ error: 'El usuario debe estar conectado' });
      //Se cambia el rol en BD
      const isRoleUpdated = await changeRole(receiver, payloadRole, payload.roomId);
      if (!isRoleUpdated) return callback({ error: 'No se pudo actualizar el rol' });
      //Se obtienen los datos de la sala
      const room = await getRoomById(payload.roomId);
      //Se envia notificación al socket del receptor modificado
      socket
        .to(receiver)
        .emit(channel, { ...room, roomId: payload.roomId, role: ROLES[payloadRole] });
      return callback(true);
    }
    console.log(`AdminAction Acción devuelta al Front: ${JSON.stringify(payload)}`);
    //* POPUP O DISCONECT. Se reenvia el evento al usuario (mensaje o desconexion) o a todos si se ha escrito asterisco (*)
    if (receiver === '*') socket.broadcast.emit(channel, payload || {});
    else socket.to(receiver).emit(channel, payload || {});
    callback(true);
  } catch (err) {
    callback({ error: err.toString() });
  }
}

module.exports.onAdminAction = onAdminAction;

async function onNotifyAction(socket, action, callback, sessionManager) {
  try {
    const { login, token } = socket.handshake.auth;
    const { receiver, payload } = action;
    const check = await checkSessionAndRole(sessionManager, login, token, action.roomId);
    if (check.error) throw new Error(check.error);
    const { actualRoom } = check;
    if (actualRoom.role.role === 'A1' || actualRoom.role.role === 'A2')
      return callback({ error: 'No tienes permisos' });
    //console.log(`AdminAction Acción devuelta al Front: ${JSON.stringify(payload)}`);
    if (receiver === '/todos')
      socket
        .to(SOCKET_ROOMS.TP(payload.roomId, check.session.platformId))
        .emit('notifyPopup', payload || {});
    else socket.to(receiver).emit('notifyPopup', payload || {});
    callback(true);
  } catch (err) {
    callback({ error: err.toString() });
  }
}

module.exports.onNotifyAction = onNotifyAction;
