const express = require('express');
/**
 * Objeto de Express que realiza las funciones de logado, deslogado, actualización del avatar y obrtención de la sesión
 */
const authRouter = express.Router();
const { checkCredentials } = require('../db/auth');
const { hash } = require('../lib/helper');

/**
 * POST para realizar el logado, llama al metodo "login"
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password || typeof login !== 'string' || typeof password !== 'string') {
      return res.status(422).send({ error: 'Faltan credenciales de acceso.' });
    }
    const hashedPassword = hash(password);
    const credentialsCheck = await checkCredentials(login, hashedPassword);
    if (credentialsCheck && credentialsCheck.error) {
      return res.status(401).send({ error: credentialsCheck.error });
    }
    const loginData = await req.sessionManager.login(login, password);
    res.status(200).send(loginData);
  } catch (err) {
    console.error('Error in /login:', err);
    res.status(500).send({ error: err.toString() });
  }
});

/**
 * POST para realizar el deslogado, llama al metodo "closeSession"
 */
authRouter.post('/logout', async (req, res) => {
  try {
    const { login, token } = req.body;
    if (!login || !token || typeof login !== 'string' || typeof token !== 'string') {
      return res.status(422).send({ error: 'Faltan datos de sesión.' });
    }
    const isSessionClosed = await req.sessionManager.closeSession(login, token);
    res.status(200).send(isSessionClosed);
    console.log("Sesion Closed: ",isSessionClosed)
  } catch (err) {
    console.error('Error in /logout:', err);
    res.status(500).send(err);
  }
});

/**
 * POST para actualizar el avatar, llama al metodo "updateAvatar"
 */
authRouter.post('/updateAvatar', async (req, res) => {
  try {
    const { login, token, avatar = 'Default' } = req.body;
    if (!login || !token || typeof login !== 'string' || typeof token !== 'string') {
      return res.status(422).send({ error: 'Faltan datos de sesión.' });
    }
    const avatarUpdate = await req.sessionManager.updateAvatar(login, token, avatar);
    console.log('Avatar update: ', avatarUpdate);
    if (avatarUpdate.error) {
      return res.status(401).send(avatarUpdate);
    }
    res.status(200).send(avatarUpdate);
  } catch (err) {
    console.error('Error in /updateAvatar:', err);
    res.status(500).send(err);
  }
});

module.exports = authRouter;
