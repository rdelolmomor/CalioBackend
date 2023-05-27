const express = require('express');
/**
 * Objeto de Express que realiza las funciones de obtención de mensajes
 */
const messagesRouter = express.Router();
//const { getRoleByUserAndRoom } = require('../db/users');
const { getAvailableMessages, getFilteredMessages } = require('../db/messages');
const { checkParam } = require('../lib/helper');

/**
 * Función de validación de parametros que llama a "checkParam"
 * @param {String} login
 * @param {String} token
 * @param {number} roomId
 * @param {number} platformId
 */
function validateParamaters(login, token, roomId, platformId) {
  try {
    checkParam(login, 'string', 'login');
    checkParam(token, 'string', 'token');
    checkParam(roomId, 'number', 'roomId');
    checkParam(platformId, 'number', 'platformId');
  } catch (err) {
    console.log('error en validateParameters', err);
    return err.toString();
  }
}

function validateFilter(filter) {
  try {
    checkParam(filter, 'string', 'filter');
  } catch (err) {
    return 'Introduzca un filtro para buscar mensajes';
  }
}

/**
 * POST para obtener los mensajes disponibles de una sala, llama a "getAvailableMessages"
 */
messagesRouter.post('/getAvailable', async (req, res) => {
  const { login, token, roomId, platformId } = req.body;
  const validationError = validateParamaters(login, token, roomId, platformId);
  if (validationError) {
    return res.status(422).send({ error: validationError });
  }
  try {
    const session = await req.sessionManager.getSession(login, token);
    if (!session) {
      return res.status(401).send({ error: 'Sesión inválida' });
    }
    const room = session.rooms.filter(room => room.roomId === roomId)[0];
    if (!room) {
      return res.status(401).send({ error: 'No tiene acceso a la sala' });
    }
    if (platformId !== session.platformId && !room.interplatform) {
      return res.status(401).send({ error: 'No pertenece a la plataforma' });
    }
    const messages = await getAvailableMessages(login, roomId, platformId, room.role.role);
    console.log('GetAvailable messages: ',messages)
    res.status(200).send(messages);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

/**
 * POST para obtener los mensajes filtrados de una sala, llama a "getFilteredMessages"
 */
messagesRouter.post('/getFiltered', async (req, res) => {
  const { login, token, roomId, platformId, filter } = req.body;
  const validationError = validateParamaters(login, token, roomId, platformId);
  if (validationError) {
    return res.status(422).send({ error: validationError });
  }
  const validationFilterError = validateFilter(filter);
  if (validationFilterError) {
    return res.status(422).send({ error: validationFilterError });
  }
  try {
    const session = await req.sessionManager.getSession(login, token);
    if (!session) {
      return res.status(401).send({ error: 'Sesión inválida' });
    }
    const room = session.rooms.filter(room => room.roomId === roomId)[0];
    if (!room) {
      return res.status(401).send({ error: 'No tiene acceso a la sala' });
    }
    if (platformId !== session.platformId && !room.interplatform) {
      return res.status(401).send({ error: 'No pertenece a la plataforma' });
    }
    const messages = await getFilteredMessages(login, roomId, platformId, room.role.role, filter);
    res.status(200).send(messages);
  } catch (err) {
    console.log('error en getFiltered', err);
    res.status(500).send({ error: err.message });
  }
});


module.exports = messagesRouter;
