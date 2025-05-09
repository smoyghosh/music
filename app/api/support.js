const config = require("../../config");
const dbconnection = require("../dbconnection");
const logger = require("../logger");
const { v4: uuidv4 } = require("uuid");
const NodeCache = require("node-cache");
const serverCache = new NodeCache({ stdTTL: 500, checkperiod: 600 });

const support = {};

support.getToken = function(req, callback) {
    try {        
        let supportToken = serverCache.get('support_'+req.session.id);        
        if (supportToken) {
            callback({result:true,token:supportToken});    
            return;
        } else {
            let params = {token: uuidv4(), session_id: req.session.id};            
            support.createToken(params,function(result) {
                if (result){
                    serverCache.set('support_'+params.session_id,params.token);             
                    callback({result:true,token:params.token});    
                    return;
                } else{
                    callback({result:false});    
                    return;
                }
            });    
        }                
    } catch(error) {
        console.log( error );
        logger.log(error);
    }      
}

support.checkToken = async function(token, callback) {
    let conn;
    try {
      conn = await dbconnection.pool.getConnection();
      const rows = await conn.query(`
        SELECT 
            id
        FROM 
            ${config.nodeserver.db_djfan}.support_tokens 
        WHERE         
            token=? 
        LIMIT   
            0,1
        `,[token]);  
      if (rows.length == 1) { 
        callback({"result":true});
      } else {
        callback({"result":false});
      }    
    } catch (error) {
        logger.log(error);
        callback({"result":false});
    } finally {
        if (conn) conn.end();
    }
}

support.createToken = async function(params, callback) {   
    let dateTime = new Date().toJSON().slice(0, -1).replace('T',' ');
    let conn;  
    try {
      conn = await dbconnection.pool.getConnection();
      await conn.query(`
        INSERT ${config.nodeserver.db_djfan}.support_tokens  
            SET
            token=?, 
            created_at=?, 
            updated_at=?
        ON DUPLICATE KEY UPDATE        
            updated_at=?
            `,[
              params.token,
              dateTime, 
              dateTime, 
              dateTime
            ]);        
        callback(true);
    } catch (error) {
      logger.log(error);
      callback(false);
    } finally {
      if (conn) conn.end();
    }
  }
  
support.setFileUpload = async function (params, callback) {    
    let dateTime = new Date().toJSON().slice(0, -1).replace('T',' ');
    let conn;  
    try {
      conn = await dbconnection.pool.getConnection();
      await conn.query(`
        INSERT 
            ${config.nodeserver.db_djfan}.support_files  
        SET
            token=?, 
            location=?,
            original_name=?,
            created_at=?, 
            updated_at=?
            `,[
              params.token,
              params.location,
              params.original_name,
              dateTime, 
              dateTime, 
              dateTime
            ]);        
        callback(true);
    } catch (error) {
      logger.log(error);
      callback(false);
    } finally {
      if (conn) conn.end();
    }
}

support.deleteFileUpload = async function (params, callback) {    
    let conn;  
    try {        
        conn = await dbconnection.pool.getConnection();
        await conn.query(`DELETE FROM ${config.nodeserver.db_djfan}.support_files WHERE token=? AND original_name=?`,[params.token,params.original_name]);        
        callback({result:true});
    } catch (error) {
        logger.log(error);
        callback({result:false});
    } finally {
        if (conn) conn.end();
    }
}

support.setTicket = async function (params, callback) {    
    let dateTime = new Date().toJSON().slice(0, -1).replace('T',' ');
    /*
    if (!serverCache.get('support_'+params.session_id)) {
        callback({result:false,message:"no valid token"});
        return;
    }
    */
    /*
    if (params['g-recaptcha-response']==undefined) {
        callback({result:false,message:"no recaptcha"});
        return;
    } 
    */
    if (!params.user_type) {
        callback({result:false,message:"no user type"});
        return;
    }
    if (!params.subject) {
        callback({result:false,message:"no subject type"});
        return;
    }
    if (!params.description) {
        callback({result:false,message:"no description type"});
        return;
    }

    if (params.full_name == undefined) {
        params.full_name = '';
    }

    if (params.email == undefined) {
        params.email = '';
    }

    let conn;  
    try {        
        conn = await dbconnection.pool.getConnection();

        let rows = await conn.query(`SELECT id FROM ${config.nodeserver.db_djfan}.support_tickets WHERE token=?`,[params.token]);
        if (rows.length > 0) {
            callback({result:false,message:"ticket already exists"});
            return;    
        }

        conn = await dbconnection.pool.getConnection();
        let result = await conn.query(`
            INSERT 
                ${config.nodeserver.db_djfan}.support_tickets  
            SET
                token=?, 
                user_type=?,
                subject=?,
                description=?,
                full_name=?,
                email=?,
                user_key=?,
                user_id=?,
                created_at=?, 
                updated_at=?
                `,[
                params.token,
                params.user_type,
                params.subject,
                params.description,
                params.full_name,
                params.email,
                params.user_key,
                params.user_id,
                dateTime, 
                dateTime
                ]);                          
        if (result.insertId) {            
            serverCache.del('support_'+params.session_id); 
            callback({result:true,message:"ticket created",ticket_id:result.insertId.toString()});
            return;
        } else {
            callback({result:false,message:"failed to create ticket"});
            return;
        }
    } catch (error) {
        logger.log(error);
        callback({result:false});
    } finally {
        if (conn) conn.end();
    }
}

module.exports = support;