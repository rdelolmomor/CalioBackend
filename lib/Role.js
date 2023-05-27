/* TODO */
const ROLE_MAP = {
  A1: 0, //AGENTE - Puede leerse a si mismo pero no mensajes de otros agentes. Puede responder a otros mensajes. Solo puede ver conectados a usuarios con rol Coordinador. No puede silenciar la sala.
  A2: 1, //SUPERAGENTE - Puede leer todos los mensajes, puede contestar mensajes, puede mencionar a otro usuario. Solo puede ver conectados a usuarios con rol Coordinador. No puede silenciar la sala.
  C1: 10, //COORDINADOR/FORMADOR - Puede leer todos los mensajes. Puede Responder mensajes, puede mencionar usuarios, puede abrir salas privadas. Puede asignarse/desasignarse un mensaje. Puede ver conectados usuarios con rol "agente", "superagente", y otros coordinadores. Puede silenciar una sala. Puede enviar notificaciones a otros usuarios.
  C2: 11, //COMUNICACION - Puede leer todos los mensajes. No puede responder mensajes, puede ver conectados usuarios con roles desde A1 hasta C3. Usuario exclusivo para la sala "Comunicacion" en la que se publican noticias y anuncios sobre la plataforma.
  C3: 13, //RECURSOS HUMANOS - Usuario exclusivo para la sala "RRHH". Puede leer todos los mensajes. Puede responder mensajes. Puede ver conectados usuarios con roles desde A1 hasta S1
  S1: 20, //SUPERVISOR - Puede leer todos los mensajes de roles inferioes e iguales al suyo. Puede Responder mensajes, puede mencionar usuarios, puede abrir salas privadas. No puede asignarse/desasignarse mensajes. Puede ver usuarios conectados. Puede silenciar una sala. Puede enviar notificaciones a otros usuarios.
  R1: 30, //RESPONSABLE AREA - Igual que Supervisor, pero tambien puede leer a otros responsables y puede leer mensajes de otras plataformas.
  Z1: 90, //ADMINISTRADOR
  Z2: 99, //DESARROLLADOR
};

const ROLE_MAP_INV = Object.entries(ROLE_MAP).reduce((acc, [role, code]) => {;
  acc[code] = role;
  return acc;
}, {});

class Role {
  constructor( role, canReceiveFrom, interplatform, canAnswerMention, canSeeOnline, canExport, canSendRelease ) {
    if (!Object.keys(ROLE_MAP).includes(role)) {
      console.error('[Role] role argument must be in the predefined list of roles.', role);
      throw new Error('Error in Role constructor: role must be in the predefined list of roles.');
    }
    this.role = role; //Nombre del rol
    this.canReceiveFrom = canReceiveFrom; //De quien puede recibir mensajes
    this.interplatform = interplatform; //Si es un usuario interplataforma (para departamentos que puedan existir en varias plataformas distintas)
    this.canAnswerMention = canAnswerMention; //Si puede contestar menciones que se le hagan
    this.canSeeOnline = canSeeOnline; //A quien puede ver online
    this.canExport = canExport; //Si puede exportar conversaciones
    this.canSendRelease = canSendRelease; //Posibilidad de publicar en una sala (para usuarios de "Comunicación" y "Recursos Humanos" que tienen sus salas propias donde todos leen pero solo ellos publican)
    this.code = ROLE_MAP[role]; //El codigo numerico del rol
  }

  /**
   * Obtiene la lista de Roles de los que el usuario puede leer mensajes.
   * @returns {Array}
   */
  getMessageRoles() { 
    return Object.entries(ROLE_MAP) //Object.entries convierte los parametros del objeto en pares clave/valor, en este caso [role, code]
      .filter(([, code]) => this.canReceiveFrom(code))//Realiza un filtro a traves de la función canReveiveFrom (solo es efectivo en A1)
      .map(([role]) => role); //Devuelve un array con los roles, una vez ya filtrados.
  }
}

