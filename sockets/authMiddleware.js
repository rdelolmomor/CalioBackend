const TAG = '[SOCKET MIDDLEWARE]';

//Se inyecta el socket en el objeto sessionManager, de esta forma estará disponible durante toda la vida del objeto
function authMiddleware(sessionManager) {
  return async (socket, next) => {
    const { login, token } = socket.handshake.auth;
    console.log(`${TAG} Inicializando conexión del socket: ${socket.handshake.auth.login}`);
    try {
      if (!login || !token || typeof login !== 'string' || typeof token !== 'string') {
        console.warn(`${TAG} Recibida conexión sin credenciales. Rechazamos.`);
        throw new Error('Faltan credenciales de autenticación.');
      }
      const isSessionLinked = await sessionManager.linkSocket(login, token, socket);
      if (!isSessionLinked) {
        console.warn(`${TAG} No se enlazó la sesión con el socket.`);
        throw new Error('La conexión no ha podido realizarse.');
      }
      console.log(`${TAG} Intento de conexión correcto. Permitimos.`);
      next();
    } catch (err) {
      next(new Error(err.toString()));
    }
  };
}

module.exports = authMiddleware;
