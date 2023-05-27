const { hash, createRandomString } = require('./helper');
const { query } = require('../db/oracle.query');
const { pools } = require('../db/oracle.pools');


async function createToken(login, password) {
  const request = {
    password,
    aplicacion: 'chat',
    LOGIN: login,
  };
  let response;
  try {
    //console.log('[createToken] (1) Preparando solicitud de createToken\n', request);
    response = await createToken2(request);
   // console.log('[createToken] (2) Recibida respuesta de createToken\n', response);
    const { tokenID: token, expires: expireTime } = response[1];
    if (token && expireTime) {
      //console.log('[createToken] (3) Respuesta de createToken válida');
      return { token, expireTime };
    }
  } catch (err) {
    // 401: Error creating token, token was not disabled, etc.
    response = err && err.response && err.response.data;
    console.error('[createToken] Error en createToken', { err, response });
    throw err;
  }
}

module.exports.createToken = createToken;

async function createToken2(req) {
  return new Promise((resolve, reject) => {
    let d = new Date();
    /*Se extraen los datos del objeto Req, y se validan*/
    try {
      let userLOGIN =
        typeof req.LOGIN == "string" ? req.LOGIN.trim() : false;
      let userPassword =
        typeof req.password == "string" &&
        req.password.trim().length > 0
          ? hash(req.password.trim())
          : false;
      let tokenID =
        typeof req.userToken == "string" &&
        req.userToken.length === 25
          ? req.userToken
          : false;
      let app =
        typeof req.aplicacion === "string" &&
        req.aplicacion.length > 0
          ? req.aplicacion
          : false;
      let queryString;
      let queryVariables = [];
      if (userPassword) {//Si password contiene valor se trata de un login al uso con validación de contraseña en BBDD
        queryString =
          'SELECT * FROM "V_LOGIN" WHERE LOGIN = :LOGIN AND CONTRASENIA = :CONTRASENIA';
        queryVariables = [userLOGIN, userPassword];
      } else { //Si password NO contiene valor recuperamos sesión de la tabla T_Tokens_Aux validando Login, Token y Fecha
        queryString =
          'select * from "T_TOKENS_AUX" where TOKEN=:TOKEN and LOGIN=:LOGIN AND FECHA_EXPIRACION > :FECHA_EXPIRACION';
        queryVariables = [
          tokenID,
          userLOGIN,
          Date.now() + Math.abs(d.getTimezoneOffset()) * 60 * 1000,
        ];
      }
      if (userLOGIN) {//Se valida si userLogin contiene un valor para lanzar la query
        query(pools.auth, queryString, queryVariables)
          .then((result) => {
            if (tokenID) {//Si tokenID tiene valor se consulta la vista por el campo Login y con el resultado se llama al metodo para actualizar un token de usuario
              queryString =
                'SELECT * FROM "V_LOGIN" WHERE LOGIN = :LOGIN';
              queryVariables = [userLOGIN];
              query(pools.auth, queryString, queryVariables)
                .then((result) => {
                  createUserToken(userLOGIN, result, tokenID, app, d)//Se llama al metodo pasandole el token
                  .then((resultCreateWithToken) => {
                    resolve(resultCreateWithToken);//Se devuelve el resultado de la modificación
                  })
                  .catch((errCreateWithToken) => {
                    console.log(errCreateWithToken);
                    reject(errCreateWithToken);
                  });
                })
                .catch((Err) => {
                  console.log(err);
                  reject([401, "error obtaining user info after tokencheck"]);
                });
            } else {//Si tokenID no tiene valor se llama al metodo para crear un token de usuario
              createUserToken(userLOGIN, result, null, app, d)//Se llama al metodo pandandole null como valor del
              .then((resultCreateWithoutToken) => {
                resolve(resultCreateWithoutToken);//Se devuelve el resultado de la modificación
              })
              .catch((errCreateWithoutToken) => {
                console.log(errCreateWithoutToken);
                reject(errCreateWithoutToken);
              });
            }
          })
          .catch((err) => {
            console.log(err);
            reject([401, { Error: "internal server error" }]);
          });
      } else {//Si el valor de userLogin es falso se devuelve mensaje de error.
        console.log(
          "Error, no se ha facilitado informacion de login o está incompleta"
        );
        reject([401, { Error: "missing required field" }]);
      }
    } catch (err) {
      console.log(err);
      reject([503, "Server internal error"]);
    }
  });
};

