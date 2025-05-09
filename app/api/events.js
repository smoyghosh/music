const config = require("../../config");
const dbconnection = require("../dbconnection");
const logger = require("../logger");
const NodeCache = require("node-cache");
const serverCache = new NodeCache({ stdTTL: 900, checkperiod: 1000 });
const crypto = require('crypto')

const events = {};

events.get = async function (params = {}, callback) {  
  if (params.start == undefined ){
      params.start=0;}
  if (params.accesslevel_id == undefined ){
      params.accesslevel_id=1;}
  if (params.limit == undefined ){
      params.limit=10;}
  if (params.period == undefined ){
      params.period='';}  
  if (params.fan_id == undefined){
      params.fan_id = 0;}
  if (params.venue_id == undefined){
      params.venue_id = 0;}
  
  let eventCacheKey = 'event_'+crypto.createHash('md5').update(JSON.stringify(params)).digest('hex');
  let eventCache = serverCache.get(eventCacheKey);
  if (eventCache) {
    callback(eventCache); 
    return;  
  }

  let orderBy = 'events.id';
  let strQueryWhere = '';  
  let date = new Date().toJSON().slice(0, 10).replace('T', ' ');
  if (params.period=='upcoming') {
    strQueryWhere = " AND events.event_date >= '"+date+"'";     
    orderBy = 'events.event_date ASC';
  } 
  if (params.period=='past') {
    strQueryWhere = " AND events.event_date < '"+date+"'";     
    orderBy = 'events.event_date DESC';
  }   
  if (params.venue_id>0) {
    strQueryWhere = " AND events.venue_id = '"+parseInt(params.venue_id)+"'";     
  }   
  if (params.event_id!=undefined) {
    if (parseInt(params.event_id)) {
      strQueryWhere += " AND events.id = '"+params.event_id+"'";  
      params.cacheKey = params.event_id;              
    } else {
      let url = params.event_id.toLowerCase().replace(/[^a-z0-9-]/gi,'');
      strQueryWhere += " AND events.url = '"+url+"'";     
      params.cacheKey = url;
    }  
  }  

  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    let strQuery = `
      SELECT 
        events.id AS event_id, 
        events.id, 
        events.event_name,
        events.event_date,
        events.start_time,
        events.end_time,
        events.description,
        events.link_buy_tickets,
        events.artwork_cache AS artwork,
        events.venue, 
        events.city,        
        events.created_at, 
        events.updated_at,        
        events.url,        
        events.lineup,
        IFNULL(guest_list.guest_invite_number,0) AS guest_invite_number,
        IFNULL(guest_list.status_id,0) AS guest_list_status,
        DATE_FORMAT(guest_list.guest_invite_start, '%Y-%m-%dT%H:%i:%s.000Z') AS guest_invite_start,
        DATE_FORMAT(guest_list.guest_invite_end, '%Y-%m-%dT%H:%i:%s.000Z') AS guest_invite_end,        
        IFNULL(venues.id,0) AS venue_id,
        venues.name AS venue_name,
        venues.blurb AS venue_blurb,
        IF(venues.logo IS NULL,'',IF(venues.logo_cache='',venues.logo,venues.logo_cache)) AS venue_logo,
        IF(venues.photo IS NULL,'',IF(venues.logo_cache='',venues.logo,venues.photo_cache)) AS venue_photo,        
        venues.address AS venue_address,
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
        ${config.nodeserver.db_djfan}.user
      ON
        user.id=events.user_id        
      LEFT JOIN
        ${config.nodeserver.db_djfan}.event_djs
      ON
		    event_djs.event_id=events.id
      LEFT JOIN
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
          AND
        (events.user_id = ? OR event_djs.dj_id = ?)
        ${strQueryWhere}
      ORDER BY 
        ${orderBy}
      LIMIT ?,?`;    
    const rows = await conn.query(strQuery,[

        parseInt(params.user_id),
        parseInt(params.user_id),
        parseInt(params.user_id),
        parseInt(params.user_id), 
        parseInt(params.start), 
        parseInt(params.limit)
      ]);
    if (rows.length == 0) {
      callback([]);
    } else {
      for (let ii = 0; ii < rows.length; ii++) {
        rows[ii].artwork = config.nodeserver.r2_s3_domain + rows[ii].artwork;        
        if (rows[ii].venue_logo.length>20) {
          rows[ii].venue_logo = config.nodeserver.r2_s3_domain + rows[ii].venue_logo;
        } else {
          rows[ii].venue_logo ='';
        }
        if (rows[ii].venue_photo.length>20) {
          rows[ii].venue_photo = config.nodeserver.r2_s3_domain + rows[ii].venue_photo;
        } else {
          rows[ii].venue_photo ='';
        }
      }
      callback(rows);
      serverCache.get(eventCacheKey,rows);
    }
  } catch (error) {
    logger.log(error);
    callback([]);
  } finally {
    if (conn) conn.end();
  }
};

