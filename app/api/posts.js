const config = require("../../config");
const dbconnection = require("../dbconnection");
const cloudflare = require("../cloudflare");
const media = require("./media");
const user = require("./user");
const NodeCache = require("node-cache");
const serverCache = new NodeCache({ stdTTL: 900, checkperiod: 1000 });
const logger = require("../logger");

// const NodeCache = require("node-cache");
// const serverCache = new NodeCache({ stdTTL: 500, checkperiod: 600 });

const posts = {};

posts.get = async function (dj_user_id=0, params={}, callback) {  
  let cloudflareParams = {};
  let mediaUpdate = {image:{},video:{},audio:{}};

  if (params.admin_access == undefined ) {
      params.admin_access = false; 
  }
  if (params.start == undefined ) {
      params.start = 0;
  }
  if (params.accesslevel_id == undefined ) {
      params.accesslevel_id=1;
  }
  if (params.limit == undefined ) {
      params.limit = 10;
  }
  if (params.limit > 20 ) {
      params.limit = 20;
  }
  if (params.type == undefined ) {
      params.type = 0;
  } 
  if (params.post_id == undefined ) {
      params.post_id=0;
  } else {
      params.post_id = parseInt(params.post_id);
  }

  let queryWhere = "";
  if (params.type.length>0 && params.type!='0') {
    params.type = params.type.toString().replace(/[^0-9,]/g, '');
    queryWhere += ` AND posts.posttype_id IN (${params.type}) `; 
  }  
  if (params.post_id>0) {
    queryWhere += ` AND posts.id = '${params.post_id}' `; 
      /*
      let post = serverCache.get(`post_${params.post_id}`);
      if (post) {
        callback( post ); 
        return;
      } 
      */   
  }  

  /*
  // for cache remove line 
  // -> IFNULL((SELECT accesslevel_id FROM ${config.nodeserver.db_djfan}.user_relations WHERE user_source=? AND user_target=?),IF(${params.user_id}>0,1,0)) AS user_accesslevel_id,         
  // needs separate query 
  */
  
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `SELECT 
        profile_dj.profile_url, 
        profile_dj.display_name, 
        profile_dj.profile_picture_cache AS profile_picture, 
        profile_dj.cover_photo_cache AS cover_photo,
        posts.id, 
        posts.title, 
        posts.body, 
        posts.created_at, 
        posts.updated_at, 
        posts.posttype_id,
        posts.accesslevel_id, 
        IFNULL((SELECT accesslevel_id FROM ${config.nodeserver.db_djfan}.user_relations WHERE user_source=? AND user_target=?),IF(${params.user_id}>0,1,0)) AS user_accesslevel_id,        
        (SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id',id,
          'location',IF(location_cache='' OR location_cache='error',location,location_cache),
          'surl',signed_url,
          'sample',sample,
          'stime',signed_timestamp
          )) FROM ${config.nodeserver.db_djfan}.post_image WHERE posts_id=posts.id) AS image,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id',id,
          'location',IF(transcoded_location='' OR transcoded_location='error',location,transcoded_location),
          'surl',signed_url,
          'sample',sample,
          'sample_status',sample_status,
          'stime',signed_timestamp,
          'embedded',embedded,
          'artwork',artwork_cache,
          'title',title,
          'meta_length',meta_length
          )) FROM ${config.nodeserver.db_djfan}.post_audio WHERE posts_id=posts.id) AS audio,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id',id,
          'location',IF(transcoded_location='' OR transcoded_location='error',location,transcoded_location),
          'surl',signed_url,
          'sample',sample,
          'stime',signed_timestamp,
          'poster',IF(poster_cache='',poster,poster_cache),  
          'embedded',embedded
          )) FROM ${config.nodeserver.db_djfan}.post_video WHERE posts_id=posts.id) AS video	            
      FROM 
        ${config.nodeserver.db_djfan}.posts 
      INNER JOIN
        ${config.nodeserver.db_djfan}.user
      ON
        user.id=posts.user_id        
      INNER JOIN
        ${config.nodeserver.db_djfan}.profile_dj    
      ON
        profile_dj.user_id = posts.user_id
      WHERE
        profile_dj.viewable = 1
          AND
        user.active = 1
          AND  
        posts.user_id = ?
          AND
        posts.active = 1
          AND
        posts.remove = 0
          AND
        posts.publish = 1
        ${queryWhere}
      ORDER BY 
        posts.id DESC  
      LIMIT ?,?`,
      [parseInt(params.user_id), parseInt(dj_user_id), parseInt(dj_user_id), parseInt(params.start), parseInt(params.limit)]
    ); 
    if (rows.length == 0) {
      callback([]);
    } else {
      
      let stimeNow = Math.round(Date.now()/1000);
      for (let i = 0; i < rows.length; i++) {
          let row = rows[i];
          cloudflareParams.bucket='djfan';
          if (row.accesslevel_id==2) {
            cloudflareParams.bucket='djfan-lvl-2';
          }
          if (row.accesslevel_id==3) {
            cloudflareParams.bucket='djfan-lvl-3';
          }

          row.profile_picture = config.nodeserver.r2_s3_domain + row.profile_picture;
          row.cover_photo = config.nodeserver.r2_s3_domain + row.cover_photo;

          if (row.user_accesslevel_id < row.accesslevel_id) {
            row.has_access = false;
          } else {
            row.has_access = true;
          }

          // ADMIN
          if (params.admin_access){
            row.has_access = true;
          }        

          if (row.image!=null) {
            for (let ii = 0; ii < row.image.length; ii++) {
              if (!row.has_access) {
                if (row.image[ii].sample.indexOf('cache/')>-1 ) {
                  row.image[ii].location = config.nodeserver.r2_s3_domain + row.image[ii].sample;
                } else {
                  row.image[ii].location = 'https://files.djfan.app/images/no-image.png';
                }
                delete row.image[ii].surl;
                delete row.image[ii].stime;
                delete row.image[ii].id;
                delete row.image[ii].sample;
                continue;
              }

              if (row.accesslevel_id>1 && (stimeNow + config.nodeserver.surl_time_margin > row.image[ii].stime || row.image[ii].surl == null) && row.image[ii].location.length>0) {
                  cloudflareParams.key = row.image[ii].location;                                
                  row.image[ii].surl = await cloudflare.getSignedUrl(cloudflareParams);
                  row.image[ii].stime = stimeNow + 600;
                  mediaUpdate['image'][row.image[ii].id] = {"surl":row.image[ii].surl,"stime":row.image[ii].stime}; 
                  row.image[ii].location = row.image[ii].surl;
              }

              if (row.image[ii].location!=null){
                if (row.image[ii].location.indexOf('://')==-1) {
                  row.image[ii].location = config.nodeserver.r2_s3_domain + row.image[ii].location;
                }
              }

              delete row.image[ii].surl;
              delete row.image[ii].stime;
              delete row.image[ii].id;
              delete row.image[ii].sample;
            }   
          }

          if (row.video!=null) {
            for (let ii = 0; ii < row.video.length; ii++) {
              if (row.video[ii].embedded==0 && row.video[ii].poster!=null) {
                if (row.video[ii].poster.indexOf('://')==-1) {
                  row.video[ii].poster = config.nodeserver.r2_s3_domain + row.video[ii].poster;
                }
              }    

              if (!row.has_access) {
                row.video[ii].location='';
                delete row.video[ii].surl;
                delete row.video[ii].stime;
                delete row.video[ii].id;
                continue;
              }

              if (row.video[ii].embedded==0 && row.accesslevel_id>1 && (stimeNow + config.nodeserver.surl_time_margin > row.video[ii].stime || row.video[ii].surl == null) && row.video[ii].location.length>0) {
                  cloudflareParams.key = row.video[ii].location;                                   
                  row.video[ii].surl = await cloudflare.getSignedUrl(cloudflareParams);
                  row.video[ii].stime = stimeNow + 600;
                  mediaUpdate['video'][row.video[ii].id] = {"surl":row.video[ii].surl,"stime":row.video[ii].stime}; 
                  row.video[ii].location = row.video[ii].surl;
              }
              
              if (row.video[ii].embedded==0 && row.video[ii].location!=null) {
                if (row.video[ii].location.indexOf('://')==-1){
                  row.video[ii].location = config.nodeserver.r2_s3_domain + row.video[ii].location;
                }
              }

              delete row.video[ii].surl;
              delete row.video[ii].stime;
              delete row.video[ii].id;
            }   
          }
          
          if (row.audio!=null) {
            for (let ii = 0; ii < row.audio.length; ii++) {
              if (row.audio[ii].embedded==0 && row.audio[ii].artwork!=null &&  row.audio[ii].artwork!='') {
                if (row.audio[ii].artwork.indexOf('://')==-1) {
                  row.audio[ii].artwork = config.nodeserver.r2_s3_domain + row.audio[ii].artwork;
                }
              }              

              if (!row.has_access) {
                if (row.audio[ii].sample_status==9) {
                  row.audio[ii].location = config.nodeserver.r2_s3_domain + row.audio[ii].sample;
                } else {
                  row.audio[ii].location = '';
                }                  
                delete row.audio[ii].surl;
                delete row.audio[ii].stime;
                delete row.audio[ii].id;
                continue;
              }

              if (row.audio[ii].embedded==0 && row.accesslevel_id>1 && (stimeNow + config.nodeserver.surl_time_margin > row.audio[ii].stime || row.audio[ii].surl == null) && row.audio[ii].location.length>0) {                  
                  cloudflareParams.key = row.audio[ii].location;                                   
                  row.audio[ii].surl = await cloudflare.getSignedUrl(cloudflareParams);
                  row.audio[ii].stime = stimeNow + 600;
                  mediaUpdate['audio'][row.audio[ii].id] = {"surl":row.audio[ii].surl,"stime":row.audio[ii].stime}; 
                  row.audio[ii].location = row.audio[ii].surl;
              }

              if (row.audio[ii].embedded==0 && row.audio[ii].location!=null) {
                if (row.audio[ii].location.indexOf('://')==-1) {
                  row.audio[ii].location = config.nodeserver.r2_s3_domain + row.audio[ii].location;
                }
              }

              delete row.audio[ii].surl;
              delete row.audio[ii].stime;
              delete row.audio[ii].id;
            }   
          }                    
      }
      /*
      if (params.post_id>0) {
        serverCache.set(`post_${params.post_id}`,rows); 
      } 
      */   
      callback(rows);
      media.set(mediaUpdate);
    }
  } catch (error) {
    logger.log(error); 
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

posts.getFeed = function(user_id, params, callback) {
  posts.getFeedData(user_id, params, function(result) {
    if (result) {
      callback(result);
    } else {
      callback(false);
    }
  });
}

posts.getFeedData = async function (user_id = 0, params = {}, callback) {  
    let cloudflareParams = {};
    let mediaUpdate = {image:{},video:{},audio:{}};

    if (params.start == undefined ){
      params.start=0;}
    if (params.accesslevel_id == undefined ){
        params.accesslevel_id=3;}
    if (params.limit == undefined ){
        params.limit=10;}
    if (params.limit > 20 ){
        params.limit=20;}
    if (params.select == undefined ){
        params.select='all';}
    if (params.type == undefined ){
        params.type=0;} else {
    params.type = parseInt(params.type);}
    
    let queryWhere = "";
    if (params.type.length>0 ) {
      params.type = params.type.toString().replace(/[^0-9,]/g, '');
      queryWhere += ` AND posts.posttype_id IN (${params.type}) `; 
    }  
    
    let conn;
    try {
      conn = await dbconnection.pool.getConnection();
      let rows;
      if (params.select=='me') {
        rows = await conn.query(
          `SELECT 
            profile_dj.profile_url, 
            profile_dj.display_name, 
            profile_dj.profile_picture_cache AS profile_picture, 
            profile_dj.cover_photo_cache AS cover_photo,
            posts.id, 
            posts.title, 
            posts.body, 
            posts.created_at, 
            posts.updated_at, 
            posts.posttype_id,
            posts.accesslevel_id, 
            user_relations.accesslevel_id AS user_accesslevel_id,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                'id',id,
                'location',IFNULL(IF(location_cache='' OR location_cache='error',location,location_cache),''),
                'surl',signed_url,
                'sample',sample,
                'stime',signed_timestamp
                )) FROM ${config.nodeserver.db_djfan}.post_image WHERE posts_id=posts.id) AS image,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                'id',id,
                'location',IFNULL(IF(transcoded_location='' OR transcoded_location='error',location,transcoded_location),''),
                'surl',signed_url,
                'sample',sample,
                'sample_status',sample_status,
                'stime',signed_timestamp,
                'embedded',embedded,
                'artwork',artwork_cache,
                'title',title,
                'meta_length',meta_length
                )) FROM ${config.nodeserver.db_djfan}.post_audio WHERE posts_id=posts.id) AS audio,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                'id',id,
                'location',IFNULL(IF(transcoded_location='' OR transcoded_location='error',location,transcoded_location),''),
                'surl',signed_url,
                'sample',sample,
                'stime',signed_timestamp,
                'poster',IF(poster_cache='',poster,poster_cache),
                'embedded',embedded
                )) FROM ${config.nodeserver.db_djfan}.post_video WHERE posts_id=posts.id) AS video	            
          FROM 
            ${config.nodeserver.db_djfan}.posts 
          INNER JOIN 
            ${config.nodeserver.db_djfan}.user_relations 
          ON 
            posts.user_id = user_relations.user_target 
          INNER JOIN
            ${config.nodeserver.db_djfan}.profile_dj    
          ON
            profile_dj.user_id = posts.user_id
          INNER JOIN
            ${config.nodeserver.db_djfan}.user
          ON
            user.id=posts.user_id                     
          WHERE
            profile_dj.viewable = 1
              AND
            user.active=1
              AND
            user_relations.user_source = ?
              AND
            posts.active = 1
              AND
            posts.remove = 0
              AND
            posts.publish = 1            
            ${queryWhere}
          ORDER BY 
            posts.id DESC
          LIMIT ?,?`,
          [parseInt(user_id), parseInt(params.start), parseInt(params.limit)]
        );  
      } else if (params.select=='home') {  
    
        rows = await conn.query(
          `SELECT 
            profile_dj.profile_url, 
            profile_dj.display_name, 
            profile_dj.profile_picture_cache AS profile_picture, 
            profile_dj.cover_photo_cache AS cover_photo,
            posts.id, 
            posts.title, 
            posts.body, 
            posts.created_at, 
            posts.updated_at, 
            posts.posttype_id,
            posts.accesslevel_id,          
            IF(${user_id}>0,1,0) AS user_accesslevel_id,   
            (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                'id',id,
                'location',IFNULL(IF(location_cache='' OR location_cache='error',location,location_cache),''),
                'surl',signed_url,
                'sample',sample,
                'stime',signed_timestamp
                )) FROM ${config.nodeserver.db_djfan}.post_image WHERE posts_id=posts.id ) AS image,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                'id',id,
                'location',IFNULL(IF(transcoded_location='' OR transcoded_location='error',location,transcoded_location),''),
                'surl',signed_url,
                'sample',sample,
                'sample_status',sample_status,
                'stime',signed_timestamp,
                'embedded',embedded,
                'artwork',artwork_cache,
                'title',title,
                'meta_length',meta_length
                )) FROM ${config.nodeserver.db_djfan}.post_audio WHERE posts_id=posts.id) AS audio,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                'id',id,
                'location',IFNULL(IF(transcoded_location='' OR transcoded_location='error',location,transcoded_location),''),
                'surl',signed_url,
                'sample',sample,
                'stime',signed_timestamp,
                'poster',IF(poster_cache='',poster,poster_cache),
                'embedded',embedded
                )) FROM ${config.nodeserver.db_djfan}.post_video WHERE posts_id=posts.id) AS video	            
          FROM 
            ${config.nodeserver.db_djfan}.posts 
          INNER JOIN
            ${config.nodeserver.db_djfan}.profile_dj    
          ON
            profile_dj.user_id = posts.user_id
          INNER JOIN
            ${config.nodeserver.db_djfan}.user
          ON
            user.id=posts.user_id              
          WHERE
            profile_dj.viewable = 1
              AND
            user.active=1
              AND
            posts.accesslevel_id = 1
              AND
            posts.active = 1
              AND
            posts.remove = 0
              AND
            posts.publish = 1    
              AND
            posts.created_at = (SELECT MAX(X.created_at) FROM ${config.nodeserver.db_djfan}.posts X WHERE X.user_id=posts.user_id)                     
            ${queryWhere}
          GROUP BY
              posts.user_id
          ORDER BY 
              posts.created_at DESC
          LIMIT ?,?`,
          [parseInt(params.start), parseInt(params.limit)]
        );             
      } else {
        rows = await conn.query(
          `SELECT 
            profile_dj.profile_url, 
            profile_dj.display_name, 
            profile_dj.profile_picture_cache AS profile_picture, 
            profile_dj.cover_photo_cache AS cover_photo,
            posts.id, 
            posts.title, 
            posts.body, 
            posts.created_at, 
            posts.updated_at, 
            posts.posttype_id,
            posts.accesslevel_id, 
            IF(${user_id}>0,1,0) as user_accesslevel_id,            
            (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                'id',id,
                'location',IFNULL(IF(location_cache='' OR location_cache='error',location,location_cache),''),
                'surl',signed_url,
                'sample',sample,
                'stime',signed_timestamp
                )) FROM ${config.nodeserver.db_djfan}.post_image WHERE posts_id=posts.id ) AS image,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                'id',id,
                'location',IFNULL(IF(transcoded_location='' OR transcoded_location='error',location,transcoded_location),''),
                'surl',signed_url,
                'sample',sample,
                'sample_status',sample_status,
                'stime',signed_timestamp,
                'embedded',embedded,
                'artwork',artwork_cache,
                'title',title,
                'meta_length',meta_length
                )) FROM ${config.nodeserver.db_djfan}.post_audio WHERE posts_id=posts.id) AS audio,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                'id',id,
                'location',IFNULL(IF(transcoded_location='' OR transcoded_location='error',location,transcoded_location),''),
                'surl',signed_url,
                'sample',sample,
                'stime',signed_timestamp,
                'poster',IF(poster_cache='',poster,poster_cache),
                'embedded',embedded
                )) FROM ${config.nodeserver.db_djfan}.post_video WHERE posts_id=posts.id) AS video	            
          FROM 
            ${config.nodeserver.db_djfan}.posts 
          INNER JOIN
            ${config.nodeserver.db_djfan}.profile_dj    
          ON
            profile_dj.user_id = posts.user_id
          INNER JOIN
            ${config.nodeserver.db_djfan}.user
          ON
            user.id=posts.user_id              
          WHERE
            profile_dj.viewable = 1
              AND
            user.active=1
              AND
            posts.accesslevel_id = 1
              AND
            posts.active = 1
              AND
            posts.remove = 0
              AND
            posts.publish = 1            
            ${queryWhere}
          ORDER BY 
            posts.id DESC
          LIMIT ?,?`,
          [parseInt(params.start), parseInt(params.limit)]
        );  
        // profile_dj.user_id IN ?  select popular DJ's 
      }   
      if (rows.length == 0) {
        callback([]);
      } else {

        let stimeNow = Math.round(Date.now()/1000);
        for (let i = 0; i < rows.length; i++) {
            let row = rows[i];
            cloudflareParams.bucket='djfan';
            if (row.accesslevel_id==2) {
              cloudflareParams.bucket='djfan-lvl-2';
            }
            if (row.accesslevel_id==3) {
              cloudflareParams.bucket='djfan-lvl-3';
            }

            row.profile_picture = config.nodeserver.r2_s3_domain + row.profile_picture;
            row.cover_photo = config.nodeserver.r2_s3_domain + row.cover_photo;

            if (row.user_accesslevel_id != undefined) {
              if (row.user_accesslevel_id < row.accesslevel_id) {
                row.has_access = false;
              } else {
                row.has_access = true;
              }
            } else {
              row.has_access = false;
            }       
            
            // ADMIN
            if (params.admin_access){
              row.has_access = true;
            } 

            if (row.image!=null) {
              for (let ii = 0; ii < row.image.length; ii++) {

                if (!row.has_access && params.select!='home') {
                  if (row.image[ii].sample.indexOf('cache/')>-1 ) {                    
                    row.image[ii].location = config.nodeserver.r2_s3_domain + row.image[ii].sample;
                  } else {
                    row.image[ii].location = 'https://files.djfan.app/images/no-image.png';
                  }
                  delete row.image[ii].surl;
                  delete row.image[ii].stime;
                  delete row.image[ii].id;
                  delete row.image[ii].sample;
                  continue;
                }

                if (row.accesslevel_id>1 && (stimeNow + config.nodeserver.surl_time_margin > row.image[ii].stime || row.image[ii].surl == null) && row.image[ii].location.length>0) {
                    cloudflareParams.key = row.image[ii].location;                              
                    row.image[ii].surl = await cloudflare.getSignedUrl(cloudflareParams);
                    row.image[ii].stime = stimeNow + 600;
                    mediaUpdate['image'][row.image[ii].id] = {"surl":row.image[ii].surl,"stime":row.image[ii].stime}; 
                    row.image[ii].location = row.image[ii].surl;
                }

                if (row.image[ii].location!=null) {
                  if (row.image[ii].location.indexOf('://')==-1) {
                    row.image[ii].location = config.nodeserver.r2_s3_domain + row.image[ii].location;
                  }
                }
                delete row.image[ii].surl;
                delete row.image[ii].stime;
                delete row.image[ii].id;
              }   
            }

            if (row.video!=null) {            
              for (let ii = 0; ii < row.video.length; ii++) {
                if (row.video[ii].embedded==0 && row.video[ii].poster!=null) {
                  if (row.video[ii].poster.indexOf('://')==-1) {
                    row.video[ii].poster = config.nodeserver.r2_s3_domain + row.video[ii].poster;
                  }
                } 
                 
                if (!row.has_access && params.select!='home') {
                  row.video[ii].location='';
                  delete row.video[ii].surl;
                  delete row.video[ii].stime;
                  delete row.video[ii].id;                  
                  continue;
                }

                if ( row.video[ii].embedded==0 && row.accesslevel_id>1 && (stimeNow + config.nodeserver.surl_time_margin > row.video[ii].stime || row.video[ii].surl == null) && row.video[ii].location.length>0) {
                    cloudflareParams.key = row.video[ii].location;                                   
                    row.video[ii].surl = await cloudflare.getSignedUrl(cloudflareParams);
                    row.video[ii].stime = stimeNow + 600;
                    mediaUpdate['video'][row.video[ii].id] = {"surl":row.video[ii].surl,"stime":row.video[ii].stime}; 
                    row.video[ii].location = row.video[ii].surl;
                }
                if ( row.video[ii].embedded==0 && row.video[ii].location!=null){
                  if (row.video[ii].location.indexOf('://')==-1){
                    row.video[ii].location = config.nodeserver.r2_s3_domain + row.video[ii].location;
                  }  
                }
                if (row.video[ii].embedded==0 && row.video[ii].poster!=null){
                  if (row.video[ii].poster.indexOf('://')==-1){
                    row.video[ii].poster = config.nodeserver.r2_s3_domain + row.video[ii].poster;
                  }
                }
                delete row.video[ii].surl;
                delete row.video[ii].stime;
                delete row.video[ii].id;
              }   
            }
            
            if (row.audio!=null) {
              for (let ii = 0; ii < row.audio.length; ii++) {                
                if (row.audio[ii].embedded==0 && row.audio[ii].artwork!=null && row.audio[ii].artwork!='') {
                  if (row.audio[ii].artwork.indexOf('://')==-1) {
                    row.audio[ii].artwork = config.nodeserver.r2_s3_domain + row.audio[ii].artwork;
                  }
                }   

                if (!row.has_access && params.select!='home') {
                  if (row.audio[ii].sample_status==9) {
                    row.audio[ii].location = config.nodeserver.r2_s3_domain + row.audio[ii].sample;
                  } else {
                    row.audio[ii].location = '';
                  }                  
                  delete row.audio[ii].surl;
                  delete row.audio[ii].stime;
                  delete row.audio[ii].id;
                  continue;
                }

                if (row.audio[ii].embedded==0 && row.accesslevel_id>1 && (stimeNow + config.nodeserver.surl_time_margin > row.audio[ii].stime || row.audio[ii].surl == null) && row.audio[ii].location.length>0) {                  
                    cloudflareParams.key = row.audio[ii].location;                                   
                    row.audio[ii].surl = await cloudflare.getSignedUrl(cloudflareParams);
                    row.audio[ii].stime = stimeNow + 600;
                    mediaUpdate['audio'][row.audio[ii].id] = {"surl":row.audio[ii].surl,"stime":row.audio[ii].stime}; 
                    row.audio[ii].location = row.audio[ii].surl;
                }
                if (row.audio[ii].embedded==0 && row.audio[ii].location!=null) {
                  if (row.audio[ii].location.indexOf('://')==-1) {
                    row.audio[ii].location = config.nodeserver.r2_s3_domain + row.audio[ii].location;
                  }
                }                
                if (row.audio[ii].embedded==0 && row.audio[ii].artwork!=null) {
                  if (row.audio[ii].artwork.indexOf('://')==-1) {
                    row.audio[ii].artwork = config.nodeserver.r2_s3_domain + row.audio[ii].artwork;
                  }
                }
                delete row.audio[ii].surl;
                delete row.audio[ii].stime;
                delete row.audio[ii].id;
              }   
            }
                          
        }
        callback(rows);
        media.set(mediaUpdate);
      }
    } catch (error) {
      logger.log(error); 
      callback(false);
    } finally {
      if (conn) conn.end();
    }
};

posts.doLike = function (user_key, postId, callback) {
  user.getUser(user_key, function(userObj) {        
    if (userObj) {    
      posts.setLike(userObj.user_id, postId, function(result) {
        callback(result);
      });      
    } else {
      callback(false);
    }
  });  
}

posts.setLike = async function(userId, postId, callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const result = await conn.query(`INSERT IGNORE INTO ${config.nodeserver.db_djfan}.likes (user,post) VALUES (?,?)`,[parseInt(userId),parseInt(postId)]);          
    if (result.affectedRows==0) {
      const result = await conn.query(`DELETE FROM ${config.nodeserver.db_djfan}.likes WHERE user=? AND post=?`,[parseInt(userId),parseInt(postId)]);          
      callback({"result":true,"liked":false,"message":"unliked post"});
    }
    else
    {
      callback({"result":true,"liked":true,"message":"liked post"});
    }
  } catch (error) {
    logger.log(error); 
    callback({"result":false,"message":err});
  } finally {
    if (conn) conn.end();
  }  
}

