const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const SessionManager = require('./lib/SessionManager');
const sessionMiddleware = require('./lib/session.middleware');

/* Rutas API */
const authRouter = require('./api/auth');
const usersRouter = require('./api/users');
const messagesRouter = require('./api/messages');

/* Puerto y levantamiento del server */
const PORT = 5010;
const httpServer = app.listen(PORT, () => {
  console.log(' CHAT '.padStart(25, '-').padEnd(50, '-'));
  console.log(`$ Server listening on port *:${PORT}`);
});

/* MIDDLEWARES */

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const sessionManager = new SessionManager(); //Creación del objeto de sesión con todos sus metodos
const socketConfig = require('./sockets')(httpServer, sessionManager); //Creación del websocket mediante la libreria socket.io del servidor
socketConfig.init();//Llama a la funcion init del socket recien creado para que esté listo para escuchar los eventos
app.use(sessionMiddleware(sessionManager, socketConfig.io)); //Inserta a modo de middleware los objetos en el objeto request de cada solicitud HTTP del cliente

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/messages', messagesRouter);

module.exports = app;
