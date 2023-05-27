// -----------------------
// *  INICIO AUTH-LOGIN  *
// -----------------------

/* VALIDADO CHAT */
const updateSessionStatusQuery = queryStatus =>
  `UPDATE 
  "T_TOKENS_AUX" 
  SET ESTADO = :status ${queryStatus} 
  WHERE LOGIN = :login AND TOKEN = :token`;

  /* VALIDADO CHAT */
const refreshSessionQuery = `UPDATE 
"T_TOKENS_AUX" 
SET FECHA_EXPIRACION = :expireTime 
WHERE LOGIN = :login AND TOKEN = :token`;

/* VALIDADO CHAT */
const linkSocketToSessionQuery = `UPDATE 
"T_TOKENS_AUX" 
SET SOCKET = :socketId, 
ESTADO = 'ACTIVO' 
WHERE LOGIN = :login AND TOKEN = :token`;

/* VALIDADO CHAT */
const unlinkSocketFromSessionQuery = `UPDATE 
"T_TOKENS_AUX" 
SET SOCKET = '', ESTADO = 'AUTENTICADO' 
WHERE LOGIN = :login AND TOKEN = :token`;

/* VALIDADO CHAT */
const getActiveSessionQuery = queryToken => `SELECT
TOKEN "token",
LOGIN "login",
FECHA_EXPIRACION "expireTime",
ESTADO "state",
SOCKET "socketId"
FROM "T_TOKENS_AUX"
WHERE 
LOGIN = :login
${queryToken}
AND FECHA_EXPIRACION > :now
AND ESTADO IN ('ACTIVO', 'AUTENTICADO')
ORDER BY FECHA_EXPIRACION DESC
FETCH FIRST ROW ONLY`;

/* VALIDADO CHAT */
const getUserRoomsQuery = `SELECT 
ROLES.ID_SALA AS "roomId",
ROLES.ROL as "role",
LOWER(SALAS.NOMBRE_SALA) AS "roomName"
FROM
"T_ROLES_USUARIOS" ROLES
INNER JOIN "T_SALAS" SALAS ON SALAS.ID_SALA = ROLES.ID_SALA
WHERE
ROLES.LOGIN = :login
AND ROLES.ACTIVO = 'SI'
AND SALAS.TIPO = 'SERVICIO'`;

/* VALIDADO CHAT */
const updateAvatarQuery = `UPDATE "T_CONFIGURACION" SET AVATAR = :avatar WHERE LOGIN = :login`;

/* VALIDADO CHAT */
const checkCredentialsQuery = `SELECT 
CONFIG.ACCEDE_CHAT AS "canAccess"
FROM "T_CONFIGURACION" CONFIG
WHERE CONFIG.LOGIN = :login 
AND CONFIG.CONTRASENIA = :hashedPassword`;

/* VALIDADO CHAT */
const getProfileQuery = `SELECT
CONFIG.LOGIN AS "login",
CONFIG.NUM_EMPLEADO AS "nEmpleado",
CONFIG.AVATAR AS "avatar",
USUARIOS.NOM_USUARIO AS "name",
USUARIOS.ID_PLATAFORMA AS "platformId"
FROM
"T_CONFIGURACION" CONFIG
INNER JOIN "T_USUARIOS" USUARIOS ON USUARIOS.NUM_EMPLEADO = CONFIG.NUM_EMPLEADO
WHERE CONFIG.LOGIN = :login`;

// -----------------------
// *   FIN AUTH-LOGIN    *
// -----------------------
// *    INICIO USERS     *
// -----------------------

/* VALIDADO CHAT */
const getConnectedUsersQuery = (queryPlatform, queryRoles) => `SELECT
CONFIG.LOGIN AS "login",
LOWER(USUARIOS.NOM_USUARIO) AS "name",
ROLES.ROL AS "role"
FROM
"T_TOKENS_AUX" TOKENS
INNER JOIN "T_CONFIGURACION" CONFIG ON TOKENS.LOGIN = CONFIG.LOGIN
INNER JOIN "T_ROLES_USUARIOS" ROLES ON ROLES.LOGIN = TOKENS.LOGIN AND ROLES.ID_SALA = :roomId
INNER JOIN "T_USUARIOS" USUARIOS ON USUARIOS.NUM_EMPLEADO = CONFIG.NUM_EMPLEADO
WHERE
TOKENS.ESTADO = 'ACTIVO'
AND ROLES.ACTIVO = 'SI'
${queryPlatform}
${queryRoles}
AND TOKENS.FECHA_EXPIRACION > :now
AND TOKENS.LOGIN != :login`;

