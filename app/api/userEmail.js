const config = require("../../config");
const dbconnection = require("../dbconnection");
// const mailer = require("../mailer");
const { v4: uuidv4 } = require("uuid");
const user = require("./user");
const logger = require("../logger");

const userEmail = {};

/* send email with hash token to change email address */
userEmail.doChangeEmail = function (userKey) {
  user.getUser(userKey, function (userData) {
    if (userData) {
      let name = (userData.first_name + " " + userData.last_name).trim();
      if (name == "") {
        name = userData.username;
      }
      userEmail.getEmailHashKey(userKey, function (hashKey) {
        let variables = {};
        variables.template = "change_email.html";
        variables.name = name;
        variables.linkUrl =
          config.nodeserver.app_url + "me/change_email/" + hashKey;
        // mailer.setHtml(variables, function (template) {
        //   if (template) {
        //     const email = {
        //       from: config.nodeserver.sparkpost_mail_from,
        //       to:
        //         config.nodeserver.environment == "dev"
        //           ? "test@email.com"
        //           : userData.email,
        //       subject: "DJFAN: change email link",
        //       html: template,
        //     };
        //     mailer.send(email, function (result) {
        //       if (!result) {
        //         logger.log({ level: "error", message: result });
        //       }
        //     });
        //   }
        // });
      });
    }
  });
};

/*  create hash key token for change email  */
userEmail.getEmailHashKey = async function (userKey, callback) {
  let conn;
  hashKey = uuidv4();
  const datetime = new Date().toJSON().slice(0, 19).replace("T", " ");
  try {
    conn = await dbconnection.pool.getConnection();
    const result = await conn.query(
      `INSERT INTO 
          ${config.nodeserver.db_djfan}.tmp_change_requests_email
          (
            user_key,
            created_at,
            hash_key
          )
          VALUES
          (
            '${userKey}',          
            '${datetime}',          
            '${hashKey}'         
          )
        ON DUPLICATE KEY UPDATE     
          created_at='${datetime}',
          hash_key='${hashKey}'`
    );
    if (result) {
      callback(hashKey);
    } else {
      callback(false);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

/* send email confirmation to new adderss */
userEmail.setChangeEmail = function (userKey, params, callback) {
  try {
    userEmail.checkEmailExists(params.email, function (result) {
      if (result) {
        if (result.exists) {
          callback({ result: false, message: "email already exists" });
          return;
        }
        userEmail.checkEmailHashKey(
          userKey,
          params.hash_key,
          params.email,
          function (verifyKey) {
            if (verifyKey) {
              user.getUser(userKey, function (userData) {
                if (userData) {
                  let name = (
                    userData.first_name +
                    " " +
                    userData.last_name
                  ).trim();
                  if (name == "") {
                    name = userData.username;
                  }
                  let variables = {};
                  variables.template = "confirm_email.html";
                  variables.name = name;
                  variables.linkUrl =
                    config.nodeserver.app_url + "me/confirm_email/" + verifyKey;
                  // mailer.setHtml(variables, function (template) {
                  //   if (template) {
                  //     const email = {
                  //       from: config.nodeserver.sparkpost_mail_from,
                  //       to:
                  //         config.nodeserver.environment == "dev"
                  //           ? "test@email.com"
                  //           : params.email,
                  //       subject: "DJFAN: Confirm email",
                  //       html: template,
                  //     };
                  //     mailer.send(email, function (result) {
                  //       if (!result) {
                  //         // errorlog.write(result);
                  //         // console.log(result);
                  //       }
                  //     });
                  //   }
                  // });
                }
              });
              callback({
                result: true,
                message: "email change request accepted",
              });
            } else {
              callback({ result: false, message: "change link expired" });
            }
          }
        );
      } else {
        callback({ result: false, message: "db error try later" });
      }
    });
  } catch (error) {
    logger.log(error);
    callback({ result: false, message: "error" });
  }
};

/* validate user_key, hash_key (token) and time to see if email change is allowed */
userEmail.checkEmailHashKey = async function (
  userKey,
  hashKey,
  email,
  callback
) {
  let conn;
  verifyKey = uuidv4();
  try {
    conn = await dbconnection.pool.getConnection();
    const result = await conn.query(
      `UPDATE 
                ${config.nodeserver.db_djfan}.tmp_change_requests_email  
            SET 
                email=?,
                verify_key=? 
            WHERE         
                user_key=? 
                    AND 
                hash_key=? 
                    AND                     
                TIMESTAMPDIFF(MINUTE,tmp_change_requests_email.created_at,NOW()) < 120`,
      [email, verifyKey, userKey, hashKey]
    );
    if (result.affectedRows > 0) {
      callback(verifyKey);
    } else {
      callback(false);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

/* update both databases email address if change */
userEmail.updateEmail = function (userKey, verifyKey, callback) {
  try {
    userEmail.checkRequest(userKey, verifyKey, function (email) {
      if (email) {
        userEmail.updateEmailDjfanDb(userKey, email, function (result) {
          if (result) {
            userEmail.deleteEmaildHashKey(userKey);
            userEmail.deleteFromSignDb(userKey, function () {});
            callback(true);
          } else {
            callback(false);
          }
        });
      } else {
        callback(false);
      }
    });
  } catch (error) {
    logger.log(error);
    callback(false);
  }
};

userEmail.checkRequest = async function (userKey, verifyKey, callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `SELECT
                email
            FROM 
                ${config.nodeserver.db_djfan}.tmp_change_requests_email  
            WHERE         
                user_key=? 
                    AND 
                verify_key=? 
                    AND                     
                TIMESTAMPDIFF(MINUTE,tmp_change_requests_email.created_at,NOW()) < 1320`,
      [userKey, verifyKey]
    );
    if (rows.length > 0) {
      callback(rows[0].email);
    } else {
      callback(false);
    }
  } catch (err) {
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

userEmail.deleteFromSignDb = async function (userKey, callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const result = await conn.query(
      `DELETE FROM ${config.nodeserver.db_login}.users WHERE id=?`,
      [userKey]
    );
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

userEmail.updateEmailDjfanDb = async function (userKey, email, callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const result = await conn.query(
      `UPDATE ${config.nodeserver.db_djfan}.user SET email=? WHERE user_key=?`,
      [email, userKey]
    );
    if (parseInt(result.affectedRows) > 0) {
      callback(true);
    } else {
      callback(false);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

userEmail.checkEmailExists = async function (email, callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `SELECT user_key FROM ${config.nodeserver.db_djfan}.user WHERE email=?`,
      [email]
    );
    if (rows.length > 0) {
      callback({ result: true, message: "email exists", exists: true });
    } else {
      callback({ result: true, message: "email not found", exists: false });
    }
  } catch (err) {
    callback({ result: false });
  } finally {
    if (conn) conn.end();
  }
};

/* clear hash_key token after succesful update */
userEmail.deleteEmaildHashKey = async function (userKey) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    conn.query(
      `DELETE FROM ${config.nodeserver.db_djfan}.tmp_change_requests_email WHERE user_key='${userKey}'`
    );
  } catch (error) {
    logger.log(error);
  } finally {
    if (conn) conn.end();
  }
};

module.exports = userEmail;
