const {
  getActiveSession,
  updateSessionStatus,
  linkSocketToSession,
  unlinkSocketFromSession,
  loginUser,
  refreshSession,
  getProfile,
  updateUserAvatar,
} = require('../db/auth');
const { getOffsetNow, getOffsetNowUpdated } = require('./helper');
const { ROLES } = require('./Role');

/* OBJETO DE SESIÓN EL CUAL ALMACENARÁ LA INFORMACIÓN DE LOS USUARIOS EN UN OBJETO MAP */
/* Map nos ofrece metodos como get() para añadir elementos o como set() para obtener elementos */
class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Comprueba si una sesión es válida.
   * @param {object} session { token, login, expireTime, state, socketId }
   * @param {string} token Identificador de la sesión
   * @returns {object} `{ isExact: boolean, isExpired: boolean }`
   */
  isSessionValid(session, token) {
    return {
      isExact: session.token === token,
      isExpired: session.expireTime <= getOffsetNow(),
    };
  }

  /**
   * Intenta un logado y devuelve la sesión y el perfil **tras haber comprobado las credenciales y el acceso**
   * @param {string} login
   * @returns {Promise<{session: object, profile: object}>}
   */
  async login(login, password) {
    try {
      const loginData = await loginUser(login, password);
      console.log('LoginData: ',loginData)
      if (!loginData) {
        throw new Error(
          'Error intentando el logado de un usuario: no se pudo generar/reutilizar sesión.'
        );
      }
      this.sessions.set(login, { ...loginData.session, ...loginData.profile });
      return loginData;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Obtiene la sesión activa y la refresca en caché y en BDD. Si no es válida la cierra
   * @param {string} login
   * @param {string} token
   * @returns {Promise<{token: string, login: string, expireTime: number, state: 'AUTENTICADO' | 'ACTIVO', socketId?: string }>}
   */
  async getSession(login, token) {
    try {
      let activeSession;
      if (!this.sessions.has(login)) {//Si NO ha obtenido ninguna sesión con este login
        activeSession = await getActiveSession(login, token);
        if (activeSession) {
          const profile = await getProfile(login);
          activeSession = { ...activeSession, ...profile };
          this.sessions.set(login, activeSession);
        }
      } else {// Si hay sesion con el login indicado
        activeSession = this.sessions.get(login);
        const { isExpired, isExact } = this.isSessionValid(activeSession, token);
        if (!isExact) {
          console.warn(
            '[SESSION MANAGER] (getSession) Intento fraudulento: token KO. LOGIN:',
            login
          );
          throw new Error('El token facilitado y el de la sesión no coinciden.');
        } else if (isExpired) {
          await updateSessionStatus(login, token, 'CADUCADO');
          this.sessions.delete(login);
          activeSession = undefined;
        }
      }
      if (activeSession) {
        const isSessionRefreshed = await refreshSession(login, token);
        if (isSessionRefreshed) {
          activeSession.expireTime = getOffsetNowUpdated();
        }
        this.sessions.set(login, activeSession);
      }
      return activeSession;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Enlaza el socket a una sesión activa en BDD y en caché si procede.
   * @param {string} login
   * @param {string} token
   * @param {Socket} socket
   * @returns {Promise<boolean>}
   */
  async linkSocket(login, token, socket) {
    try {
      const activeSession = await this.getSession(login, token);
      //console.log('Sesión obtenida')
      if (!activeSession) {
        throw new Error(`Recibido intento de enlace de socket y no existe sesión para ${login}`);
      }
      const isSessionLinked = await linkSocketToSession(login, token, socket.id);
      if (isSessionLinked) {
        activeSession.state = 'ACTIVO';
        activeSession.socketId = socket.id;
        this.sessions.set(login, activeSession);
        socket.session = activeSession;
      }
      return isSessionLinked;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Desvincula el socket de una sesión activa en BDD y en caché si procede.
   * @param {string} login
   * @param {string} token
   * @param {Socket} socket
   * @returns {Promise<boolean>}
   */
  async unlinkSocket(login, token) {
    try {
      const activeSession = await this.getSession(login, token);
      if (!activeSession) {
        return false;
      }
      const isSessionUnlinked = await unlinkSocketFromSession(login, token);
      if (isSessionUnlinked) {
        activeSession.state = 'AUTENTICADO';
        activeSession.socketId = undefined;
        this.sessions.set(login, activeSession);
      }
      return isSessionUnlinked;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Intenta cerrar una sesión *típicamente en un logout o intento fraudulento*
   * @param {string} login
   * @param {string} token
   * @returns {boolean} Indicador de si se ha cerrado o no la sesión.
   */
  async closeSession(login, token) {
    try {
      const activeSession = await this.getSession(login, token);
      // console.log('[SESSION MANAGER] closeSession => activeSession:\n', activeSession);
      if (!activeSession) {
        console.error('[SESSION MANAGER] (closeSession) no hay sesión activa para', login);
        return false;
      }
      this.sessions.delete(login);
      return await updateSessionStatus(login, token);
    } catch (err) {
      throw err;
    }
  }

  async updateAvatar(login, token, avatar) {
    try {
      const session = await this.getSession(login, token);
      if (!session) {
        return { error: 'Sesión inválida' };
      }
      const newAvatar = JSON.stringify(avatar);
      const isAvatarUpdated = await updateUserAvatar(login, newAvatar);
      if (isAvatarUpdated) {
        session.avatar = avatar;
        this.sessions.set(login, session);
        return avatar;
      }
      return isAvatarUpdated;
    } catch (err) {
      throw err;
    }
  }

  joinUsersPrivateRoom(logins, room) {
    logins.forEach(login => {
      const session = this.sessions.get(login);
      if (session) {
        session.rooms.push(room);
        this.sessions.set(login, session);
      }
    });
  }

  /**
   * Se actualiza el rol de un usuario en una sala indicada
   *
   * @param {*} login Usuario
   * @param {*} roomId Id de sala
   * @param {*} role Nuevo rol
   * @param {*} room Parametro opcional en caso de querer añadir al usuario a una nueva sala
   */
  updateUserRole(login, roomId, role, room) {
    //Se obtiene la sesión
    const session = this.sessions.get(login);
    if (!session) return false;
    //Se comprueba si el usuario tiene acceso a la sala indicada
    const roomIndex = session.rooms.findIndex(room => room.roomId === roomId);
    //Si se trata de una actualización del rol y no se ha encontrado la sala en la sesión del usuario, retorna false
    if (roomIndex < 0 && !room) return false;
    //Si se trata de añadir al usuario a una sala nueva, se añade al array de salas
    if (roomIndex < 0) session.rooms.push({ ...room, roomId, role: ROLES[role] });
    //Si se ha encontrado le id de sala en la sesión se actualiza el rol en la sesion y se actualiza el sessionManager
    else session.rooms[roomIndex].role = ROLES[role];
    this.sessions.set(login, session);
    return true;
  }

  removeUserRoom(login, roomId) {
    const session = this.sessions.get(login);
    if (!session) return false;
    const roomIndex = session.rooms.findINdex(room => room.roomId === roomId);
    if (roomIndex < 0) return false;
    session.rooms.splice(roomIndex, 1);
    this.sessions.set(login, session);
  }
}

module.exports = SessionManager;