/* VALIDADO CHAT */
const getUserDataByRoomQuery = `SELECT 
USUARIOS.NOM_USUARIO AS "name",
ROLES.ROL AS "role"
FROM 
"T_TOKENS_AUX" TOKENS
INNER JOIN "T_CONFIGURACION" CONFIG ON TOKENS.LOGIN = CONFIG.LOGIN
INNER JOIN "T_USUARIOS" USUARIOS ON USUARIOS.NUM_EMPLEADO = CONFIG.NUM_EMPLEADO
INNER JOIN "T_ROLES_USUARIOS" ROLES ON ROLES.LOGIN = TOKENS.LOGIN AND ROLES.ID_SALA = :roomId
WHERE 
TOKENS.LOGIN = :login
AND TOKENS.ESTADO = 'ACTIVO'
AND ROLES.ACTIVO = 'SI'
AND TOKENS.FECHA_EXPIRACION > :now
ORDER BY TOKENS.FECHA_EXPIRACION DESC
FETCH FIRST ROW ONLY`;

/* VALIDADO CHAT */
const getNamesByUsersQuery = usersLogin => `SELECT 
LOWER(NOM_USUARIO) AS "name",
LOGIN AS "login"
FROM "T_USUARIOS" USUARIOS
INNER JOIN "T_CONFIGURACION" CONFIG ON USUARIOS.NUM_EMPLEADO = CONFIG.NUM_EMPLEADO
WHERE LOGIN IN(${usersLogin}) ORDER BY LOGIN DESC`;

// -----------------------
// *      FIN USERS      *
// -----------------------
// *    INICIO ROLES     *
// -----------------------

/* VALIDADO CHAT */
const addRolePrivateRoomquery = `
INSERT INTO "T_ROLES_USUARIOS"
(LOGIN, ROL, ID_SALA)
VALUES
(:login, 'A2', :roomId)`;

/* VALIDADO CHAT */
const getRoleByUserAndRoomQuery = `SELECT 
ROL AS "role" 
FROM "T_ROLES_USUARIOS"
WHERE LOGIN = :login
AND ID_SALA = :roomId`;

/* VALIDADO CHAT */
const changeRolequery = `UPDATE 
"T_ROLES_USUARIOS" 
SET ROL = :role 
WHERE LOGIN = :login 
AND ID_SALA = :roomId `;

// -----------------------
// *      FIN ROLES      *
// -----------------------
// *  INICIO MENSAJES    *
// -----------------------

/* VALIDADO CHAT */
const getAvailableMessagesQuery = (queryRoles, queryAnswers, queryPlatform, isCommon) => `SELECT 
"avatar",
"date",
"emitter",
"labels",
"lastState",
"message",
"messageId",
"name",
"platformId",
"previousId",
"previousMessage",
"previousUserName",
"receiver",
"role",
"roomId",
"stateDate",
"stateLOGIN"
FROM "V_MENSAJES_CHAT"
WHERE 
"roomId" = :roomId
${isCommon ? '' : `AND "date" LIKE TO_DATE(:now,'YYYY-MM-DD')`} 
AND ("role" IN (${queryRoles}) OR "emitter" = :login) 
${queryAnswers}
${queryPlatform}`;

/* VALIDADO CHAT */
const getFilteredMessagesQuery = (queryRoles, queryAnswers, queryPlatform, filter) => `SELECT 
"avatar",
"date",
"emitter",
"labels",
"lastState",
"message",
"messageId",
"name",
"platformId",
"previousId",
"previousMessage",
"previousUserName",
"receiver",
"role",
"roomId",
"stateDate",
"stateLOGIN"
FROM "V_MENSAJES_CHAT"
WHERE 
"roomId" = :roomId
AND "date" >= TO_DATE(:now,'YYYY-MM-DD')
AND ("role" IN (${queryRoles}) OR "emitter" = :login) 
${queryAnswers}
${filter}
${queryPlatform}`;


/* VALIDADO CHAT */
const getAnswersByIdQuery = `SELECT
"name",
"message",
"role",
"emitter"
FROM
"V_MENSAJES_CHAT"
WHERE "messageId" = :messageId`;


