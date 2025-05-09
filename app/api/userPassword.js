const config = require("../../config");
const dbconnection = require("../dbconnection");
// const mailer = require("../mailer");
const { v4: uuidv4 } = require("uuid");
const user = require("./user");
const logger = require("../logger");

const userPassword = {};

/* send email with token */
userPassword.doPasswordReset = function (userKey) {
  try {
    user.getUser(userKey, function (userData) {
      if (userData) {
        let name = (userData.first_name + " " + userData.last_name).trim();
        if (name == "") {
          name = userData.username;
        }
        userPassword.getPasswordHashKey(userKey, function (hashKey) {
          let variables = {};
          variables.template = "reset_password.html";
          variables.name = name;
          variables.linkUrl =
            config.nodeserver.app_url + "me/reset_password/" + hashKey;
          // mailer.setHtml(variables, function (template) {
          //   if (template) {
          //     const email = {
          //       from: config.nodeserver.sparkpost_mail_from,
          //       to:
          //         config.nodeserver.environment == "dev"
          //           ? "test@email.com"
          //           : userData.email,
          //       subject: "DJFAN: password reset link",
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
  } catch (error) {
    logger.log(error);
  }
};

/* check user and reset token */
userPassword.setPassword = function (userKey, params, callback) {
  try {
    userPassword.checkPasswordHashKey(
      userKey,
      params.hash_key,
      function (result) {
        if (result) {
          userPassword.setPasswordApi(
            userKey,
            params.password,
            function (result) {
              if (result.result) {
                callback({ result: true, message: "password updated" });
                userPassword.deletePasswordHashKey(userKey);
              } else {
                callback({
                  result: false,
                  message: "update failed",
                  error: result.message,
                });
              }
            }
          );
        } else {
          callback({ result: false, message: "rest link expired" });
        }
      }
    );
  } catch (error) {
    logger.log(error);
  }
};

/* update password via api backend */
userPassword.setPasswordApi = async function (userKey, password, callback) {
  try {
    const user = {};
    user.user_key = userKey;
    user.password = password;
    const res = await fetch(config.nodeserver.api_backend + "password", {
      method: "POST",
      body: JSON.stringify(user),
      headers: { "Content-Type": "application/json" },
    });
    const responseData = await res.json();
    callback(responseData);
  } catch (error) {
    logger.log(error);
    callback(false);
  }
};

/*  create hash key token for update password  */
userPassword.getPasswordHashKey = async function (userKey, callback) {
  let conn;
  hashKey = uuidv4();
  const datetime = new Date().toJSON().slice(0, 19).replace("T", " ");
  try {
    conn = await dbconnection.pool.getConnection();
    const result = await conn.query(
      `INSERT INTO 
          ${config.nodeserver.db_djfan}.tmp_change_requests_password
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

/* clear hash_key token after succesful update */
userPassword.deletePasswordHashKey = async function (userKey) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    conn.query(
      `DELETE FROM ${config.nodeserver.db_djfan}.tmp_change_requests_password WHERE user_key='${userKey}'`
    );
  } catch (error) {
    logger.log(error);
  } finally {
    if (conn) conn.end();
  }
};

/* validate user_key, hash_key (token) and time to see if password change is allowed */
userPassword.checkPasswordHashKey = async function (
  userKey,
  hashKey,
  callback
) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `SELECT 
            user_key 
        FROM 
          ${config.nodeserver.db_djfan}.tmp_change_requests_password 
        WHERE 
          user_key=? 
            AND 
          hash_key=? 
            AND 
          TIMESTAMPDIFF(MINUTE,tmp_change_requests_password.created_at,NOW()) < 160`,
      [userKey, hashKey]
    );
    if (rows.length > 0) {
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

module.exports = userPassword;
