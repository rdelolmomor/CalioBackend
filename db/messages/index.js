const { pools } = require('../oracle.pools');
const {
  getTodayDate,
  prepareMessageCreation,
  getTimeFromSomeHoursAgo,
} = require('../../lib/helper');
const { query } = require('../oracle.query');
const {
  getAvailableMessagesQuery,
  getFilteredMessagesQuery,
  createMessageQuery,
  getAnswersByIdQuery,
  createMessageStateQuery,
} = require('../oracle.queries');
const { idOutBind } = require('../oracle.constants');
const { ROLES } = require('../../lib/Role');
const { getRoomType } = require('../rooms/');

/**
 * Obtiene la lista de mensajes que puede ver un usuario en una determinada sala, lama al metodo "getAvailableMessagesQuery"
 * @param {string} login
 * @param {number} roomId
 * @param {number} platformId
 * @param {number} role
 * @returns {Promise<boolean>} Indicador del éxito de la operación
 */
async function getAvailableMessages(login, roomId, platformId, role) {
  const objRole = ROLES[role];
  const queryRoles = objRole
    .getMessageRoles()
    .map(r => `'${r}'`)
    .join();
  const roomType = await getRoomType(roomId);
  const isPrivateRoom = roomType === 'PRIVADA';
  const isCommonRoom = roomType === 'COMUN';
  // Se agrega un filtro por plataforma para las salas departamentales y roles que no sean interplataforma
  let queryPlatform =
    isPrivateRoom || objRole.interplatform ? '' : `AND "platformId" = ${platformId}`;
  // Se agrega un filtro para el nivel más bajo, así solo reciben las respuestas que le corresponden.
  const queryAnswer =
    role === 'A1'
      ? `AND ("previousId" IS null OR "previousLOGIN" = '${login}') AND ("receiver" IS NULL OR "receiver" = '${login}')`
      : '';
  const queryString = getAvailableMessagesQuery(
    queryRoles,
    queryAnswer,
    queryPlatform,
    isCommonRoom
  );
  //Si la sala es comun obtiene mensajes sin distinción de fecha, si no es común (de servicio o privadas) obtiene solo los del día en curso
  const queryParams = isCommonRoom
    ? { roomId, login }
    : { roomId, login, now: getTodayDate().split('T')[0] };
  const result = await query(pools.get, queryString, queryParams);
  return result.rows;
}

module.exports.getAvailableMessages = getAvailableMessages;

/**
 * Obtiene una lista de mensajes filtrados por una palabra.
 * @param {string} login
 * @param {number} roomId
 * @param {number} platformid
 * @param {string} role
 * @param {string} filter
 * @returns {Promise<boolean>} Indicador del éxito de la operación
 */
async function getFilteredMessages(login, roomId, platformId, role, filter) {
  try {
    const objRole = ROLES[role];
    const queryRoles = objRole
      .getMessageRoles()
      .map(r => `'${r}'`)
      .join();
    const roomType = await getRoomType(roomId);
    const isPrivateRoom = roomType === 'PRIVADA';
    // Se agrega un filtro por plataforma para las salas departamentales y roles que no sean interplataforma
    let queryPlatform =
      isPrivateRoom || objRole.interplatform ? '' : `AND "platformId" = ${platformId}`;
    // Se agrega un filtro para el nivel más bajo, así solo reciben las respuestas que le corresponden.
    const queryAnswer =
      role === 'A1'
        ? `AND ("previousId" IS null OR "previousLOGIN" = '${login}') AND ("receiver" IS NULL OR "receiver" = '${login}')`
        : '';
    const addFilter = `AND "message" like '%${filter}%'`;
    const queryString = getFilteredMessagesQuery(queryRoles, queryAnswer, queryPlatform, addFilter);
    const queryParams = { roomId, login, now: getTimeFromSomeHoursAgo(72).split('T')[0] };
    const result = await query(pools.get, queryString, queryParams);
    return result.rows;
  } catch (err) {
    throw err;
  }
}
module.exports.getFilteredMessages = getFilteredMessages;

/**
 * Obtiene la contestación a un id de mensaje concreto
 * @param {number} messageId
 * @returns {Promise<{name: string, message: string, role: string, emitter: string}>}  Objeto Mensaje
 */
async function getAnswerByMessageId(messageId) {
  try {
    const message = await query(pools.get, getAnswersByIdQuery, { messageId });
    return message.rows[0];
  } catch (err) {
    throw err;
  }
}

module.exports.getAnswerByMessageId = getAnswerByMessageId;


/**
 * Genera un nuevo mensaje en la BD.
 * @param {{roomId: number, emitter: string, name: string, platformId: number, receiver?: string, message: string, previousMessageId?: number, labels?: string}} messageData
 * @returns {Promise<boolean>} Indicador del éxito de la operación
 */
async function createMessage(messageData) {
  try {
    const message = prepareMessageCreation(messageData);
    let queryVariables = { ...message, id: idOutBind };
    const result = await query(pools.update, createMessageQuery, queryVariables);
    return result.rowsAffected > 0 ? parseInt(result.outBinds.id) : undefined;
  } catch (err) {
    throw err;
  }
}

module.exports.createMessage = createMessage;

const states = ['ENVIADO', 'LEÍDO', 'ASIGNADO', 'RESPONDIDO', 'REVERTIDO'];

/**
 * Añade un estado al mensaje a partir de un id de mensaje
 * @param {string} login
 * @param {number} messageId
 * @param {number} stateId
 */
async function createMessageState(login, messageId, stateId) {
  try {
    const state = states[stateId - 1];
    const queryParams = { messageId, stateId, state, login };
    const result = await query(pools.update, createMessageStateQuery, queryParams);
    return result.rowsAffected > 0;
  } catch (err) {
    throw err;
  }
}

module.exports.createMessageState = createMessageState;