/*METODO PARA CREAR O ACTUALIZAR UN TOKEN DE USUARIO */
async function createUserToken(userLOGIN, result, token, app, d) {
  return new Promise((resolve, reject) => {
    if (token) {//Si token tiene valor hay que actualizar el token ya existente
      let expires = Date.now() + Math.abs(d.getTimezoneOffset()) * 60 * 1000 + 1 * 60 * 60 * 1000;
      let responseObject = {
        LOGIN: userLOGIN,
        tokenID: token,
        expires: expires,
        NUM_EMPLEADO: result.rows[0].NUM_EMPLEADO,
        CARGO: result.rows[0].CARGO,
        NAME: result.rows[0].NOMBRE,
        SERVICE: result.rows[0].SERVICIOS,
        PLATFORM: result.rows[0].PLATAFORMA,
        EMAIL: result.rows[0].EMAIL,
        AVATAR: result.rows[0].AVATAR,
        CIUDAD: result.rows[0].CIUDAD,
        PAIS: result.rows[0].PAIS,
      };
      let updateQuery = 'UPDATE "T_TOKENS_AUX" SET "FECHA_EXPIRACION" = :FECHA_EXPIRACION, ESTADO = :ESTADO WHERE "TOKEN" = :TOKEN AND "FECHA_EXPIRACION" > :FECHA_EXPIRACION2';
      let expireDate = Date.now() + Math.abs(d.getTimezoneOffset()) * 60 * 1000 + 1 * 60 * 60 * 100;
      let updateVariables = [expireDate];
        checkApplicationAcccess(userLOGIN, aplicacion)
        .then((result) => {
          if (result) {
            updateVariables.push(token);
            updateVariables.push(Date.now());
            query(pools.update, updateQuery, updateVariables)
              .then((result) => {
                if (result.rowsAffected > 0) {
                  resolve([200, responseObject]);
                } else {
                  reject([401, "No  tokens updated"]);
                }
              })
              .catch((err) => {
                console.log("error actualizando token en la BDD", err);
                reject([401, "Error updating created token"]);
              });
          } else {
            reject([403, "Forbiddensen."]);
          }
        })
        .catch((err) => {
          console.log(err);
        });
    } else if (result.rows[0] != undefined) { //Si Token NO tiene valor pero el resultado de la consulta en V_LOGIN Si
      if (result.rows[0].ESTADO === 1) {//Si el campo estado es 1 el usuario está activo en la empresa.
        let queryString =
          'SELECT * FROM "T_TOKENS_AUX" where LOGIN=:LOGIN AND FECHA_EXPIRACION>:FECHAACTUAL order by FECHA_EXPIRACION desc';
        let queryVariables = [
          userLOGIN,
          Date.now() + Math.abs(d.getTimezoneOffset()) * 60 * 1000,
        ];
        query(pools.auth, queryString, queryVariables)//Se consulta a T_TOKENS_AUX verificando que la sesión no haya expirado
          .then((tokens) => {
            if (tokens.rows[0]) {//Si hay sesión activa
              let tokenID = tokens.rows[0].TOKEN;
              let expires =
                Date.now() +
                Math.abs(d.getTimezoneOffset()) * 60 * 1000 +
                1 * 60 * 60 * 1000;
              let responseObject = {
                LOGIN: userLOGIN,
                tokenID: tokenID,
                expires: expires,
                NUM_EMPLEADO: result.rows[0].NUM_EMPLEADO,
                CARGO: result.rows[0].NOM_CARGO,
                NAME: result.rows[0].NOM_USUARIO,
                SERVICE: result.rows[0].SERVICIOS,
                PLATFORM: result.rows[0].NOM_PLATAFORMA,
                EMAIL: result.rows[0].EMAIL,
                AVATAR: result.rows[0].AVATAR,
                CIUDAD: result.rows[0].NOM_CIUDAD,
                PAIS: result.rows[0].NOM_PAIS,
              };
              let updateQuery = 'UPDATE "T_TOKENS_AUX" SET "FECHA_EXPIRACION" = :FECHA_EXPIRACION, ESTADO = :ESTADO WHERE "TOKEN" = :TOKEN AND "FECHA_EXPIRACION" > :FECHA_EXPIRACION2';
              let expireDate = Date.now() + Math.abs(d.getTimezoneOffset()) * 60 * 1000 + 1 * 60 * 60 * 100;
              let updateVariables = [expireDate];
              updateVariables.push("AUTENTICADO");
              updateVariables.push(responseObject.tokenID);
              updateVariables.push(Date.now());
              query(pools.update, updateQuery, updateVariables)//Se actualiza el token del usuario con estado AUTENTICADO y nueva fecha 
                .then((result) => {
                let queryString =
                  'SELECT R.ROL, R.ID_SALA, S.TIPO from "T_ROLES_USUARIOS" R INNER JOIN "T_SALAS" S on R.ID_SALA=S.ID_SALA and R.LOGIN=:LOGIN';
                let queryVariables = [responseObject.LOGIN];
                query(pools.update, queryString, queryVariables)//Se obtienen las Salas, el tipo de Sala y el Rol del usuario para cada sala
                  .then((result) => {
                    responseObject.salas = [];
                    result.rows.forEach((rol) => {
                      let { ROL, ID_SALA, TIPO } = rol;
                      responseObject.salas.push({//Se añade la lista de salas al objeto respuesta y se devuelve.
                        ROL,
                        ID_SALA,
                        TIPO,
                      });
                    });
                    resolve([200, responseObject]);
                  })
                  .catch((err) => {//Error al obtener las salas
                    console.log("datos salas no obtenidos con sesión activa");
                    console.log(err);
                    resolve([200, responseObject]);
                  });
                })
                .catch((err) => {//Error al actualizar el token en la base de datos
                  console.log("error actualizando token en la BDD", err);
                  reject([401, "Error updating created token"]);
                });
            } else {//Si no hay sesión activa
              let tokenID =
                typeof token == "string" && req.body.token.length === 25
                  ? req.body.token
                  : createRandomString(25);
              let expires =
                Date.now() +
                Math.abs(d.getTimezoneOffset()) * 60 * 1000 +
                1 * 60 * 60 * 1000;
              //console.log("expires: ", expires);
              let responseObject = {
                LOGIN: userLOGIN,
                tokenID: tokenID,
                expires: expires,
                USERNAME: result.rows[0].USUARIO_NT,
                LDAP: result.rows[0].LDAP,
                NUM_EMPLEADO: result.rows[0].NUM_EMPLEADO,
                CARGO: result.rows[0].CARGO,
                NAME: result.rows[0].NOMBRE,
                SERVICE: result.rows[0].SERVICIOS,
                PLATFORM: result.rows[0].PLATAFORMA,
                EMAIL: result.rows[0].EMAIL,
                AVATAR: result.rows[0].AVATAR,
                CONFIG: result.rows[0].CONFIGURACION,
                CIUDAD: result.rows[0].CIUDAD,
                PAIS: result.rows[0].PAIS,
              };

              let updateQuery =
                'UPDATE "T_TOKENS_AUX" SET "FECHA_EXPIRACION" = :FECHA_EXPIRACION WHERE "LOGIN" = :LOGIN AND "FECHA_EXPIRACION" > :FECHA_EXPIRACION2';
              let expireDate = Date.now() + Math.abs(d.getTimezoneOffset()) * 60 * 1000;
              let updateVariables = [expireDate, userLOGIN, expireDate];
              query(pools.update, updateQuery, updateVariables)
                .then((result2) => {
                  let insertBDD = `INSERT INTO "T_TOKENS_AUX" (TOKEN, LOGIN, FECHA_EXPIRACION, ESTADO) values (:TOKEN, :LOGIN, :FECHA_EXPIRACION, :ESTADO)`;
                  let aplicacion = "ACCEDE_CHAT";
                  let insertVariables = [
                    responseObject.tokenID,
                    responseObject.LOGIN,
                    responseObject.expires,
                  ];
                  insertVariables.push("AUTENTICADO");
                  let getSalas = true;
                    checkApplicationAcccess(userLOGIN, aplicacion)
                    .then((result) => {
                      if (result) {
                        query(pools.auth, insertBDD, insertVariables)
                          .then((result) => {
                            if (getSalas) {
                              let queryString =
                                'select R.ROL, R.ID_SALA, S.TIPO from "T_ROLES_USUARIOS" R INNER JOIN "T_SALAS" S on R.ID_SALA=S.ID_SALA and R.LOGIN=:LOGIN';
                              let queryVariables = [responseObject.LOGIN];
                              query(pools.auth, queryString, queryVariables)
                                .then((result) => {
                                  responseObject.salas = [];
                                  result.rows.forEach((rol) => {
                                    let { ROL, ID_SALA, TIPO } = rol;
                                    responseObject.salas.push({
                                      ROL,
                                      ID_SALA,
                                      TIPO,
                                    });
                                  });
                                  resolve([200, responseObject]);
                                })
                                .catch((err) => {
                                  console.log("datos salas no obtenidos sin sesión activa");
                                  console.log(err);
                                  resolve([200, responseObject]);
                                });
                            } else {
                              resolve([200, responseObject]);
                            }
                          })
                          .catch((err) => {
                            console.log(
                              "error insertando token en la BDD",
                              err
                            );
                            reject([401, "Error creating token"]);
                          });
                      } else {
                        reject([403, "Forbiddensen."]);
                      }
                    })
                    .catch((err) => {
                      console.log(err);
                    });
                })
                .catch((err) => {
                  console.log(err)
                  reject([401, "Token was not disabled."]);
                });
            }
          })
          .catch((err) => {
            console.log(err);
            reject([401, "Error en la query"]);
          });
      } else {//Si el campo ESTADO es 0, el usuario ha sido dado de baja de la empresa
        console.log("error, usuario deshabilitado");
        console.log(result);
        reject([401, "user disabled"]);
      }
    } else {//Si Token no tiene valor y el resultado de la consulta en V_LOGIN tampoco, no se ha encontrado al usuario
      console.log(result);
      reject([401, "Usuario no encontrado"]);
    }
  });
};

//TODO: Revisar APP
checkApplicationAcccess = (LOGIN, APP) => {
  return new Promise((resolve, reject) => {
    let queryString =
      'select * from "T_CONFIGURACION" where LOGIN=:LOGIN';
    let queryVariables = [LOGIN];
    query(pools.auth, queryString, queryVariables)
      .then((result) => {
        if (result.rows[0] && result.rows[0][APP] === "SI") {
          resolve(true);
        }
        resolve(false);
      })
      .catch((err) => {
        console.log(APP)
        console.log("error consultando permisos");
        console.log(err);
        reject(false);
      });
  });
};