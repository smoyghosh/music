const config = require("../../config");
const dbconnection = require("../dbconnection");
const NodeCache = require("node-cache");
const serverCache = new NodeCache({ stdTTL: 500, checkperiod: 600 });
const sequelizeUserModal = require("../models/user");
// const mailer = require("../mailer");
const { v4: uuidv4 } = require("uuid");
const logger = require("../logger");

const user = {};

user.get = async function (user_key = "", callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `SELECT 
        id AS user_id,
        user_key,
        roles, 
        first_name, 
        last_name, 
        display_name,
        username,
        email,
        avatar 
      FROM 
        ${config.nodeserver.db_djfan}.user
      WHERE
        user_key=? 
      LIMIT 
        1`,
      [user_key]
    );
    if (rows.length == 0) {
      callback(false);
    } else {
      if (rows[0].roles.indexOf("ADMIN") > -1) {
        rows[0].admin = true;
      }
      if (rows[0].roles.indexOf("PARTNER") > -1) {
        rows[0].partner = true;
      }
      if (rows[0].roles.indexOf("DJ") > -1) {
        rows[0].dj = true;
      }
      if (rows[0].avatar != null && rows[0].avatar != "") {
        if (rows[0].avatar.indexOf("://") == -1) {
          // rows[0].avatar = config.nodeserver.r2_s3_avatar + rows[0].avatar;
          rows[0].avatar = config.nodeserver.r2_s3_domain + rows[0].avatar;
        }
      }
      serverCache.set(user_key, rows[0]);
      callback(rows);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

user.getUser = function (user_key = "", callback) {
  let userData = serverCache.get(user_key);
  if (userData) {
    callback(userData);
  } else {
    user.get(user_key, function (result) {
      if (!result) {
        callback(false);
      } else {
        callback(result[0]);
      }
    });
  }
};

user.getCheck = async function (filter = {}, callback) {
  let conn;
  try {
    let values = [];
    let strWhere = "1=1";
    let filterOn = false;
    for (const [key, value] of Object.entries(filter)) {
      if (value.length > 0) {
        strWhere += " AND " + key + "=? ";
        values.push(value);
        filterOn = true;
      }
    }
    if (!filterOn) {
      callback(false);
      return;
    }

    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `SELECT 
        user_key
      FROM 
        ${config.nodeserver.db_djfan}.user
      WHERE         
        ${strWhere}
      LIMIT 
        1`,
      values
    );
    if (rows.length == 0) {
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

user.putUser = function (userKey, data, callback) {
  try {
    userObj = {};
    if (data.first_name != undefined) {
      userObj.first_name = data.first_name.substr(0, 50);
    }
    if (data.last_name != undefined) {
      userObj.last_name = data.last_name.substr(0, 100);
    }
    if (data.display_name != undefined) {
      userObj.display_name = data.display_name.substr(0, 100);
    }
    if (data.avatar != undefined) {
      userObj.avatar = data.avatar;
    }
    user.put(userKey, userObj, function (result) {
      callback(result);
    });
  } catch (error) {
    logger.log(error);
    callback(false);
  }
};

user.putUserName = function (userKey, data, callback) {
  try {
    const regexUsreName = /^[a-zA-Z0-9\-_]{3,50}$/;
    userObj = {};
    if (data.username != undefined) {
      userObj.username = data.username.substr(0, 50);
    }
    if (userObj.username.length < 3) {
      callback(false);
      return;
    }
    if (!regexUsreName.exec(userObj.username)) {
      callback(false);
      return;
    }
    user.put(userKey, userObj, function (result) {
      callback(result);
    });
  } catch (error) {
    logger.log(error);
    callback(false);
  }
};

user.put = async function (userKey, data, callback) {
  try {
    let result = await sequelizeUserModal.update(data, {
      where: {
        user_key: userKey,
      },
    });
    if (result[0] == 1) {
      serverCache.del(userKey);
      callback(true);
    } else {
      callback(false);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  }
};

user.getConnections = function (user_key = "", params, callback) {
  try {
    user.getUser(user_key, function (userObj) {
      if (userObj) {
        user.getConnectionList(userObj, params, function (result) {
          callback(result);
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

user.getSubscription = function (user_key = "", callback) {
  try {
    user.getUser(user_key, function (userObj) {
      if (userObj) {
        user.getSubscriptionList(userObj, function (result) {
          callback(result);
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

user.getConnectionList = async function (userObj, params, callback) {
  let queryWhere = "";
  if (params.type != undefined) {
    if (params.type == "subscriptions") {
      queryWhere += " AND accesslevel_id > 1 ";
    }
    if (params.type == "following") {
      queryWhere += " AND accesslevel_id = 1 ";
    }
  }

  let cacheKey =
    userObj.user_id + "_connectionlist_" + params.type + "_" + params.start;
  // FIx cache later!
  // let userConnectList = serverCache.get(cacheKey);
  let userConnectList = false;
  if (userConnectList) {
    callback(userConnectList);
  } else {
    let conn;
    try {
      conn = await dbconnection.pool.getConnection();
      // profile_dj.active=1 AND
      const rows = await conn.query(
        `SELECT 
            (
              SELECT 
                JSON_ARRAYAGG( JSON_OBJECT (
                    'user_key',user.user_key,
                    'profile_url',profile_url,
                    'display_name',display_name,
                    'cover_photo',cover_photo_cache,
                    'profile_picture',profile_picture_cache,
                    'accesslevel_id',accesslevel_id
                  )
                ) 
              FROM 
                ${config.nodeserver.db_djfan}.profile_dj 
              WHERE 
                profile_dj.user_id = user_relations.user_target 
              ORDER BY 
                display_name ASC
            ) AS dj    
        FROM
          ${config.nodeserver.db_djfan}.user_relations       
        INNER JOIN
          ${config.nodeserver.db_djfan}.user
        ON
          user.id=user_relations.user_target                
        INNER JOIN
          ${config.nodeserver.db_djfan}.profile_dj
        ON
          user.id=profile_dj.user_id        
        WHERE
          profile_dj.viewable = 1
            AND
          profile_dj.active=1
            AND
          user.active=1
            AND
          user_relations.user_source=${userObj.user_id}
          ${queryWhere}
        ORDER BY 
          user_relations.accesslevel_id DESC  
        LIMIT ?,?`,
        [parseInt(params.start), parseInt(params.limit)]
      );
      if (rows.length == 0) {
        serverCache.set(cacheKey, []);
        callback([]);
      } else {
        Object.keys(rows).forEach((key) => {
          if (rows[key]["dj"] != null) {
            rows[key]["dj"][0]["profile_picture"] =
              config.nodeserver.r2_s3_domain +
              rows[key]["dj"][0]["profile_picture"];
            rows[key]["dj"][0]["cover_photo"] =
              config.nodeserver.r2_s3_domain +
              rows[key]["dj"][0]["cover_photo"];
          }
        });
        serverCache.set(cacheKey, rows);
        callback(rows);
      }
    } catch (error) {
      logger.log(error);
      callback(false);
    } finally {
      if (conn) conn.end();
    }
  }
};

/*
user.getAllConnections = function (params, callback) { 
  Promise.all([
    user.getDjConnections(params),
    user.getVenueConnections(params) 
  ]).then((values) => {
    callback({"result":(Object.assign({}, ...values))});
  });
}

// user.getConnections = function(user_key = "", params, callback) {
user.getDjConnections = function (user_id) {  
  return new Promise((resolve, reject) => {
    user.xxxxxxxxxxxxxx(user_id,function(result) {
          resolve( result );
      });
  });
}

user.getVenueConnections = function (user_id) {  
  return new Promise((resolve, reject) => {
      user.xxxxxxxxxxxxxxxxx(user_id,function(result) {
          resolve( result );
      });
  });
}
*/

user.getSubscriptionList = async function (userObj, callback) {
  let cacheKey = userObj.user_id + "_connectionlist";
  // FIx cache later!
  // let userConnectList = serverCache.get(cacheKey);
  let userConnectList = false;
  if (userConnectList) {
    callback(userConnectList);
  } else {
    let conn;
    try {
      conn = await dbconnection.pool.getConnection();
      const rows = await conn.query(
        `SELECT 
            (
              SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                  'profile_url',profile_url,
                  'display_name',display_name,
                  'cover_photo',cover_photo_cache,
                  'profile_picture',profile_picture_cache
                )
              ) 
            FROM 
              ${config.nodeserver.db_djfan}.profile_dj 
            WHERE 
              profile_dj.user_id = user_relations.user_target ORDER BY display_name ASC) AS dj
        FROM
          ${config.nodeserver.db_djfan}.user_relations       
        INNER JOIN
          ${config.nodeserver.db_djfan}.user
        ON
          user.id=user_relations.user_target        
        WHERE
          user.active=1          
            AND
          user_source=${userObj.user_id}`
      );
      if (rows.length == 0) {
        serverCache.set(cacheKey, []);
        callback([]);
      } else {
        serverCache.set(cacheKey, rows);
        callback(rows);
      }
    } catch (err) {
      logger.log(error);
      callback(false);
    } finally {
      if (conn) conn.end();
    }
  }
};

user.doConnect = function (user_key, djId, callback) {
  user.getUser(user_key, function (userObj) {
    if (userObj) {
      user.setConnect(userObj.user_id, djId, function (result) {
        callback(result);
      });
    } else {
      callback(false);
    }
  });
};

user.setConnect = async function (fanId, djId, callback) {
  let conn;
  try {
    let datetime = new Date().toJSON().slice(0, 19).replace("T", " ");
    conn = await dbconnection.pool.getConnection();
    const result = await conn.query(
      `INSERT IGNORE INTO ${config.nodeserver.db_djfan}.user_relations (user_source,user_target,type,created_at,updated_at) VALUES (?,?,?,?,?)`,
      [fanId, djId, 1, datetime, datetime]
    );
    if (result.affectedRows == 0) {
      const result = await conn.query(
        `DELETE FROM ${config.nodeserver.db_djfan}.user_relations WHERE accesslevel_id=1 AND user_source=? AND user_target=? AND type=1`,
        [fanId, djId]
      );
      if (result) {
        callback({ result: true, connected: false, message: "disconnected" });
      } else {
        callback({
          result: true,
          connected: true,
          message: "unsubscribed, can't disconnected",
        });
      }
    } else {
      callback({ result: true, connected: true, message: "connected" });
    }
  } catch (error) {
    logger.log(error);
    callback({ result: false, message: error });
  } finally {
    if (conn) conn.end();
  }
};

user.updateConnect = async function (params, callback) {
  let conn;
  try {
    params.updated_at = new Date().toJSON().slice(0, 19).replace("T", " ");
    conn = await dbconnection.pool.getConnection();
    await conn.query(
      `
        UPDATE 
          ${config.nodeserver.db_djfan}.user_relations 
        SET 
          accesslevel_id=? 
        WHERE 
          user_source=? 
            AND 
          user_target=? 
            AND 
          type=1`,
      [
        parseInt(params.accesslevelId),
        params.updated_at,
        parseInt(params.fanId),
        parseInt(params.djId),
      ]
    );
    callback(true);
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

user.getSubscriptionDetails = function (user_key, params, callback) {
  try {
    if (params.start == undefined) {
      params.start = 0;
    }
    if (params.limit == undefined) {
      params.limit = 10;
    }
    if (params.limit > 20) {
      params.limit = 20;
    }
    user.getUser(user_key, function (userObj) {
      if (userObj) {
        user.getSubscriptionDetailsList(
          userObj.user_id,
          params,
          function (result) {
            callback(result);
          }
        );
      } else {
        callback(false);
      }
    });
  } catch (error) {
    logger.log(error);
    callback(false);
  }
};

user.getSubscriptionDetailsList = async function (user_id, params, callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `SELECT 
          profile_dj.profile_url,
          profile_dj.display_name,
          subscriptions.*,
          products.sku,
          products.image_url
        FROM
          ${config.nodeserver.db_djfan}.subscriptions  
        INNER JOIN
          ${config.nodeserver.db_djfan}.profile_dj
        ON
          subscriptions.dj_user_id=profile_dj.user_id          
        LEFT JOIN
          ${config.nodeserver.db_djfan}.products       
        ON
          subscriptions.product = products.id
        WHERE
          subscriptions.user_id = ?
        ORDER BY 
          subscriptions.id DESC  
        LIMIT ?,?`,
      [parseInt(user_id), parseInt(params.start), parseInt(params.limit)]
    );
    if (rows.length == 0) {
      callback([]);
    } else {
      callback(rows);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

user.getPurchaseDetails = function (user_key, params, callback) {
  try {
    if (params.start == undefined) {
      params.start = 0;
    }
    if (params.limit == undefined) {
      params.limit = 10;
    }
    if (params.limit > 20) {
      params.limit = 20;
    }
    user.getUser(user_key, function (userObj) {
      if (userObj) {
        user.getPurchaseDetailsList(userObj.user_id, params, function (result) {
          callback(result);
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

user.getPurchaseDetailsList = async function (user_id, params, callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `SELECT 
        product_purchases.*,
        DATE_FORMAT(product_purchases.created_at,'%d-%m-%y') AS purchased_date,
        
        products.sku,
        products.image_url,        
        products.product_type,        
        
        DATE_FORMAT(products_audio.release_date,'%d-%m-%y') AS release_date,
        products_audio.artist AS credits,
        products_audio.label
      FROM
        ${config.nodeserver.db_djfan}.product_purchases     
      
      LEFT JOIN
        ${config.nodeserver.db_djfan}.products_audio       
      ON
        product_purchases.product = products_audio.product_id          

      LEFT JOIN
          ${config.nodeserver.db_djfan}.products       
      ON
        product_purchases.product = products.id          

      WHERE
        product_purchases.user_id = ?
      ORDER BY 
        product_purchases.id DESC  
      LIMIT ?,?`,
      [parseInt(user_id), parseInt(params.start), parseInt(params.limit)]
    );
    if (rows.length == 0) {
      callback([]);
    } else {
      callback(rows);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

user.deleteAccount = function (user_key, callback) {
  try {
    user.getUser(user_key, function (userdata) {
      if (user) {
        let variables = {};
        variables.template = "resign_email.html";
        variables.name = userdata.first_name + " " + userdata.last_name;
        // mailer.setHtml(variables, function (template) {
        //   if (template) {
        //     const email = {
        //       from: config.nodeserver.sparkpost_mail_from,
        //       to:
        //         config.nodeserver.environment == "dev"
        //           ? "test@email.com"
        //           : userdata.email,
        //       subject: "DJFAN: Resign email - Account deleted",
        //       html: template,
        //     };
        //     mailer.send(email, function (result) {
        //       if (!result) {
        //         errorlog.write(result);
        //       }
        //     });
        //   }
        // });
        user.doDeleteAccount(user_key, function (result) {
          callback(result);
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

user.doDeleteAccount = async function (user_key, callback) {
  let conn;
  try {
    let scramble = uuidv4();
    conn = await dbconnection.pool.getConnection();
    await conn.query(
      `UPDATE ${config.nodeserver.db_djfan}.user  
      SET
        email=concat(email,'_deleted'), 
        password=concat(password,'_deleted'), 
        first_name='', 
        last_name='', 
        active=0, 
        status_id=7,
        username='${scramble}'           
      WHERE
        user_key=?
      `,
      [user_key]
    );
    await conn.query(
      `DELETE FROM ${config.nodeserver.db_login}.sessions WHERE user_id=?`,
      [user_key]
    );
    await conn.query(
      `DELETE FROM ${config.nodeserver.db_login}.accounts WHERE user_id=?`,
      [user_key]
    );
    await conn.query(
      `DELETE FROM ${config.nodeserver.db_login}.users WHERE id=?`,
      [user_key]
    );
    callback(true);
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

user.getDirectMessageChannels = async function (user_id, callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `
      SELECT 
        profile_dj.display_name AS name, 
        CONCAT('${config.nodeserver.r2_s3_domain}',profile_dj.profile_picture_cache) AS avatar,  
        stream_direct_messaging_channels.channel_id, 
        IFNULL((SELECT SUM(message) FROM ${config.nodeserver.db_djfan}.direct_messages_store WHERE fan_id=? AND dj_id=profile_dj.user_id),0) AS message_count 
      FROM 
        ${config.nodeserver.db_djfan}.stream_direct_messaging_channels 
      INNER JOIN
        ${config.nodeserver.db_djfan}.profile_dj
      ON  
        profile_dj.user_id = stream_direct_messaging_channels.dj_id          
      WHERE 
        stream_direct_messaging_channels.fan_id=?`,
      [user_id, user_id]
    );
    if (rows.length == 0) {
      callback({ result: true, channels: [] });
    } else {
      callback({ result: true, channels: rows });
    }
  } catch (error) {
    logger.log(error);
    callback({ result: false });
  } finally {
    if (conn) conn.end();
  }
};

user.myConnections = async function (params, callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `
      SELECT 
        profile_dj.profile_url AS url,
        profile_dj.display_name AS name,    
        IF(profile_dj.cover_photo_cache='',profile_dj.cover_photo,profile_dj.cover_photo_cache) as secondary_image,
        IF(profile_dj.profile_picture_cache='',profile_dj.profile_picture,profile_dj.profile_picture_cache) as primary_image,    
        user_relations.type,
        user_relations.accesslevel_id,
        user_relations.user_target AS user_id	
      FROM 
        ${config.nodeserver.db_djfan}.user_relations 
      INNER JOIN
        ${config.nodeserver.db_djfan}.profile_dj 
      ON
        user_relations.user_target = profile_dj.user_id AND user_relations.type = 1 	
      WHERE 
        user_relations.user_source=?
          AND
          profile_dj.active = 1    
          AND
        profile_dj.viewable = 1 
          
      UNION
      
      SELECT 
        venues.url AS url,
        venues.name AS name,
        IF(venues.photo_cache='',venues.photo,venues.photo_cache) as secondary_image,    
        IF(venues.logo_cache='',venues.logo,venues.logo_cache) as primary_image,
        user_relations.type,
        user_relations.accesslevel_id,
        user_relations.user_target AS user_id
      FROM 
        ${config.nodeserver.db_djfan}.user_relations 
      INNER JOIN
        ${config.nodeserver.db_djfan}.venues 
      ON
        user_relations.user_target = venues.id AND user_relations.type = 2 	
      WHERE 
        user_relations.user_source=?
          AND
        venues.active = 1
          AND
        venues.viewable = 1        

      ORDER BY 
        accesslevel_id DESC, name ASC
      `,
      [params.user_id, params.user_id]
    );
    if (rows.length == 0) {
      callback({ result: true, data: [] });
    } else {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i]["primary_image"].indexOf("http") == -1) {
          rows[i]["primary_image"] =
            config.nodeserver.r2_s3_domain + rows[i]["primary_image"];
        }
        if (rows[i]["secondary_image"].indexOf("http") == -1) {
          rows[i]["secondary_image"] =
            config.nodeserver.r2_s3_domain + rows[i]["secondary_image"];
        }
      }
      callback({ result: true, data: rows });
    }
  } catch (error) {
    logger.log(error);
    callback({ result: false });
  } finally {
    if (conn) conn.end();
  }
};

module.exports = user;