events.getGuestlist = async function (params = {}, callback,) { 
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(`
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
      `,
      [parseInt(params.event_id),parseInt(params.fan_id),parseInt(params.user_id)]
    );
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

events.getEventAvailablePasses = async function (params = {}, callback) {
  if (/[a-zA-Z]/.test(params.event_id)) {
    params.event_id = await events.getEventIdByEventKeyPromise(params.event_id);
  }   
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
    const rows = await conn.query(query,[parseInt(params.event_id),parseInt(params.dj_user_id)]);
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

events.setGuestlist = async function (params = {}, callback,) {   
  if (params.fan_id == undefined) {
      params.fan_id = 0;
  }
  if (params.signup == undefined) {
      params.signup = false;
  }
  if (params.eventurl == undefined) {
    params.eventurl = params.event_id;
  }
  params.status = params.signup?4:3;
  if (!parseInt(params.eventurl)) 
  {  
    events.getEventIdByUrl(params.eventurl,async function(event_id) {  
      if (!event_id) {
        callback({'result':false,"message":"error"});
        return;
      }
      params.event_id = event_id;      
      events.setGuestlistData(params,function(result) {
        callback(result);
        return;
      });   
    });
  } else {
    events.setGuestlistData(params,function(result) {
      callback(result);
      return;
    });   
  }
};

events.setGuestlistData = async function (params = {}, callback,) { 
  let date = new Date().toJSON().slice(0, -5).replace('T',' ');  
  let conn;
  try 
  {
      conn = await dbconnection.pool.getConnection();      
      const query = `
      UPDATE 
        ${config.nodeserver.db_djfan}.guest_list_names
      INNER JOIN
        ${config.nodeserver.db_djfan}.guest_list 
      ON 
        guest_list_names.guestlist_id = guest_list.id
      SET
        guest_list_names.status_id = ?,
        guest_list_names.updated_at = ?,
        guest_list_names.signup_date = ?            
      WHERE
        guest_list.event_id=? 
          AND
        guest_list_names.fan_id=?
          AND
        guest_list_names.status_id>=2 
          AND 
        guest_list_names.status_id<=4
      `;
      const res = await conn.query(query,[parseInt(params.status),date,date,parseInt(params.event_id),parseInt(params.fan_id)]);
      if (res.affectedRows>0) {
        callback({'result':true,"message":"update succesful"});   
      } else { 
        callback({'result':false,"message":"update failed","params":params});   
      }
  } catch (error) {
      logger.log(error);
      callback({'result':false,"message":"error"});
  } finally {
      if (conn) conn.end();
  }
};

events.getEventIdByUrl = async function(url,callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(`
      SELECT 
        id
      FROM
        ${config.nodeserver.db_djfan}.events
      WHERE
        url = ?
      LIMIT 
        0,1  
      `,
      [url]
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

events.getEventUrlById = async function(id,callback) {
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(`
      SELECT 
        url
      FROM
        ${config.nodeserver.db_djfan}.events
      WHERE
        id = ?
      LIMIT 
        0,1  
      `,
      [id]
    );
    if (rows.length == 0) {
      callback(false);
    } else {
      callback(rows[0]['url']);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
}

events.getEventUrlByIdPromise = function (id = 0) {
  return new Promise((resolve, reject) => {      
      events.getEventUrlById(id, function(result){
        if(result) {
          resolve(result);
        } else {
          reject(false)
        }
      });            
  });
};

events.getUserData = async function(params,callback) {  
  params.event_id = params.event_id.split(',').map(Number);
  let conn;
  try {
    conn = await dbconnection.pool.getConnection();
    const rows = await conn.query(`
      SELECT 
        JSON_ARRAYAGG (
          JSON_OBJECT (
              guest_list.event_id,guest_list_names.status_id
            )
          ) as data
      FROM
        ${config.nodeserver.db_djfan}.guest_list
      INNER JOIN
        ${config.nodeserver.db_djfan}.guest_list_names
      ON 
        guest_list.id = guest_list_names.guestlist_id
      WHERE
        guest_list_names.fan_id  = ?
          AND
        guest_list.event_id IN (${params.event_id.join(',')})`,  
      [parseInt(params.user_id)]          
    );
    if (rows.length == 0) {
      callback([]);
    } else {
      if (rows[0]['data']==null){
        rows[0]['data']=[];  
      }
      callback(rows[0]['data']);
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }
};

events.getEventIdByEventKey = async function (params, callback) {
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

events.getEventIdByEventKeyPromise = function (key = '') {
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

module.exports = events;
