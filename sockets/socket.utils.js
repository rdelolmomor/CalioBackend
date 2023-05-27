const { createMessage, createMessageState, getAnswerByMessageId } = require('../db/messages');
const { getUserDataByRoom } = require('../db/users');
const {
  getPrivateRoomByName,
  createPrivateRoom,
  createPrivateRoomRoles,
  changePrivateRoomStatus,
} = require('../db/rooms');
const { getMessageSocketRooms, getMentionSocketRooms } = require('./socket.rooms');
const { getTodayDate } = require('../lib/helper');
const { ROLES } = require('../lib/Role');

function updateMessage(message, messageId, previousData = false) {
  const now = getTodayDate();
  message.messageId = messageId;
  message.date = now;
  message.stateDate = now;
  message.stateLOGIN = message.emitter;
  message.lastState = 1;
  if (previousData) {
    message.previousUserName = previousData.name;
    message.previousMessage = previousData.message;
    message.previousLOGIN = previousData.emitter;
    message.previousRole = previousData.role;
  }
  return message;
}


async function onMessageAnswer(message, userRoom, socket) {
  try {
    if (!userRoom.role.canAnswerMention) {
      return { error: 'No tienes permisos para responder.' };
    }
    const messageId = await createMessage(message);
    if (!messageId) {
      return { error: 'No se pudo registrar el mensaje en base de datos' };
    }
    //Obtencion de todos los campos
    const previousMessageData = await getAnswerByMessageId(message.previousId);
    updateMessage(message, messageId, previousMessageData);
    const { emitter, previousId, roomId, platformId } = message;
    const isPreviousMessageUpdated = await createMessageState(emitter, previousId, 4);
    if (isPreviousMessageUpdated) {
      const { in: roomsIn, out: roomsOut } = getMessageSocketRooms(
        userRoom.role.role,
        roomId,
        platformId,
        false,
        message.previousRole,
        message.previousLOGIN
      );
      message.role = userRoom.role.role;
      socket.to(roomsIn).except(roomsOut).emit('message', message);
    }
    return message;
  } catch (err) {
    throw err;
  }
}
module.exports.onMessageAnswer = onMessageAnswer;


async function onMessageMention(message, userRoom, socket) {
  try {
    if (!userRoom.role.canAnswerMention) {
      return { error: 'No tienes permisos para mencionar.' };
    }
    const messageId = await createMessage(message);
    if (!messageId) {
      return { error: 'No se pudo registrar el mensaje en base de datos' };
    }
    updateMessage(message, messageId);
    const { roomId, platformId, receiver } = message;
    const { in: roomsIn, out: roomsOut } = getMentionSocketRooms(roomId, platformId, receiver);
    // console.log('(onMessageMention) Enviando mensajes a las salas:', roomsIn);
    console.log(userRoom.role.role);
    message.role = userRoom.role.role;
    socket.to(roomsIn).except(roomsOut).emit('message', message);
    return message;
  } catch (err) {
    throw err;
  }
}
module.exports.onMessageMention = onMessageMention;


async function onNormalMessage(message, userRoom, socket) {
  try {
    const messageId = await createMessage(message);
    if (!messageId) {
      return { error: 'No se pudo registrar el mensaje en base de datos' };
    }
    updateMessage(message, messageId);
    const { roomId, platformId } = message;
    const { in: roomsIn, out: roomsOut } = getMessageSocketRooms(
      userRoom.role.role,
      roomId,
      platformId,
      message.private
    );
    console.log(userRoom.role.role);
    message.role = userRoom.role.role;
    socket.to(roomsIn).except(roomsOut).emit('message', message);
    return message;
  } catch (err) {
    throw err;
  }
}
module.exports.onNormalMessage = onNormalMessage;


