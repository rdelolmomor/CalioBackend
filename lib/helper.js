const crypto = require('crypto');
const hashingSecret = 'thisIsASecretStringForASecretPasswordUsedForANewChat';
const possibleCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function createRandomString(strLength) {
  strLength = typeof strLength == 'number' && strLength > 0 ? strLength : false;
  if (strLength) {
    let str = '',
      i = 0;
    for (i; i < strLength; i++) {
      const randomPos = Math.floor(Math.random() * possibleCharacters.length);
      let randomCharacter = possibleCharacters.charAt(randomPos);
      str += randomCharacter;
    }
    return str;
  } else {
    return helpers.createRandomString(20);
  }
}

function hash(str) {
  if (typeof str == 'string' && str.length > 0) {
    let hash = crypto.createHmac('sha256', hashingSecret).update(str).digest('hex');
    return hash;
  } else {
    return false;
  }
}

//Obtiene el tiempo actual
function getOffsetNow() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60 * 1000;
  return today.getTime() - offset;
}

function getTodayDate() {
  const today = new Date();
  return today.toISOString();
}

/**
 * Convertidor de horas a milisegundos
 * @param {number} hours
 */
function getMillisFromHours(hours = 4) {
  return hours * 60 * 60 * 1000;
}

/**
 * Suma las horas indicadas al tiempo actual en milisegundos
 * @param {number} hours
 */
function getOffsetNowUpdated(hours = 4) {
  return getOffsetNow() + getMillisFromHours(hours);
}

/**
 * Resta las horas indicadas al tiempo actual en milisegundos
 * @param {number} hours
 */
function getTimeFromSomeHoursAgo(hours = 72) {
  return new Date(getOffsetNow() - getMillisFromHours(hours)).toISOString();
}

/**
 * Comprueba el tipo, y opcionalmente si el valor es falsy, de un parámetro cualquiera.
 * @param {any} param El parámetro a comprobar
 * @param {string} type El tipo que se supone que debe tener
 * @param {string} name El nombre del parámetro (para mostrar información más concreta en el error)
 * @param {boolean} canBeFalsy Indica si el parámetro puede o no tener un valor falsy `(false por defecto)`
 * @returns {boolean}
 */
function checkParam(param, type, name, canBeFalsy = false) {
  let isCorrectTyped = false;
  switch (type) {
    case 'function':
      isCorrectTyped = param instanceof Function;
      break;
    case 'array':
      isCorrectTyped = Array.isArray(param);
      break;
    default:
      isCorrectTyped = typeof param === type;
      break;
  }
  if (!canBeFalsy && !param) {
    throw new Error(`param ${name} must not be falsy`);
  }
  if (!isCorrectTyped) {
    throw new TypeError(`param ${name} must be a ${type}`);
  }
}

function getOtherLoginFromPrivateRoomName(roomName, userLogin) {
  return roomName.replace(userLogin, '').replace(':', '');
}

function prepareMessageCreation(messageData) {
  const message = { ...messageData };
  message.receiver = messageData.receiver || '';
  message.labels = messageData.labels || '';
  message.previousId = messageData.previousId || null;
  delete message.avatar;
  delete message.private;
  return message;
}

module.exports = {
  createRandomString,
  hash,
  getOffsetNow,
  getMillisFromHours,
  getOffsetNowUpdated,
  getTimeFromSomeHoursAgo,
  getTodayDate,
  checkParam,
  getOtherLoginFromPrivateRoomName,
  prepareMessageCreation,
};
