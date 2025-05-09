const config = require("../../config");
const dbconnection = require("../dbconnection");
const scanner = {};
const logger = require("../logger");

// later promise with backstage pass and or tickets 
scanner.validateQRcode = async function (params={}, callback) {  
    let conn;
    try {    
      params.scan_date = new Date().toJSON().slice(0, 19).replace('T', ' ');
      conn = await dbconnection.pool.getConnection();    
      const rows = await conn.query(
        `
        SELECT 
          events.event_name,
          DATE_FORMAT(events.event_date, '%Y-%m-%d') AS event_date,       
          events.venue,              
          (
            SELECT 
              JSON_OBJECT (         
                'scan_date',IFNULL(guest_list_names.scan_date,''),        
                'status',guest_list_names.status_id,
                'name',guest_list_names.name
              )
            FROM
              ${config.nodeserver.db_djfan}.guest_list_names 
            INNER JOIN
              ${config.nodeserver.db_djfan}.guest_list 
            ON
              guest_list.id = guest_list_names.guestlist_id
          WHERE                  
            guest_list_names.code=? 
              AND
            guest_list.event_id=?
          ) AS guestlist,
          null AS backstagelist             
        FROM 
          ${config.nodeserver.db_djfan}.events 
        WHERE                  
          events.id=? 
        LIMIT 
          0,1
          `,
        [params.qrcode,parseInt(params.event_id),parseInt(params.event_id)]
      );       
      if (rows.length == 0) {
        callback({"result":false});
        return;
      } else {
        if (rows[0]['guestlist']!=null){
          rows[0]['type']='guestlist';
          if (rows[0]['guestlist']['scan_date']=='') {
            rows[0]['guestlist']['used']=false;
            const result = await conn.query(`
              UPDATE         
                ${config.nodeserver.db_djfan}.guest_list_names 
              INNER JOIN
                ${config.nodeserver.db_djfan}.guest_list 
              ON
                guest_list.id = guest_list_names.guestlist_id
              SET
                scan_date=?
              WHERE                  
                guest_list_names.scan_date IS NULL
                  AND
                guest_list_names.code=? 
                  AND
                guest_list.event_id=?          
              `,[params.scan_date,params.qrcode,parseInt(params.event_id)]);   
            if (result.affectedRows>0) {
              rows[0]['guestlist']['confirmed']=true;
            } else {
              rows[0]['guestlist']['confirmed']=false;
            }                     
          } else {
            rows[0]['guestlist']['used']=true;
          }
        }
        if (rows[0]['backstagelist']!=null) {
          rows[0]['type']='backstagelist';
          if (rows[0]['backstagelist']['scan_date']=='') {
            rows[0]['backstagelist']['used']=false;
          } else {
            rows[0]['backstagelist']['used']=true;
          }
        }      
        callback(rows[0]);
        return;
      }       
    } catch (error) {
      logger.log(error);
      callback({"result":false});
    } finally {
      if (conn) conn.end();
    }
  };
  
  module.exports = scanner;