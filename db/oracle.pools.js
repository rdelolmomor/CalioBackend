const oracle = require('oracledb');
const config = require('./oracle.config');
const { defaultPool } = require('./oracle.constants');
const { nanoid } = require('nanoid');

const pools = {
  // default: 'default',
  get: nanoid(10),
  update: nanoid(10),
  auth: nanoid(10),
};

(async () => {
  try {
    await Promise.all(Object.values(pools).map(async pool => createPool(pool)));
    console.log('-'.padStart(50, '-'));
    console.log('$ Database pools initialized.');
    console.log('-'.padStart(50, '-'));
  } catch (err) {
    process.exit(1);
  }
})();

async function createPool(poolAlias = 'default') {
  try {
    if (poolAlias === 'default') {
      return await oracle.createPool(defaultPool);
    }
    const { user, password, connectString } = config;
    return await oracle.createPool({
      user,
      password,
      connectString,
      poolAlias,
    });
  } catch (err) {
    console.error(`Error creating pool ${poolAlias}: `, err);
    throw err;
  }
}

module.exports = { pools };
