const oracle = require('oracledb');
const config = require('./oracle.config');

const defaultPool = {
  user: config.user,
  password: config.password,
  connecString: config.connectString,
  poolAlias: 'default',
  poolIncrement: 1,
  poolMax: 150,
  poolMin: 0,
  queueTimeout: 100000,
};

const defaultOptions = {
  select: {
    outFormat: oracle.OUT_FORMAT_OBJECT,
  },
  update: {
    outFormat: oracle.OUT_FORMAT_OBJECT,
    autoCommit: true,
  },
  selectPlus: {
    outFormat: oracle.OUT_FORMAT_OBJECT,
    extendedMetaData: true,
  },
};

const idOutBind = {
  type: oracle.NUMBER,
  dir: oracle.BIND_OUT,
};

const strOutBind = {
  type: oracle.STRING,
  dir: oracle.BIND_OUT,
};

module.exports = { defaultPool, defaultOptions, idOutBind, strOutBind };
