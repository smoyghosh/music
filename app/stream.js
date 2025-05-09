// const StreamChat = require("stream-chat"); 
const config = require("../config");
const dbconnection = require("./dbconnection");
const streamChat = require('stream-chat').StreamChat;
const serverClient = streamChat.getInstance(config.nodeserver.stream_api_key,config.nodeserver.stream_api_secret);
const stream = {};
const logger = require("./logger");

stream.getUserToken = async function (params, callback) {
    try {
        const token = serverClient.createToken(params.user_id.toString(), Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30));
        if (token) {
            callback({"result":true,"token":token});
        } else {
            callback({"result":false,"message":"error 1"});
        }
    } catch (error) {
        logger.log(error);
        callback({"result":false,"message":"error 2"});
    } 
}

stream.revokeUserToken = async function (params, callback) {
    try {
        let result = await serverClient.revokeUserToken(params.user_id.toString(), revokeDate);
        if (result) { 
            callback({"result":false});
        } else {
            callback({"result":false,"message":"error 1"});
        }
    } catch (error) {
        logger.log(error);
        callback({"result":false,"message":"error 2"});
    } 
}

stream.unreadMessages = async function (params, callback) {
    stream.getFanChannels(params, async function(channels) {
        if (!channels) {
            return callback({"result":true,"messages":0});
        }        
        if (channels.length==0) {
            return callback({"result":true,"messages":0});
        }        

        try {
            const filter2 = {id:{$in:[params.fan_id.toString()]}};
            let result2 = await serverClient.queryUsers(filter2);
            console.log(result2);
            return callback({"result":true,"messages":0});

            // const response = await client.queryUsers({ id: { $in: ['john', 'jack', 'jessie'] } });

            const filter = {type:'messaging',members:{$in:[params.fan_id.toString()]},id:{$in:channels}};
            let result = await serverClient.queryChannels(filter);
            

            console.log('result',result[0].id);
            for (const [key, value] of Object.entries(result[0])) {
                console.log(`${key}: ${value}`);
            }

            console.log("\n\n");

            console.log('result',result[0].id);
            for (const [key, value] of Object.entries(result[1])) {
                console.log(`${key}: ${value}`);
            }

              
            // console.log(result)
            if (result) { 
                callback({"result":false,"result":"ok"});
            } else {
                callback({"result":false,"message":"error 1"});
            }
        } catch (error) {
            logger.log(error);
            console.log(error);
            callback({"result":false,"message":"error 2"});
        } 
    });
}

stream.getFanChannels = async function (params, callback) { 
    let conn;
    try {
      conn = await dbconnection.pool.getConnection();
      const rows = await conn.query(`
        SELECT 
            (SELECT JSON_ARRAYAGG(channel_id)) AS channels
        FROM 
            ${config.nodeserver.db_djfan}.stream_direct_messaging_channels 
        WHERE 
            fan_id=?
                AND 
            remove=0      
      `,[parseInt(params.fan_id)]);
    if (rows.length == 0) {
      callback([]);
    } else {
      callback( rows[0]['channels'] );
    }
  } catch (error) {
    logger.log(error);
    callback(false);
  } finally {
    if (conn) conn.end();
  }    
}


module.exports = stream;