/* VALIDADO CHAT */
const createMessageQuery = `INSERT INTO "T_MENSAJES" 
(
  SALA,
  LOGIN_EMISOR,
  NOMBRE,
  LOGIN_RECEPTOR,
  MENSAJE,
  ID_ANTERIOR,
  ETIQUETAS,
  ID_PLATAFORMA
) VALUES (
  :roomId,
  :emitter,
  :name,
  :receiver,
  :message,
  :previousId,
  :labels,
  :platformId
) RETURNING ID_MENSAJE INTO :id`;

/* VALIDADO CHAT */
const createMessageStateQuery = `INSERT 
INTO "T_ESTADO_MENSAJES" (
  ID_MENSAJE, ESTADO_ID, ESTADO, LOGIN
) VALUES (
  :messageId, :stateId, :state, :login
)`;

// -----------------------
// *    FIN MENSAJES     *
// -----------------------

// -----------------------
// *    ROOMS     *
// -----------------------

/* VALIDADO CHAT */
const getRoomTypeQuery = `SELECT
TIPO AS "type" 
FROM "T_SALAS"
WHERE ID_SALA = :roomId`;


/* VALIDADO CHAT */
const getCommonRoomsQuery = `SELECT DISTINCT
SALAS.ID_SALA AS "roomId",
LOWER(SALAS.NOMBRE_SALA) AS "roomName",
SALAS.TIPO AS "type",
ROLES.ROL AS "role"
FROM "T_SALAS" SALAS 
INNER JOIN "T_ROLES_USUARIOS" ROLES ON ROLES.ID_SALA = SALAS.ID_SALA 
WHERE 
SALAS.TIPO = 'COMUN'
AND SALAS.ACTIVA = 'SI'
AND ROLES.ACTIVO = 'SI'
AND ROLES.LOGIN = :login`;

/* VALIDADO CHAT */
const createPrivateRoomQuery = `
INSERT INTO
"T_SALAS"
(CREADOR, TIPO, ACTIVA, NOMBRE_SALA)
VALUES
(:login, 'PRIVADA', 'SI', :roomName)
RETURNING ID_SALA INTO :id`;

/* VALIDADO CHAT */
const changePrivateRoomStatusQuery = `
UPDATE "T_SALAS"
SET ACTIVA = :active
WHERE ID_SALA = :roomId`;

/* VALIDADO CHAT */
const getPrivateRoomByNameQuery = `SELECT
ID_SALA AS "roomId",
LOWER(NOMBRE_SALA) AS "roomName",
ACTIVA AS "active",
TIPO AS "type"
FROM 
"T_SALAS"
WHERE
TIPO = 'PRIVADA'
AND NOMBRE_SALA = :roomName`;

/* VALIDADO CHAT */
const getPrivateRoomsbyUserQuery = `SELECT DISTINCT
SALAS.ID_SALA AS "roomId",
SALAS.NOMBRE_SALA AS "roomName",
SALAS.TIPO AS "type"
FROM "T_SALAS" SALAS 
INNER JOIN "T_ROLES_USUARIOS" ROLES ON ROLES.ID_SALA = SALAS.ID_SALA 
WHERE 
SALAS.ACTIVA = 'SI'
AND SALAS.NOMBRE_SALA LIKE :login`;

/* VALIDADO CHAT */
const getServiceByNameQuery = `SELECT 
ID_SALA 
FROM 
"T_SALAS" 
WHERE 
NOMBRE_SALA LIKE :roomId`;

// -----------------------
// *    FIN ROOMS     *
// -----------------------

module.exports = {
  // Auth-login
  updateSessionStatusQuery,
  refreshSessionQuery,
  linkSocketToSessionQuery,
  unlinkSocketFromSessionQuery,
  getActiveSessionQuery,
  getUserRoomsQuery,
  updateAvatarQuery,
  checkCredentialsQuery,
  getProfileQuery,
  // Users
  getConnectedUsersQuery,
  getUserDataByRoomQuery,
  getNamesByUsersQuery,
  // Roles
  addRolePrivateRoomquery,
  getRoleByUserAndRoomQuery,
  changeRolequery,
  // Messages
  getAvailableMessagesQuery,
  getFilteredMessagesQuery,
  createMessageStateQuery,
  createMessageQuery,
  getAnswersByIdQuery,
  // Rooms
  getRoomTypeQuery,
  createPrivateRoomQuery,
  changePrivateRoomStatusQuery,
  getPrivateRoomByNameQuery,
  getPrivateRoomsbyUserQuery,
  getServiceByNameQuery,
  getCommonRoomsQuery,
};
