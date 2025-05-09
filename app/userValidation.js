const config = require("../config");
const dbconnection = require("./dbconnection");
const NodeCache = require("node-cache");
const serverCache = new NodeCache({ stdTTL: 500, checkperiod: 600 });
const logger = require("./logger");

const userValidation = {};
userValidation.check = function (token = "", callback) {
  if (token=="") {
    callback(false);
    return;
  }  
  try {
    let userObj = serverCache.get(token);
    if (userObj != undefined) {
      callback(userObj);
    }
    userObj = checkSessionTokenDb(token, function (userObj) {
      if (!userObj) {
        callback(false);
      } else {
        serverCache.set(token, userObj);
        callback(userObj);
      }
    });
  } catch(error) {
    logger.log(error);
    callback(false);
  }
}

async function checkSessionTokenDb(token = "", callback) { 
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(`SELECT user_id, expires, id FROM ${config.nodeserver.db_login}.sessions WHERE session_token=? LIMIT 1`,[token]);
    if (rows.length == 0) { 
      callback(false);
    } else {
      await conn.query(`UPDATE ${config.nodeserver.db_djfan}.user SET last_login=? WHERE user_key=?`,[new Date().toJSON().slice(0, -1).replace('T',' '),rows[0]['user_id']]);    
      callback(rows[0]);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
}

module.exports = userValidation;