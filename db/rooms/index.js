const { pools } = require('../oracle.pools');
const { query, multiQuery } = require('../oracle.query');
const {
  createPrivateRoomQuery,
  changePrivateRoomStatusQuery,
  getPrivateRoomsbyUserQuery,
  getPrivateRoomByNameQuery,
  getRoomTypeQuery,
  addRolePrivateRoomquery,
  getCommonRoomsQuery,
  getUserRoomsQuery,
} = require('../oracle.queries');
const { idOutBind } = require('../oracle.constants');
const { ROLES } = require('../../lib/Role');

async function createPrivateRoom(login, roomName) {
  const queryParams = { login, roomName, id: idOutBind };
  const result = await query(pools.update, createPrivateRoomQuery, queryParams);
  return result.rowsAffected > 0 ? parseInt(result.outBinds.id) : undefined;
}

module.exports.createPrivateRoom = createPrivateRoom;


async function changePrivateRoomStatus(status, roomId) {
  const active = status ? 'SI' : 'NO';
  console.log('status:', active);
  const queryParams = { roomId, active };
  console.log(queryParams);
  const result = await query(pools.update, changePrivateRoomStatusQuery, queryParams);
  console.log('Rows Affected ', result.rowsAffected);
  return result.rowsAffected > 0;
}
module.exports.changePrivateRoomStatus = changePrivateRoomStatus;

async function createPrivateRoomRoles(logins, roomId) {
  const queries = Array(2).fill(addRolePrivateRoomquery);
  const params = [
    { roomId, login: logins[0] },
    { roomId, login: logins[1] },
  ];
  const results = await multiQuery(pools.update, queries, params);
  return results.length === 2 && results.every(result => result.rowsAffected > 0);
}
module.exports.createPrivateRoomRoles = createPrivateRoomRoles;

async function addPrivateRoomRole(login, role, roomId) {
  const queryVariables = { login, role, roomId };
  const result = query(pools.update, addRolePrivateRoomquery, queryVariables);
  return result.rowsAffected > 0 ? true : false;
}
module.exports.addPrivateRoomRole = addPrivateRoomRole;

async function createUserRole(login, roomId, role) {
  const queryString = `INSERT INTO "T_ROLES_USUARIOS" (LOGIN, ID_SALA, ROL, ACTIVO) VALUES (:login, :roomId, :role, 'SI')`;
  const result = await query(pools.update, queryString, { login, roomId, role });
  if (result.rowsAffected > 0) return ROLES[role];
}

module.exports.createUserRole = createUserRole;

async function getRoomById(roomId) {
  if (roomId < 10000) { //Las salas por encima de la 10000 son salas privadas
    const queryStringService = `SELECT LOWER(NOMBRE_SALA) AS "roomName" FROM "T_SALAS" WHERE ID_SALA = :roomId`;
    const result = await query(pools.get, queryStringService, { roomId });
    if (result.rows.length > 0) return { ...result.rows[0], type: 'DEPARTAMENTO' };
    return;
  }
  const queryString = `SELECT
  TIPO AS "type",
  NOMBRE_SALA AS "roomName"
  FROM
  "T_SALAS"
  WHERE 
  ID_SALA = :roomId`;
  const result = await query(pools.get, queryString, { roomId });
  return result.rows[0];
}

module.exports.getRoomById = getRoomById;

/**
 * Intenta devolver las salas y permisos de un usuario
 * @param {string} login
 * @returns {Promise<Array<Room>>}
 */
async function getUserRooms(login) {
  try {
    const result = await query(pools.auth, getUserRoomsQuery, { login });
    return result.rows.map(room => ({ ...room, type: 'DEPARTAMENTO' })); //Retorna las salas de tipo "Departamento"
  } catch (err) {
    console.error('Error getting user rooms:', err);
    throw err;
  }
}

module.exports.getUserRooms = getUserRooms;

async function getPrivateRoomsbyUser(login) {
  let queryValues = { login: `%${login}%` };
  const result = await query(pools.get, getPrivateRoomsbyUserQuery, queryValues);//Se obtienen las salas privadas
  const role = { ...ROLES.A2, canAnswerMention: false, canSeeOnline: false };//Se define el rol A2 con 2 modificaciones necesarias para sala privada
  return result.rows.map(room => ({ ...room, role, private: true }));
}
module.exports.getPrivateRoomsbyUser = getPrivateRoomsbyUser;

/**
 * Intenta devolver las salas y permisos de un usuario
 * @param {string} login
 * @returns {Promise<Array<Room>>}
 */
async function getCommonRooms(login) {
  const result = await query(pools.auth, getCommonRoomsQuery, { login });
  return result.rows.map(room => {
    const role = ROLES[room.role];
    return { ...room, role };
  });
}
module.exports.getCommonRooms = getCommonRooms;

async function getPrivateRoomByName(creatorLogin, guestLogin) {
  try {
    const roomName = [creatorLogin, guestLogin].sort().join(':');
    const result = await query(pools.get, getPrivateRoomByNameQuery, { roomName });
    return result.rows[0];
  } catch (err) {
    throw err;
  }
}
module.exports.getPrivateRoomByName = getPrivateRoomByName;

async function getRoomType(roomId) {
  const result = await query(pools.get, getRoomTypeQuery, { roomId });
  if (result.rows.length > 0) return result.rows[0].type;
  return 'SERVICIO';
}

module.exports.getRoomType = getRoomType;
