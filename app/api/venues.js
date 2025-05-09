const config = require("../../config");
const dbconnection = require("../dbconnection");
const logger = require("../logger");
const NodeCache = require("node-cache");
const serverCache = new NodeCache({ stdTTL: 900, checkperiod: 1000 });
const sequelizeVenueUserModel = require("../models/venueUser"); 
const sequelizeUserModel = require("../models/user"); 
const sequelizeVenueModel = require("../models/venue"); 
const venues = {};

venues.get = async function (params = {}, callback) {  
  
  let strQueryWhere = '';
  let queryParams = [];
  if (params.start == undefined ){
    params.start=0;
  }
  if (params.limit == undefined ){
    params.limit=10;
  }  
  if (params.url == undefined ){
    params.url='';
  }
  if (params.url=='') {
    params.cacheKey = `venues_${params.start}_${params.limit}`;
  } else {
    params.cacheKey = `venues_${params.url}`;
    strQueryWhere += " AND venues.url = ? ";     
    queryParams.push(params.url);
  }

  let venuesCache = serverCache.get(params.cacheKey);   
  if (venuesCache) {
    callback(venuesCache); 
    return;  
  }

  queryParams.push(parseInt(params.start));
  queryParams.push(parseInt(params.limit));

  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(
      `SELECT 
        venues.name, 
        venues.website, 
        venues.capacity, 
        venues.blurb,
        venues.address, 
        IF(venues.logo IS NULL,'',IF(venues.logo_cache='',venues.logo,venues.logo_cache)) AS logo,
        IF(venues.photo IS NULL,'',IF(venues.photo_cache='',venues.photo,venues.photo_cache)) AS photo,        
        (SELECT name FROM ${config.nodeserver.db_djfan}.countries WHERE id=venues.country_id) AS country, 
        url
      FROM 
        ${config.nodeserver.db_djfan}.venues         
      WHERE      
        venues.active=1
          AND
        venues.viewable=1         
        ${strQueryWhere}
      ORDER BY 
        venues.featured DESC  
      LIMIT ?,?`,queryParams);
    if (rows.length == 0) {
      callback([]);
    } else {
      for (let ii = 0; ii < rows.length; ii++) {       
        if (rows[ii].logo.indexOf('https://')==-1 ) {
          rows[ii].logo = config.nodeserver.r2_s3_domain + rows[ii].logo;
        }
        if (rows[ii].photo.indexOf('https://')==-1 ) {
          rows[ii].photo = config.nodeserver.r2_s3_domain + rows[ii].photo;
        } 
      }
      callback(rows);
      serverCache.set(params.cacheKey,rows);
    }
  } catch (error) {
    logger.log(error);
    callback([]);
  } finally {
    if (conn) conn.end();
  }
};