posts.getMyLikes = function (user_key, postIds, callback) {
  postIds = postIds.split(',').map(Number);  
  if (postIds.length>30){
    callback(false);
  } else {
    user.getUser(user_key, function (result) {
      if (result) {
        posts.getLikes(result.user_id,postIds,function(result) {
          callback(result);
        });      
      } else {      
        callback(false);
      }    
    })  
  }
}

posts.getLikes = async function(userId,postIds,callback){
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `SELECT 
        JSON_ARRAYAGG(post) as posts
      FROM
        ${config.nodeserver.db_djfan}.likes       
      WHERE
        user = ?
          AND
        post IN (${postIds.join(',')})`,  
        [parseInt(userId)]       
      );          
    if (rows.length == 0) 
    { 
      callback([]);
    }
    else 
    {
      if (rows[0]['posts']==null){
        rows[0]['posts']=[];  
      }
      callback(rows[0]['posts']);
    }
  } catch (error) {
    logger.log(error);  
    callback(false);
  } finally {
    if (conn) conn.end();
  }  
}

posts.getDownloadLink = async function (params, callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();  
    let rows;
    if (params.admin_access) {
      rows = await conn.query(
        `SELECT 
          posts.id,
          posts.posttype_id,
          posts.accesslevel_id,
          (SELECT IF(transcoded_location='' OR transcoded_location='error',location,transcoded_location) FROM ${config.nodeserver.db_djfan}.post_audio WHERE posts_id=posts.id) AS audio,
          (SELECT IF(transcoded_location='' OR transcoded_location='error',location,transcoded_location) FROM ${config.nodeserver.db_djfan}.post_video WHERE posts_id=posts.id) AS video	     
        FROM 
          ${config.nodeserver.db_djfan}.posts 
        WHERE
          posts.id = ?      
        `,
        [parseInt(params.post_id)]
      );
    } else {
      rows = await conn.query(
        `SELECT 
          posts.id,
          posts.posttype_id,
          posts.accesslevel_id,
          (SELECT IF(transcoded_location='' OR transcoded_location='error',location,transcoded_location) FROM ${config.nodeserver.db_djfan}.post_audio WHERE posts_id=posts.id) AS audio,
          (SELECT IF(transcoded_location='' OR transcoded_location='error',location,transcoded_location) FROM ${config.nodeserver.db_djfan}.post_video WHERE posts_id=posts.id) AS video	     
        FROM 
          ${config.nodeserver.db_djfan}.posts 
        INNER JOIN
          ${config.nodeserver.db_djfan}.user_relations
        ON
          posts.user_id = user_relations.user_target
            AND
          user_relations.user_source = ?
            AND
          user_relations.accesslevel_id >= posts.accesslevel_id    
        WHERE
          posts.id = ?      
        `,
        [parseInt(params.user_id),parseInt(params.post_id)]
      );
    }
    if (rows.length == 0) {
      callback(false);
    } else {
      cloudflareParams = {};
      if (rows[0]['accesslevel_id']==1){
        cloudflareParams.bucket='djfan';
      }
      if (rows[0]['accesslevel_id']==2){
        cloudflareParams.bucket='djfan-lvl-2';
      }
      if (rows[0]['accesslevel_id']==3){
        cloudflareParams.bucket='djfan-lvl-3';
      }
      // audio
      if (rows[0]['posttype_id']==3){
        cloudflareParams.key = rows[0]['audio'];
        cloudflareParams.fileName = rows[0]['audio'].split("/").pop();                                   
      }
      // video
      if (rows[0]['posttype_id']==4){
        cloudflareParams.key = rows[0]['video'];
        cloudflareParams.fileName = rows[0]['video'].split("/").pop();                                   
      }           
      cloudflareParams.expiresIn = 60;
      cloudflareParams.download = true;        
      let downloadUrl = await cloudflare.getSignedUrl(cloudflareParams);
      if(downloadUrl==false || downloadUrl==''){
          callback(false);              
      } else {
          callback(downloadUrl);
      }        
    }
  } catch (error) {
      logger.log(error); 
      callback(false);    
  } finally {
      if (conn) conn.end();
  }            
};

module.exports = posts;