/* CONSTRUCCIÓN DE CADA UNO DE LOS ROLES */
const ROLES = {
  A1: new Role('A1', code => code > 0, false, true, [ROLE_MAP_INV[ROLE_MAP.C1]], false, false),
  A2: new Role('A2', () => true, false, true, [ROLE_MAP_INV[ROLE_MAP.C1]], false, false),
  C1: new Role(
    'C1',
    () => true,
    false,
    true,
    [
      ROLE_MAP_INV[ROLE_MAP.A1], 
      ROLE_MAP_INV[ROLE_MAP.A2], 
      ROLE_MAP_INV[ROLE_MAP.C1],
    ],
    true,
    false
  ),
  C2: new Role(
    'C2',
    () => true,
    false,
    false,
    [
      ROLE_MAP_INV[ROLE_MAP.A1],
      ROLE_MAP_INV[ROLE_MAP.A2],
      ROLE_MAP_INV[ROLE_MAP.C1],
      ROLE_MAP_INV[ROLE_MAP.C2],
    ],
    true,
    true
  ),
  C3: new Role(
    'C3',
    () => true,
    false,
    true,
    [
      ROLE_MAP_INV[ROLE_MAP.A1],
      ROLE_MAP_INV[ROLE_MAP.A2],
      ROLE_MAP_INV[ROLE_MAP.C1],
      ROLE_MAP_INV[ROLE_MAP.C3],
    ],
    true,
    true
  ),
  S1: new Role(
    'S1',
    () => true,
    false,
    true,
    [
      ROLE_MAP_INV[ROLE_MAP.A1],
      ROLE_MAP_INV[ROLE_MAP.A2],
      ROLE_MAP_INV[ROLE_MAP.C1],
      ROLE_MAP_INV[ROLE_MAP.S1],
      ROLE_MAP_INV[ROLE_MAP.R1],
    ],
    true,
    false
  ),
  R1: new Role(
    'R1',
    () => true,
    true,
    true,
    [
      ROLE_MAP_INV[ROLE_MAP.A1],
      ROLE_MAP_INV[ROLE_MAP.A2],
      ROLE_MAP_INV[ROLE_MAP.C1],
      ROLE_MAP_INV[ROLE_MAP.S1],
      ROLE_MAP_INV[ROLE_MAP.R1],
    ],
    true,
    false
  ),
  Z1: new Role(
    'Z1',
    () => true,
    true,
    false,
    [
      ROLE_MAP_INV[ROLE_MAP.A1],
      ROLE_MAP_INV[ROLE_MAP.A2],
      ROLE_MAP_INV[ROLE_MAP.C1],
      ROLE_MAP_INV[ROLE_MAP.C2],
      ROLE_MAP_INV[ROLE_MAP.C3],
      ROLE_MAP_INV[ROLE_MAP.S1],
      ROLE_MAP_INV[ROLE_MAP.R1],
      ROLE_MAP_INV[ROLE_MAP.Z1],
    ],
    true,
    false
  ),
  Z2: new Role('Z2', () => true, true, true, 'ALL', true, true),
};

/*
const SOCKET_ROOMS = {
  AP: (roomId, platformId) => `ap:${roomId}:${platformId}`, // 'Agentes por plataforma',
  SAP: (roomId, platformId) => `sap:${roomId}:${platformId}`, // 'Súper agentes por plataforma',
  CP: (roomId, platformId) => `cp:${roomId}:${platformId}`, //'Coordinación/controller/formación/rrhh por plataforma',
  TP: (roomId, platformId) => `tp:${roomId}:${platformId}`, //'Todos por plataforma',
  T: roomId => `t:${roomId}:*`, //'Todos'
};
*/
/*
const ROLES_ROOMS_MAP = {
  A1: [SOCKET_ROOMS.AP, SOCKET_ROOMS.TP, SOCKET_ROOMS.T],
  A2: [SOCKET_ROOMS.SAP, SOCKET_ROOMS.TP, SOCKET_ROOMS.T],
  C1: [SOCKET_ROOMS.CP, SOCKET_ROOMS.TP, SOCKET_ROOMS.T],
  C2: [SOCKET_ROOMS.TP, SOCKET_ROOMS.T],
  C3: [SOCKET_ROOMS.TP, SOCKET_ROOMS.T],
  S1: [SOCKET_ROOMS.TP, SOCKET_ROOMS.T],
  R1: [SOCKET_ROOMS.TP, SOCKET_ROOMS.T],
  Z2: [SOCKET_ROOMS.T],
};

const getSocketRoomsByRole = (role, roomId, platformId) => {
  const preparingSocketRooms = ROLES_ROOMS_MAP[role.role];
  const socketRooms = preparingSocketRooms.map(roomCb => roomCb(roomId, platformId));
  return socketRooms;
};
*/

const getRoleByText = roleText => {
  switch (roleText) {
    case 'Agente':
      return 'A1';
    case 'Superagente':
      return 'A2';
    case 'Coordinador/Formador':
      return 'C1';
    case 'Comunicación':
      return 'C2';
    case 'Recursos Humanos':
      return 'C3';
    case 'Responsable':
      return 'R1';
    case 'Supervisor':
      return 'S1';
    case 'Administrador':
      return 'Z1';
  }
};

const getLowerRoles = role => {
  switch (role) {
    case 'C1':
      return ['A1', 'A2'];
    case 'C2':
      return ['A1', 'A2', 'C1'];
    case 'C3':
      return ['A1', 'A2', 'C1', 'C2'];
    case 'S1':
      return ['A1', 'A2', 'C1', 'C2', 'C3'];
    case 'R1':
      return ['A1', 'A2', 'C1', 'C2', 'C3', 'S1'];
    case 'Z1':
      return ['A1', 'A2', 'C1', 'C2', 'C3', 'S1', 'Z1'];
    case 'Z2':
      return ['A1', 'A2', 'C1', 'C2', 'C3', 'S1', 'Z1', 'Z2'];
  }
};

module.exports = {
  ROLES,
  //ROLE_MAP,
  //SOCKET_ROOMS,
  Role,
  //getSocketRoomsByRole,
  getRoleByText,
  getLowerRoles,
};