venues.getVenueIdByUrl = async function (url, callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(`SELECT id FROM ${config.nodeserver.db_djfan}.venues WHERE url=? LIMIT 0,1`,[url]);
    if (rows.length == 0) {
      callback(false);
    } else {
      callback(rows[0]['id']);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

venues.getVenueIdByUrlPromise = function (url = 0) {
  return new Promise((resolve, reject) => {      
      events.getVenueIdByUrl(url, function(result){
        if(result) {
          resolve(result);
        } else {
          reject(false)
        }
      });            
  });
};

venues.getEvents = async function (params = {}, callback) {
  if (parseInt(params.venue)) {    
    venues.getEventsData(params, function(result){
      callback(result); 
    });
  } else {
    venues.getVenueIdByUrl(params.venue, function(venueId){ 
      if (venueId) {
        params.venue_id = venueId 
        venues.getEventsData(params, function(result){
          callback(result); 
        });
      } else {
        callback(false);
      } 
    });
  }
};

venues.getEventAvailablePasses = async function (params = {}, callback) {
  if (/[a-zA-Z]/.test(params.venue_id)) {
    params.venue_id = await events.getVenueIdByUrlPromise(params.venue_id);
  } 
  if (/[a-zA-Z]/.test(params.event_id)) {
    params.event_id = await events.getEventIdByUrlPromise(params.event_id);
  } 
  params.venue_user_id = venues.getMainUser(params); 
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const query = `
      SELECT 
        IFNULL(SUM(IF(guest_list_names.status_id=4,1,0)),0) AS signed,
        IFNULL(guest_list.guest_invite_number,0) AS total
      FROM 
        ${config.nodeserver.db_djfan}.guest_list_names 
      INNER JOIN
        ${config.nodeserver.db_djfan}.guest_list
      ON
        guest_list.id = guest_list_names.guestlist_id    
      WHERE
        guest_list.event_id=?
          AND
        guest_list.user_id=?  
          AND
        guest_list.status_id=1
      LIMIT 
        0,1  
        `;           
    const rows = await conn.query(query,[parseInt(params.event_id),parseInt(params.venue_user_id)]);
    if (rows.length == 0) {
      callback({result:false});
    } else {
      callback({result:true,data:rows[0]});
    }      
  } catch (error) {
    console.log(error);
    logger.log(error);
    callback({result:false});
  } finally {
    if (conn) conn.end();
  }
}

venues.getEventsData = async function (params = {}, callback) {    
  if (params.start == undefined ){
      params.start=0;}
  if (params.limit == undefined ){
      params.limit=10;}
  if (params.period == undefined ){
      params.period='';}  
  if (params.venue_id == undefined){
      params.venue_id = 0;}
  
  let strQueryWhere = '';  
  let currentDate = new Date();    
  let strOrderby = 'events.id';

  if (params.venue_id>0) {
    strQueryWhere += " AND venue_id = '"+parseInt(params.venue_id)+"'";     
  } 
  params.orderby = "event_date";  
  if (params.period == "past"){ 
    strOrderby = " events.event_date DESC ";
    currentDate.setDate(currentDate.getDate() );
    strQueryWhere += ` AND events.event_date < '${currentDate.toISOString().split('T')[0]}' `;      
  }
  if (params.period == "upcoming"){
    strOrderby = " events.event_date ASC ";
    currentDate.setDate(currentDate.getDate() - 1);
    strQueryWhere += ` AND events.event_date >= '${currentDate.toISOString().split('T')[0]}' `;      
  }   

  params.user_id = await venues.getMainUser({venue_id: params.venue_id});

  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const query = `SELECT 
      events.id AS event_id, 
      events.id, 
      events.venue_id, 
      events.event_name,
      events.event_date,
      events.start_time,
      events.end_time,
      events.description,
      events.link_buy_tickets,        
      IFNULL((SELECT profile_url FROM ${config.nodeserver.db_djfan}.profile_dj WHERE user_id=events.user_id),'') AS dj_profile_url,
      IFNULL(events.artwork_cache,'') AS artwork,
      events.venue, 
      events.city,        
      IFNULL(guest_list.guest_invite_number,0) AS guest_invite_number,
      IFNULL(guest_list.status_id,0) AS guest_list_status,
      DATE_FORMAT(guest_list.guest_invite_start, '%Y-%m-%dT%H:%i:%s.000Z') AS guest_invite_start,
      DATE_FORMAT(guest_list.guest_invite_end, '%Y-%m-%dT%H:%i:%s.000Z') AS guest_invite_end,
      events.created_at, 
      events.updated_at,        
      events.url,
      events.lineup,
      (
        SELECT 
          (IFNULL(guest_list.guest_invite_number,0) - IFNULL(SUM(IF(guest_list_names.status_id=4,1,0)),0)) AS available             
        FROM 
          ${config.nodeserver.db_djfan}.guest_list
        LEFT JOIN
          ${config.nodeserver.db_djfan}.guest_list_names 
        ON
          guest_list.id = guest_list_names.guestlist_id    
        WHERE
          guest_list.event_id=events.id 
            AND
          guest_list.user_id=?  
            AND
        guest_list.status_id=1
      ) AS guestlist_available          
    FROM 
      ${config.nodeserver.db_djfan}.events 
    INNER JOIN
      ${config.nodeserver.db_djfan}.venues
    ON
      venues.id=events.venue_id
    LEFT JOIN 
      ${config.nodeserver.db_djfan}.guest_list
    ON
      events.id=guest_list.event_id AND guest_list.user_id=? AND guest_list.status_id>0 AND guest_list.status_id<10         
    WHERE      
      events.remove = 0
        AND
      events.publish = 1        
      ${strQueryWhere}
    ORDER BY 
      ${strOrderby} 
    LIMIT ?,?`;
    const rows = await conn.query(query,[params.user_id, params.user_id, parseInt(params.start), parseInt(params.limit)]);
    if (rows.length == 0) {
      callback([]);
    } else {
      for (let ii = 0; ii < rows.length; ii++) {      
        if (rows[ii].artwork.indexOf('https://')==-1 ) {
          rows[ii].artwork = config.nodeserver.r2_s3_domain + rows[ii].artwork;
        } 
      }
      callback(rows);
    }
  } catch (error) {
    logger.log(error);
    callback([]);
  } finally {
    if (conn) conn.end();
  }
};

