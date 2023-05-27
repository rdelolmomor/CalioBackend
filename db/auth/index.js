const { query } = require('../oracle.query');
const { pools } = require('../oracle.pools');
const { getOffsetNow, getOffsetNowUpdated } = require('../../lib/helper');
const { ROLES } = require('../../lib/Role');
const { getUserRooms, getPrivateRoomsbyUser, getCommonRooms } = require('../rooms');
const { getNamesByUsers } = require('../users');
const { updateAvatarQuery } = require('../oracle.queries');
const { createToken } = require('../../lib/requester');
const {
  refreshSessionQuery,
  linkSocketToSessionQuery,
  unlinkSocketFromSessionQuery,
  updateSessionStatusQuery,
  getActiveSessionQuery,
  checkCredentialsQuery,
  getProfileQuery,
} = require('../oracle.queries');

/**
 * Recibe los datos de logado de usuario y devuelve un objeto con la información de la sesión.
 * Llama a "createToken" que establece el logado
 * Llama a "getProfile" que devuelve el perfil del usuario
 * @param {string} login
 * @param {string} password
 * @returns {Promise<{ session: {token: string, login: string, expireTime: number, state: 'AUTENTICADO', socketId: undefined }, profile: {login: string, avatar: object, name: string, platformId: number, rooms: Array<Room> } }>} Objeto con la sesión y el perfil del usuario.
 */
async function loginUser(login, password) {
  try {
    const tokenData = await createToken(login, password);
    //console.log('TokenData devuelto', tokenData);
    const { token, expireTime } = tokenData;
    const session = { token, expireTime, login, state: 'AUTENTICADO' };
    const profile = await getProfile(login);
    console.log('Profile', profile);
    return { session, profile };
  } catch (err) {
    throw err;
  }
}

module.exports.loginUser = loginUser;

/**
 * Obtiene la sesión activa si existe. Devuelve un objeto son los datos de la sesión activa
 * @param {string} login
 * @param {string} token
 * @returns {Promise<{token: string, login: string, expireTime: number, state: 'AUTENTICADO' | 'ACTIVO', socketId?: string }>} Sesión activa
 */
async function getActiveSession(login, token = undefined) {
  try {
    const queryToken = token ? 'AND token = :token' : '';
    const queryString = getActiveSessionQuery(queryToken);
    const now = getOffsetNow();
    const queryParams = token ? { login, token, now } : { login, now };
    const result = await query(pools.auth, queryString, queryParams);
    return result.rows[0];
  } catch (err) {
    console.error('Error getting active session:', err);
    throw err;
  }
}

module.exports.getActiveSession = getActiveSession;

/**
 * Intenta la comprobación de credenciales del usuario y devuelve, si procede, un error informativo.
 * @param {string} login
 * @param {string} hashedPassword
 * @returns {Promise<{error:String}>} Objeto con un parámetro error si procede, undefined en caso contrario
 */
async function checkCredentials(login, hashedPassword) {
  try {
    const result = await query(pools.auth, checkCredentialsQuery, { login, hashedPassword });
    if (result.rows.length === 0) {
      return { error: 'Usuario y/o contraseña incorrectos' };
    } else if (result.rows[0].canAccess === 'NO') {
      return { error: 'Usuario sin acceso al chat' };
    }
    return result;
  } catch (err) {
    console.error('Error checking credentials:', err);
    throw err;
  }
}

module.exports.checkCredentials = checkCredentials;

/**
 * Intenta devolver el perfil de un usuario.
 * Realiza una consulta sobre un login y sobre el resultado le añade:
 *    Las Salas de Servicios llamando a "getUserRooms"
 *    Las Salas Privadas llamando a "getPrivateRoomsbyUser"
 *    Las Salas Comunes llamando a "getCommonRooms"
 * En el caso de las salas privadas, extrae el nombre del otro usuario a traves del nombre de la sala y llama a "getNamesBylogins"
 * @param {string} login
 * @returns {Promise<{login: string, avatar: object, name: string, platformId: number, rooms: Array<Room> }} Objeto perfil
 */
