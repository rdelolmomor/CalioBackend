const express = require('express');
/**
 * Objeto de Express que realiza las funciones de obtención de usuarios
 */
const usersRouter = express.Router();
const { getConnectedUsers, getRoleByUserAndRoom } = require('../db/users');
const { checkParam } = require('../lib/helper');

/**
 * Función de validación de parametros que llama a "checkParam"
 * @param {String} login
 * @param {String} token
 * @param {number} roomId
 * @param {Object} filters
 */
function validateParamaters(login, token, roomId, filters = {}) {
  try {
    checkParam(login, 'string', 'login');
    checkParam(token, 'string', 'token');
    checkParam(roomId, 'number', 'roomId');
    checkParam(filters, 'object', 'filters');
  } catch (err) {
    return err.toString();
  }
}

/**
 * POST que recupera los usuarios conectados según el ID de sala, llama a "getConnectedUsers"
 */
usersRouter.post('/getConnected', async (req, res) => {
  let { login, token, roomId } = req.body;
  const validationError = validateParamaters(login, token, roomId);
  if (validationError) {
    return res.status(422).send({ error: validationError });
  }
  try {
    const session = await req.sessionManager.getSession(login, token);
    if (!session) {
      return res.status(401).send({ error: `Sesión inválida` });
    }
    const role = await getRoleByUserAndRoom(login, roomId);
    if (role.error) {
      return res.status(200).send(role);
    }
    const users = await getConnectedUsers(login, roomId, session.platformId, role.role);
    console.log('getConnected users: ',users);
    res.status(200).send(users);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

module.exports = usersRouter;