venues.getVenueUser = async function (params={}, callback) {
  try {
    sequelizeVenueUserModel.belongsTo(sequelizeVenueModel,{foreignKey:{name:'venue_id'}});    
    sequelizeVenueUserModel.belongsTo(sequelizeUserModel,{foreignKey:{name:'user_id'}});    
    await sequelizeVenueUserModel.sync();

    const venueUser = await sequelizeVenueUserModel.findAll({            
      orderby: 'main DESC',
      limit: 1,
      include: [
      {
        model: sequelizeVenueModel,
        required: true,
        where: {
          url: params.venueurl
        },
      },
      ],     
    });
    if (callback == undefined) {
      if (venueUser.length>0) {
        return venueUser[0].user_id;
      }
      return 0;  
    } else {
      if (venueUser.length>0) {
        return callback(venueUser[0].user_id);
      }
      return callback(0);      
    }
  } catch (error) {
    logger.log(error);
    callback(0);
  }
};

venues.getMainUser = async function (params={}) {
  const mainUser = await sequelizeVenueUserModel.findAll({            
    orderby: 'main DESC',
    limit: 1,
    where: {
      venue_id: params.venue_id
    },
  });
  if (mainUser.length>0) {
    return mainUser[0].user_id;
  }
  return 0;
};

venues.getEventArtists = async function (params={}, callback) { 
  let conn;
  try {
      conn = await dbconnection.pool.getConnection();
      const rows = await conn.query(`
        SELECT 
          event_djs.dj_name,
          IFNULL(user.id,0) AS user_id,
          IFNULL(user.display_name,'') AS display_name,
          IFNULL(user.user_key,'') AS user_key,
          IFNULL(profile_dj.profile_url,'') AS profile_url,
          IFNULL(profile_dj.profile_picture_cache,'') AS profile_picture,
          IFNULL(profile_dj.cover_photo_cache,'') AS cover_photo      
        FROM  
          ${config.nodeserver.db_djfan}.event_djs  
        LEFT JOIN
          ${config.nodeserver.db_djfan}.profile_dj  
        ON
          event_djs.dj_id = profile_dj.user_id
        LEFT JOIN
          ${config.nodeserver.db_djfan}.user
        ON
          event_djs.dj_id = user.id
        WHERE 
          event_djs.event_id = ? 
        ORDER BY 
          display_name
        `,[params.event_id]); 
      if (rows.length == 0) { 
          callback({"result":false});        
      } else {
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].profile_picture!='') {
            rows[i].profile_picture = config.nodeserver.r2_s3_domain + rows[i].profile_picture;
          }
          if (rows[i].cover_photo!='') {
            rows[i].cover_photo = config.nodeserver.r2_s3_domain + rows[i].cover_photo;
          }
        }
        callback({"result":true,"data":rows});
      }          
    } catch (error) {
      logger.log(error);
      callback({"result":false});
    } finally {
      if (conn) conn.end();
    }      
};

venues.doConnect = function(params, callback) {
  venues.getVenueIdByUrl(params.venue, function(venue_id) {        
    if (venue_id) {    
      params.venue_id = venue_id;
      venues.setConnect(params, function(result) {
        callback(result);
      });      
    } else {
      callback(false);
    }
  });
}

venues.setConnect = async function(params, callback) {
  let conn;
  try {
    params.created_at = new Date().toJSON().slice(0, 19).replace('T', ' ');
    params.updated_at = new Date().toJSON().slice(0, 19).replace('T', ' ');
    conn = await dbconnection.pool.getConnection();
    const result = await conn.query(`INSERT IGNORE INTO ${config.nodeserver.db_djfan}.user_relations (user_source,user_target,type,created_at,updated_at) VALUES (?,?,?,?,?)`,[params.user_id,params.venue_id,2,params.created_at,params.updated_at]);          
    if(result.affectedRows==0){
      const result = await conn.query(`DELETE FROM ${config.nodeserver.db_djfan}.user_relations WHERE accesslevel_id=1 AND user_source=? AND user_target=? AND type=2`,[params.user_id,params.venue_id]);          
      if (result){
        callback({"result":true,"connected":false,"message":"disconnected"});
      }else{
        callback({"result":true,"connected":true,"message":"unsubscribed, can't disconnected"});
      }      
    }
    else{
      callback({"result":true,"connected":true,"message":"connected"});
    }
  } catch (error) {
    logger.log(error);    
    callback({"result":false,"message":error});
  } finally {
    if (conn) conn.end();
  }  
}
 
