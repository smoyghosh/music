const config = require("../../config");
const dbconnection = require("../dbconnection");
const NodeCache = require("node-cache");
const serverCache = new NodeCache({ stdTTL: 500, checkperiod: 600 });
const logger = require("../logger");

const djprofile = {};

djprofile.get = async function (profile_url = "", callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `SELECT 
          profile_dj.user_id,
          profile_dj.profile_picture_cache AS profile_picture,
          profile_dj.cover_photo_cache AS cover_photo,
          profile_dj.profile_url,
          profile_dj.display_name,
          profile_dj.title,
          IFNULL(profile_dj.about_me,'') AS about_me,
          profile_dj.genre,
          profile_dj.location,
          profile_dj.country,
          profile_dj.bookings,
          profile_dj.management,
          profile_dj.music_genre,
          profile_dj.website,
          profile_dj.soundcloud,
          profile_dj.facebook,
          profile_dj.instagram,
          profile_dj.spotify,
          profile_dj.tiktok,
          profile_dj.mixcloud,
          profile_dj.youtube 
      FROM 
        ${config.nodeserver.db_djfan}.profile_dj 
      INNER JOIN
        ${config.nodeserver.db_djfan}.user
        ON
          user.id=profile_dj.user_id        
      WHERE
        user.active =  1
          AND
        profile_dj.profile_url=? 
      LIMIT 1`,
      [profile_url]
    );
      /**       profile_dj.viewable = 1
          AND
      */
    /* query where publish = active ? additional to active user  */
    if (rows.length == 0) 
    { 
      callback(false);    
    }
    else 
    {
      rows[0].about_me = rows[0].about_me.toString().replace(/(?:\r\n|\r|\n)/g, '<br />');
      rows[0].profile_picture = config.nodeserver.r2_s3_domain + rows[0].profile_picture;
      rows[0].cover_photo = config.nodeserver.r2_s3_domain + rows[0].cover_photo;
      serverCache.set( rows[0].profile_url , rows[0].user_id); 
      callback(rows);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

djprofile.getUserId = function (profile_url = "", callback) {
  try {
    let userId = serverCache.get(profile_url);
    if (userId) {
      callback( userId ); 
    } else {
        djprofile.get(profile_url, function (result) {
          if (!result) {
          callback( false );
        } else {        
          callback( result[0]['user_id'] );
        }
      });
    }         
  } catch(error) {
    logger.log(error);
    callback( false );
  }    
};

djprofile.getUserIdPromise = function (profile_url = "") {
    return new Promise((resolve, reject) => {
        djprofile.getUserId(profile_url, function(result){
          if(result) {
            resolve(result);
          } else {
            reject(false)
          }
        });            
    });
};

djprofile.getDjProfiles = async function(params = {}, callback) {
  let cacheKeyPrefix = 'djprofile_'+params.type+'_';
  let cacheKey = 'djprofile_'+params.type+'_'+params.start;
  let djprofileData = serverCache.get(cacheKey);
  djprofileData = false; // TEMP  disable cache . 
  if (djprofileData) {
    callback( djprofileData ); 
  } else {
    if (params.start == undefined ){
      params.start=0;}
    params.limit=16;    
    let queryWhere = "";

    let conn;
    try {
      conn = await dbconnection.pool.getConnection();
      const rows = await conn.query(
        `
        SELECT       
          profile_dj.profile_url, 
          profile_dj.display_name, 
          profile_dj.profile_picture_cache AS profile_picture, 
          profile_dj.cover_photo_cache AS cover_photo,          
          posts.total_posts
        FROM 
          ${config.nodeserver.db_djfan}.profile_dj
        INNER JOIN
          ${config.nodeserver.db_djfan}.user
        ON
          user.id=profile_dj.user_id
        LEFT JOIN
          (
            SELECT 
              user_id,
              COUNT(*) AS total_posts
            FROM 
              ${config.nodeserver.db_djfan}.posts 
            WHERE
              DATEDIFF(now(), created_at)<100	
            GROUP BY 
              user_id
          ) 
          posts 
        ON 
          posts.user_id=profile_dj.user_id     
        WHERE
          profile_dj.viewable = 1
            AND
          user.active=1
            AND  
          profile_picture_cache <> 'error' 
            AND 
          profile_picture_cache <> ''
            AND
          profile_dj.active = 1  
          ${queryWhere}
        ORDER BY 
          profile_dj.featured DESC,
          posts.total_posts DESC         
        LIMIT 
          ?,?
          `,
        [parseInt(params.start), parseInt(params.limit)]
      );
      if (rows.length == 0) {
        callback([]);
      } else {
        for (let i = 0; i < rows.length; i++) {
            let row = rows[i];
            row.profile_picture = config.nodeserver.r2_s3_domain + row.profile_picture;
            row.cover_photo = config.nodeserver.r2_s3_domain + row.cover_photo;     
            delete row.total_posts;                
        }        
        // Q&D clean up old cache of different starting points
        serverCache.del( [ `${cacheKeyPrefix}1`, `${cacheKeyPrefix}2`, `${cacheKeyPrefix}3`, `${cacheKeyPrefix}4`, `${cacheKeyPrefix}5`, `${cacheKeyPrefix}6`, `${cacheKeyPrefix}7`, `${cacheKeyPrefix}8`, `${cacheKeyPrefix}9` ] );
        serverCache.set(cacheKey,rows,600); 
        callback(rows);
      }
    } catch (error) {
      logger.log(error);
      callback(false);
    } finally {
      if (conn) conn.end();
    }
  }
}

djprofile.getCache = function(callback) {
  callback(serverCache);
}

module.exports = djprofile;