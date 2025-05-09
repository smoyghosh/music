const config = require("../../config");
const dbconnection = require("../dbconnection");
const logger = require("../logger");

const media = {};

media.set = async function(media){
    let conn;
    try {    
        conn = await dbconnection.updatePool.getConnection();
        let query = "";
        if (Object.keys(media.image).length>0) {
            for (const [key, value] of Object.entries(media.image)) {
                query += `UPDATE ${config.nodeserver.db_djfan}.post_image SET signed_url='${value.surl}', signed_timestamp='${value.stime}' WHERE id='${key}';`
            }        
        }

        if (Object.keys(media.audio).length>0) {
            for (const [key, value] of Object.entries(media.image)) {
                query += `UPDATE ${config.nodeserver.db_djfan}.post_audio SET signed_url='${value.surl}', signed_timestamp='${value.stime}' WHERE id='${key}';`
            }        
        }

        if (Object.keys(media.video).length>0) {
            for (const [key, value] of Object.entries(media.image)) {
                query += `UPDATE ${config.nodeserver.db_djfan}.post_video SET signed_url='${value.surl}', signed_timestamp='${value.stime}' WHERE id='${key}';`
            }        
        }
        if(query!=""){
            conn.query(query);
        };            
    } catch (error) {
        logger.log(error); 
    } finally {
        if (conn) conn.end();
    }
}

module.exports = media;
