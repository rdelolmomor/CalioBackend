const PLATFORMS = [
{id: 1, name: 'JAZZPLAT'},
{id: 41, name: 'TELEPERFORMANCE'},
{id: 42, name: 'ARVATO'},
{id: 43, name: 'LA FINCA'},
{id: 61, name: 'OEST'},
{id: 81, name: 'TELEPERFORMANCE'},
{id: 82, name: 'JAZZPLAT'}];

const SOCKET_ROOMS = {
  A1: (roomId, platformId) => `a1:${roomId}:${platformId}`, // 'Agentes por plataforma',
  A2: (roomId, platformId) => `a2:${roomId}:${platformId}`, // 'Súper agentes por plataforma',
  C1: (roomId, platformId) => `c1:${roomId}:${platformId}`, // 'Coordinación/controller/formación/rrhh por plataforma',
  COM: (roomId, platformId) => `com:${roomId}:${platformId}`, // 'Comunicación inter/plataforma',
  S1: (roomId, platformId) => `s1:${roomId}:${platformId}`, // 'Supervisión',
  R1: (roomId, platformId) => `r1:${roomId}:${platformId}`, // 'Responsables/Negocio por plataforma',
  Z1: (roomId, platformId) => `z1:${roomId}:${platformId}`, // 'Full administradores',
  Z2: (roomId, platformId) => `z2:${roomId}:${platformId}`, // 'Full administradores',
  TP: (roomId, platformId) => `tp:${roomId}:${platformId}`, // 'Todos por plataforma',
  T: roomId => PLATFORMS.map(({ id }) => `tp:${roomId}:${id}`), // Array
};
module.exports.SOCKET_ROOMS = SOCKET_ROOMS;

/**
 * Devuelve una lista de salas a las que se va a conectar un usuario (socket) en función del rol, sala y plataforma:
 * @param {string} role
 * @param {number} roomId
 * @param {number} platformId
 * @returns {Array<string>}
 */
function getInSocketRooms(role, roomId, platformId, private) {
  switch (role) {
    case 'A1':
      return [SOCKET_ROOMS.A1(roomId, platformId), SOCKET_ROOMS.TP(roomId, platformId)];
    case 'A2':
      if (private) {
        return [`a2:${roomId}`];
      }
      return [SOCKET_ROOMS.A2(roomId, platformId), SOCKET_ROOMS.TP(roomId, platformId)];
    case 'C1':
      return [SOCKET_ROOMS.C1(roomId, platformId), SOCKET_ROOMS.TP(roomId, platformId)];
    case 'C3':
    case 'C2':
      return [SOCKET_ROOMS.COM(roomId, platformId), SOCKET_ROOMS.TP(roomId, platformId)];
    case 'S1':
      return [SOCKET_ROOMS.S1(roomId, platformId), SOCKET_ROOMS.TP(roomId, platformId)];
    case 'R1':
      return [SOCKET_ROOMS.R1(roomId, platformId), ...SOCKET_ROOMS.T(roomId, platformId)];
    case 'Z1':
      return [SOCKET_ROOMS.Z1(roomId, platformId), ...SOCKET_ROOMS.T(roomId)];
    case 'Z2':
      return [SOCKET_ROOMS.Z2(roomId, platformId), ...SOCKET_ROOMS.T(roomId)];
    default:
      return;
  }
}
module.exports.getInSocketRooms = getInSocketRooms;

/**
 * Devuelve una lista de salas a las que se va a notificar la des/conexión en función del rol, sala y plataforma:
 * @param {string} role
 * @param {number} roomId
 * @param {number} platformId
 * @returns {Array<string>}
 */
function getConnectionSocketRooms(role, roomId, platformId, private) {
  if (private) {
    return { in: [], out: [] };
  }
  switch (role) {
    case 'A1':
    case 'A2':
      return {
        in: [SOCKET_ROOMS.TP(roomId, platformId)],
        out: [SOCKET_ROOMS.A1(roomId, platformId), SOCKET_ROOMS.A2(roomId, platformId)],
      };
    case 'C1':
      return { in: [SOCKET_ROOMS.TP(roomId, platformId)], out: [] };
    case 'C3':
    case 'C2':
      return {
        in: [SOCKET_ROOMS.COM(roomId, platformId), SOCKET_ROOMS.S1(roomId, platformId)],
        out: [],
      };
    case 'S1':
      return {
        in: [SOCKET_ROOMS.TP(roomId, platformId)],
        out: [SOCKET_ROOMS.A1(roomId, platformId), SOCKET_ROOMS.A2(roomId, platformId)],
      };
    case 'R1':
      return {
        in: [SOCKET_ROOMS.R1(roomId, platformId), SOCKET_ROOMS.Z2(roomId, platformId)],
        out: [],
      };
    case 'Z1':
      return {
        in: [SOCKET_ROOMS.Z1(roomId, platformId), SOCKET_ROOMS.Z2(roomId, platformId)],
        out: [],
      };
    case 'Z2':
      return {
        in: [SOCKET_ROOMS.Z2(roomId, platformId)],
        out: [],
      };
    default:
      return { in: [], out: [] };
  }
}
module.exports.getConnectionSocketRooms = getConnectionSocketRooms;

/**
 * Devuelve una lista de salas a las que se va a enviar un mensaje en función del rol, sala y plataforma:
 * @param {string} role
 * @param {number} roomId
 * @param {number} platformId
 * @returns {Array<string>}
 */
function getMessageSocketRooms(
  role,
  roomId,
  platformId,
  private = false,
  previousRole = false,
  previousLOGIN = false
) {
  if (private) return { in: [`a2:${roomId}`], out: [] };
  const interplatform = ['R1', 'Z2'].includes(role);
  // previousRole y PreviousLOGIN sólo tienen valor en respuestas.
  if (previousRole === 'A1') {
    // Aquí entra cuando quien recibe una respuesta es un usuario con rol A1
    return getMentionSocketRooms(roomId, platformId, previousLOGIN);
  } else if (previousRole) {
    // Respuesta a un rol diferente de A1
    return {
      in: interplatform ? SOCKET_ROOMS.T(roomId) : [SOCKET_ROOMS.TP(roomId, platformId)],
      out: [SOCKET_ROOMS.A1(roomId, platformId)],
    };
  }
  return {
    in: interplatform ? SOCKET_ROOMS.T(roomId) : [SOCKET_ROOMS.TP(roomId, platformId)],
    out: role === 'A1' ? [SOCKET_ROOMS.A1(roomId, platformId)] : [],
  };
}
module.exports.getMessageSocketRooms = getMessageSocketRooms;

/**
 * Devuelve una lista de salas a las que se va a enviar un mensaje en función del rol, sala y plataforma:
 * @param {string} role
 * @param {number} roomId
 * @param {number} platformId
 * @returns {Array<string>}
 */
function getMentionSocketRooms(roomId, platformId, receiver) {
  return {
    in: [
      SOCKET_ROOMS.A2(roomId, platformId),
      SOCKET_ROOMS.C1(roomId, platformId),
      SOCKET_ROOMS.COM(roomId, platformId),
      SOCKET_ROOMS.S1(roomId, platformId),
      SOCKET_ROOMS.R1(roomId, platformId),
      SOCKET_ROOMS.Z1(roomId, platformId),
      SOCKET_ROOMS.Z2(roomId, platformId),
      receiver,
    ],
    out: [],
  };
}

module.exports.getMentionSocketRooms = getMentionSocketRooms;