venues.updateConnect = async function(params, callback) { 
  let conn;
  try {
      params.updated_at = new Date().toJSON().slice(0, 19).replace('T', ' ');
      conn = await dbconnection.pool.getConnection();
      await conn.query(`
        UPDATE 
          ${config.nodeserver.db_djfan}.user_relations 
        SET 
          accesslevel_id=?, 
          updated_at=? 
        WHERE 
          user_source=? 
            AND 
          user_target=? 
            AND
          type=2
          `,[parseInt(params.accesslevelId),params.updated_at,parseInt(params.user_id),parseInt(params.venue_id)]);          
      callback(true);
  } catch (error) {
      logger.log(error);
      callback(false);
  } finally {
      if (conn) conn.end();
  }     
}

venues.getGuestlist = async function (params = {}, callback,) { 
  // console.log('params',params);
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const query = `
    SELECT 
      guest_list_names.status_id, 
      IF(guest_list_names.status_id>=8,guest_list_names.code,'') AS code 
    FROM
      ${config.nodeserver.db_djfan}.events
    INNER JOIN
      ${config.nodeserver.db_djfan}.guest_list 
    ON 
      events.id = guest_list.event_id
    INNER JOIN
      ${config.nodeserver.db_djfan}.guest_list_names 
    ON 
      guest_list_names.guestlist_id = guest_list.id
    WHERE
      guest_list.event_id = ?
        AND 
      guest_list_names.fan_id = ?    
        AND 
      guest_list.user_id = ?      
    `;
    const rows = await conn.query(query,[parseInt(params.event_id),parseInt(params.fan_id),parseInt(params.user_id)]);
    if (rows.length == 0) {
      callback({'result':true,'guestlist':false,"params":params});
    } else {
      /*
      '0' => 'created but not started yet',
      '1' => 'failed invite',
      '2' => 'send invite',
      '3' => 'fan set no',
      '4' => 'fan set yes',
      '5' => 'off the list',
      '6' => 'on the initial list',
      '7' => 'off the initial list',
      '8' => 'on the real list',
      '9' => 'failed informed off list',
      '10' => 'failed informed on list',
      '11' => 'informed about off the list',
      '12' => 'informed about on the list',
      */

      let status = '';
      let allowChange = false;
      if (rows[0]['status_id']<1) {
        status = 'not-stared';
      }
      if (rows[0]['status_id']==2||rows[0]['status_id']==3) {
        status = 'not-signed-up';
      }
      if (rows[0]['status_id']>=4) {
        status = 'signed-up';
      }
      if (rows[0]['status_id']==6) {
        status = 'on-short-list';
      }
      if (rows[0]['status_id']==8||rows[0]['status_id']==10||rows[0]['status_id']==12) {
        status = 'on-list';
      }
      if (rows[0]['status_id']==5||rows[0]['status_id']==7||rows[0]['status_id']==9||rows[0]['status_id']==11) {
        status = 'off-list';
      }
      if (rows[0]['status_id']>=1 && rows[0]['status_id']<=4) {
        allowChange = true;
      }
      if (rows[0]['status_id']<1 || rows[0]['status_id']>4) {
        allowChange = false;
      }    
      callback({'result':true,'guestlist':true,'status':status,'allow-change':allowChange,code:rows[0]['code'],'status_id':rows[0]['status_id']});
    }
  } catch (error) {
    logger.log(error);
    callback({'result':false});
  } finally {
    if (conn) conn.end();
  }
}

venues.getEventIdByUrl = async function (params, callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(`
      SELECT 
        id
      FROM
        ${config.nodeserver.db_djfan}.events
      WHERE
        event_key = ?
      `, [params.event_key]          
    );
    if (rows.length == 0) {
      callback(false);
    } else {
      callback(rows[0]['id']);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
}

venues.getEventIdByUrlPromise = function (key = '') {
  return new Promise((resolve, reject) => {      
      events.getEventIdByEventKey(key, function(result){
        if(result) {
          resolve(result);
        } else {
          reject(false)
        }
      });            
  });
};

module.exports = venues;