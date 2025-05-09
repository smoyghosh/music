const { Pool } = require("pg");
const NodeCache = require("node-cache");
const crypto = require("crypto");

const log4js = require("log4js");

const queryCache = new NodeCache();
const logger = log4js.getLogger("db_helper");
logger.level = "info";

let rejectUnauthorized = false;
if (process.env.NODE_ENV === "development") {
  rejectUnauthorized = false;
}

// more options: https://node-postgres.com/api/client
const timeout = process.env.DB_TIMEOUT || 1000 * 10;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  statement_timeout: timeout,
  query_timeout: timeout,
  connectionTimeoutMillis: timeout,
  ssl: {
    rejectUnauthorized,
  },
});

/**
 *
 * @param {stirng} theQuery
 * @param {[]]} bindings
 * @param {boolean} withCache true to cache the result
 * @return {Promise<*>}
 */
module.exports.query = async function (
  theQuery,
  bindings = [],
  withCache = false
) {
  if (withCache) {
    logger.info(`executing query with cache ${theQuery}`);
    const stringToHash = `${theQuery}${JSON.stringify(bindings)}`;
    logger.info(`string to hash: ${stringToHash}`);
    const hash = crypto.createHash("sha256").update(stringToHash).digest("hex");
    logger.info(`hash: ${hash}`);
    const value = queryCache.get(hash);
    if (value === undefined) {
      try {
        logger.info("no cache for this query, let go to the DB");
        const queryResult = await pool.query(theQuery, bindings);
        queryCache.set(hash, queryResult);
        logger.info(`cache set for ${hash}`);
        return queryResult;
      } catch (error) {
        throw new Error(
          `Error executing query with cache ${theQuery} error: ${error}`
        );
      }
    } else {
      logger.info(`returning query result from cache ${theQuery}`);
      log.info(queryCache.getStats());
      return value;
    }
  } else {
    try {
      logger.info(`executing query without cache ${theQuery}`);
      const result = await pool.query(theQuery, bindings);

      // delete all the cache content if we are inserting or updating data
      const auxQuery = theQuery.trim().toLowerCase();
      if (
        auxQuery.startsWith("insert") ||
        auxQuery.startsWith("update") ||
        auxQuery.startsWith("delete")
      ) {
        queryCache.flushAll();
        queryCache.flushStats();
        logger.info(`the cache was flushed because of the query ${theQuery}`);
      }
      return result;
    } catch (error) {
      throw new Error(
        `Error executing query without cache  ${theQuery} error: ${error}`
      );
    }
  }
};

module.exports.execute = pool;
