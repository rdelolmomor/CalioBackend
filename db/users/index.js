const { pools } = require('../oracle.pools');
const { ROLES } = require('../../lib/Role');
const { getOffsetNow } = require('../../lib/helper');
const { query } = require('../oracle.query');

const {
  getConnectedUsersQuery,
  getRoleByUserAndRoomQuery,
  getServiceByNameQuery,
  getUserDataByRoomQuery,
  getNamesByUsersQuery,
  changeRolequery,
} = require('../oracle.queries');

function getUsersQueryParams(role, platformId) {
  const userRole = ROLES[role];
  if (isNaN(userRole.code)) throw new TypeError('role param is not defined');

  const { canSeeOnline, interplatform } = userRole;
  if (!canSeeOnline) throw new Error('Usuario sin permiso para ver a otros usuarios.');

  const queryRoles =
    canSeeOnline === 'ALL' ? ' ' : ` AND ROLES.ROL IN(${canSeeOnline.map(r => `'${r}'`).join()})`;
  const queryPlatform = interplatform === true ? ' ' : `AND USUARIOS.ID_PLATAFORMA = ${platformId}`;
  return { userRole, queryRoles, queryPlatform };
}

/**
 * Obtiene el rol de un usuario en una sala dada.
 * @param {string} login
 * @param {number} roomId
 * @returns {Promise<Role>} Objeto Rol
 */
async function getRoleByUserAndRoom(login, roomId) {
  try {
    const result = await query(pools.get, getRoleByUserAndRoomQuery, { login, roomId });
    if (result.rows.length === 0) {
      console.log('El usuario no tiene acceso a la sala especificada.')
      return { error: 'El usuario no tiene acceso a la sala especificada.' };
    }
    const role = ROLES[result.rows[0].role];
    if (!role) {
      return { error: 'El usuario no tiene los permisos bien formulados.' };
    }
    return role;
  } catch (err) {
    throw err;
  }
}

module.exports.getRoleByUserAndRoom = getRoleByUserAndRoom;

/**
 * Obtiene la lista de usuarios conectados en función del permiso del usuario en una sala dada.
 * @param {string} login
 * @param {number} roomId
 * @param {number} platformId
 * @param {number} role
 * @returns {Promise<Array<{ login: string, name: string, platformId: number, roomId: number, role: string }>>}
 */
async function getConnectedUsers(login, roomId, platformId, role) {
  try {
    const { queryRoles, queryPlatform } = getUsersQueryParams(role, platformId);
    const queryString = getConnectedUsersQuery(queryPlatform, queryRoles);
    const queryVariables = { roomId, login, now: getOffsetNow() };
    const result = await query(pools.get, queryString, queryVariables);
    return result.rows;
  } catch (err) {
    throw err;
  }
}

module.exports.getConnectedUsers = getConnectedUsers;


async function getUserDataByRoom(login, roomId) {
  try {
    const queryParams = { login, roomId, now: getOffsetNow() };
    const result = await query(pools.get, getUserDataByRoomQuery, queryParams);
    return result.rows[0];
  } catch (err) {
    throw err;
  }
}
module.exports.getUserDataByRoom = getUserDataByRoom;

async function getNamesByUsers(usersLogin = []) {
  if (Array.isArray(usersLogin) && usersLogin.length === 0) {
    return [];
  }
  console.log('UserLogin en getNamesByUsers: ',usersLogin)
  const queryString = getNamesByUsersQuery(usersLogin);
  const result = await query(pools.get, queryString, {});
  console.log('Result getNamesByUsers', result);
  return result.rows.sort((a, b) => a.login.localeCompare(b.login));
}

module.exports.getNamesByUsers = getNamesByUsers;

/*Actualizar un rol a partir de un login y una Sala*/
async function changeRole(login, role, roomId) {
  try {
    //Revisar existencia de roomId
    const service = await query(pools.get, getServiceByNameQuery, { roomId });
    if (service.length < 1) {
      return false;
    }
    const queryVariables = { login, roomId, role };
    //Actualizar el rol en BD
    const isChanged = await query(pools.update, changeRolequery, queryVariables);
    return isChanged.rowsAffected > 0;
  } catch (err) {
    throw err;
  }
}

module.exports.changeRole = changeRole;