async function onUpdateMessageState(socket, role, platformId, change) {
  try {
    const { login } = socket.handshake.auth;
    const { roomId, messageId, stateId } = change;
    const isMessageUpdated = await createMessageState(login, messageId, stateId);
    if (isMessageUpdated) {
      const { in: roomsIn, out: roomsOut } = getMessageSocketRooms(role, roomId, platformId);
      const state = {
        messageId,
        stateDate: getTodayDate(),
        lastState: stateId,
        stateLOGIN: login,
      };
      socket.to(roomsIn).except(roomsOut).emit('messageState', state);
      return state;
    }
    return { error: 'No se pudo actualizar el estado en base de datos.' };
  } catch (err) {
    throw err;
  }
}
module.exports.onUpdateMessageState = onUpdateMessageState;


async function onProcessPrivateRoom(io, socket, request, creatorLogin, creatorRole, creatorName) {
  try {
    const { guestLogin, roomId } = request;
    const guestData = await getUserDataByRoom(guestLogin, roomId);
    if (!guestData) {
      return { error: 'El usuario invitado no se encuentra conectado' };
    }
    if (
      Array.isArray(creatorRole.canSeeOnline) &&
      !creatorRole.canSeeOnline.includes(guestData.role)
    ) {
      return { error: 'No tienes permiso para abrir una sala privada a este usuario' };
    }
    const privateRoomData = await getPrivateRoomByName(creatorLogin, guestLogin);
    console.log('Private Room Data: ', privateRoomData);
    if (!privateRoomData) {
      const roomName = [creatorLogin, guestLogin].sort().join(':');
      const roomId = await createPrivateRoom(creatorLogin, roomName);
      const privateRoom = {
        roomId,
        roomName,
        creatorName,
        creatorLogin,
        guestLogin: creatorLogin,
        guestName: guestData.name,
        private: true,
        type: 'PRIVADA',
        role: ROLES.A2,
      };
      // * Añadir permisos de los dos usuarios
      const areRolesCreated = await createPrivateRoomRoles([creatorLogin, guestLogin], roomId);
      if (!areRolesCreated) {
        return { error: 'Error al establecer roles para la sala' };
      }
      socket.to(guestLogin).emit('privateRoom', { ...privateRoom });
      socket.join(`a2:${privateRoom.roomId}`);
      io.in(guestLogin).socketsJoin(`a2:${privateRoom.roomId}`);
      return { ...privateRoom, guestLogin };
    }
    const { roomId: privateRoomId, roomName, active } = privateRoomData;
    if (active !== 'SI') {
      // console.log('(onProcessPrivateRoom) La sala existe pero no está activa', privateRoomData);
      const isRoomStatusUpdated = await changePrivateRoomStatus(true, privateRoomId);
      // console.log('(onProcessPrivateRoom) ¿Se ha activado la sala?', isRoomStatusUpdated);
      if (!isRoomStatusUpdated) {
        return { error: 'Error al modificar el estado de la sala' };
      }
    }
    const privateRoom = {
      roomName,
      creatorName,
      creatorLogin,
      roomId: privateRoomId,
      guestLogin: creatorLogin,
      guestName: guestData.name,
      private: true,
      type: 'PRIVADA',
      role: ROLES.A2,
    };
    socket.to(guestLogin).emit('privateRoom', privateRoom);
    socket.join(`a2:${privateRoomId}`);
    io.in(guestLogin).socketsJoin(`a2:${privateRoomId}`);
    return { ...privateRoom, guestLogin };
  } catch (err) {
    throw err;
  }
}
module.exports.onProcessPrivateRoom = onProcessPrivateRoom;


function checkMessageError(room, messageContent) {
  const { roomId, role } = room;
  if (roomId === 301 && !role.canSendRelease) {
    return { error: 'No tienes permiso para publicar en Comunicación' };
  }
  if (!messageContent.trim()) return { error: 'El mensaje no puede estar vacío' };
  if (messageContent.length > 300) {
    return { error: 'El mensaje debe tener una longitud máxima de 300 caracteres' };
  }
}
module.exports.checkMessageError = checkMessageError;