async function getProfile(login) {
  try {
    const result = await query(pools.auth, getProfileQuery, { login });
    if (result.rows[0]) {
      const rooms = await getUserRooms(login);
      //console.log('Service rooms on getProfile', rooms);
      result.rows[0].rooms = rooms.map(room => ({ ...room, role: ROLES[room.role] }));
      let privateRooms = await getPrivateRoomsbyUser(login);
      //console.log('Private rooms on getProfile', privateRooms);
      if (privateRooms.length > 0) {//Si tenemos salas privadas 
        privateRooms = privateRooms
          .map(room => ({
            ...room,
            userLogin: room.roomName.split(login).join('').replace(':', ''),
          }))
          .sort((a, b) => a.userLogin.localeCompare(b.userLogin));
        const usersLogin = privateRooms.map(room => `'${room.userLogin}'`);
        //console.log('usersLogin', usersLogin);
        const usersName = await getNamesByUsers(usersLogin);
        privateRooms = privateRooms.map((room, index) => ({
          ...room,
          roomName: usersName[index].name,
        }));
      }
      //console.log('privateRooms', privateRooms);
      const commonRooms = await getCommonRooms(login);//Obtener las salas comunes
      //console.log('Common room on getProfile:', commonRooms);
      result.rows[0].rooms = result.rows[0].rooms.concat(privateRooms, commonRooms);
      result.rows[0].rooms.forEach(room => (room.sound = true));
      return result.rows[0];
    }
  } catch (err) {
    console.error('Error verifying user credentials:', err);
    throw err;
  }
}

module.exports.getProfile = getProfile;

/**
 * Actualiza el tiempo de expiración de una sesión.
 * @param {string} login
 * @param {string} token
 * @returns {Promise<boolean>} Indicador del éxito de la actualización
 */
async function refreshSession(login, token) {
  try {
    const expireTime = getOffsetNowUpdated();
    const result = await query(pools.auth, refreshSessionQuery, { expireTime, login, token });
    return result.rowsAffected > 0;
  } catch (err) {
    console.error('Error refreshing session:', err);
    throw err;
  }
}

module.exports.refreshSession = refreshSession;

/**
 * Enlaza un socket (id) con una sesión en curso.
 * @param {string} login
 * @param {string} token
 * @param {string} socketId
 * @returns {Promise<boolean>} Indicador del éxito del vínculo
 */
async function linkSocketToSession(login, token, socketId) {
  try {
    const result = await query(pools.auth, linkSocketToSessionQuery, { socketId, login, token });
    return result.rowsAffected > 0;
  } catch (err) {
    console.error('Error linking socket to session:', err);
    throw err;
  }
}

module.exports.linkSocketToSession = linkSocketToSession;

/**
 * Elimina el enlace de un socket con una sesión.
 * @param {string} login
 * @param {string} token
 * @returns {Promise<boolean>} Indicador del éxito de la desvinculación
 */
async function unlinkSocketFromSession(login, token) {
  try {
    const result = await query(pools.auth, unlinkSocketFromSessionQuery, { login, token });
    return result.rowsAffected > 0;
  } catch (err) {
    console.error('Error unlinking socket from session:', err);
    throw err;
  }
}

module.exports.unlinkSocketFromSession = unlinkSocketFromSession;

/**
 * Actualiza el estado de una sesión. Si es 'CERRADO' o 'CADUCADO' además modifica la fecha de expiración.
 * @param {string} login
 * @param {string} token
 * @param {'CERRADO'} status
 * @returns {Promise<boolean>} Indicador de si se ha actualizado o no
 */
async function updateSessionStatus(login, token, status = 'CERRADO') {
  try {
    const isSessionClosing = ['CERRADO', 'CADUCADO'].includes(status);
    const queryStatus = isSessionClosing ? ', FECHA_EXPIRACION = :now' : '';
    const queryString = updateSessionStatusQuery(queryStatus);
    const params = { status, login, token };
    if (isSessionClosing) {
      params.now = getOffsetNow();
    }
    const result = await query(pools.auth, queryString, params);
    return result.rowsAffected > 0;
  } catch (err) {
    console.error('Error trying to update session status:', err);
    throw err;
  }
}

module.exports.updateSessionStatus = updateSessionStatus;

/**
 * Actualiza el avatar de usuario
 * @param {string} login
 * @param {string} avatar
 * @returns {Promise<boolean>} Indicador de si se ha actualizado o no
 */
async function updateUserAvatar(login, avatar = 'Default') {
  try {
    const queryParams = { avatar, login };
    const result = await query(pools.update, updateAvatarQuery, queryParams);
    return result.rowsAffected > 0;
  } catch (err) {
    throw err;
  }
}

module.exports.updateUserAvatar = updateUserAvatar;
