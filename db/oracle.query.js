const oracle = require('oracledb');
const { defaultOptions } = require('./oracle.constants');

function closeConnection(connection) {
  if (connection && connection.close) {
    connection.close();
  }
}

function getQueryType(query) {
  return query.toLowerCase().startsWith('select') ? 'select' : 'update';
}

async function multiQuery(pool = 'default', queries, params, options) {
  // console.log('MultiQuery:\n ', { queries, params });
  try {
    if (!Array.isArray(queries) || queries.length === 0) {
      throw new TypeError('queries must be a non empty array');
    }
    if (!Array.isArray(params) || params.length === 0) {
      throw new TypeError('params must be a non empty array');
    }
    if (queries.length !== params.length) {
      throw new TypeError('queries & params must have the same number of elements');
    }
    var connection = await oracle.getConnection(pool);
    return await Promise.all(
      queries.map((query, index) => {
        const queryType = getQueryType(query);
        const param = params[index];
        const option = options && options[index] ? options[index] : defaultOptions[queryType];
        return connection.execute(query, param, option);
      })
    );
  } catch (err) {
    console.log('Error executing multi query:', err);
    throw err;
  } finally {
    closeConnection(connection);
  }
}

module.exports.multiQuery = multiQuery;

async function query(pool = 'default', query, params = {}, options) {
  try {
    // console.log('[QUERY]:\n ', { query, params });
    if (!query || typeof query !== 'string') {
      throw new TypeError('query must be a non empty string');
    }
    if (typeof params !== 'object') {
      throw new TypeError('params must be an object');
    }
    const queryType = getQueryType(query);

    return await launchQuery(pool, query, params, queryType, options);
  } catch (err) {
    console.error('Error initializing query:', err);
    throw err;
  }
}
module.exports.query = query;

async function launchQuery(pool, query, params, queryType, options = defaultOptions[queryType]) {
  try {
    var connection = await oracle.getConnection(pool);
    return await connection.execute(query, params, options);
  } catch (err) {
    console.error('Error executing single query:', err);
    throw err;
  } finally {
    closeConnection(connection);
  }
}

async function prepareQuery(pool = 'default', isSelect = true) {
  try {
    const connection = await oracle.getConnection(pool);
    const options = defaultOptions[isSelect ? 'select' : 'update'];
    return { connection, options };
  } catch (err) {
    console.error('Error preparing query:', err);
  }
}

module.exports.prepareQuery = prepareQuery;
