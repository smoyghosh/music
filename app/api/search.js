const config = require("../../config");
const dbconnection = require("../dbconnection");
const logger = require("../logger");

const search = {};

search.search = function(params, callback) {
    try {        
        if (params.query == undefined ){
            callback([]);
            return;    
        }        
        if (params.query.length < 3 ){
            callback([]);
            return;    
        }        
        if (params.start == undefined ){
            params.start=0;}
        if (params.limit == undefined ){
            params.limit=10;}
        if (params.type == undefined ){
            params.type='artist';}    
        if (params.startdate == undefined ){
            params.startdate='';}        
        if (params.enddate == undefined ){
            params.enddate='';}                
            
        search.doSearch(params, function(result) {        
            callback(result);
            return;
        });

    } catch(error) {
        logger.log(error);
        callback([]);
    }      
}
  
search.doSearch = async function(params, callback) {    
    let conn;
    try {
        let rows;
        conn = await dbconnection.pool.getConnection();
        if (params.type=='artist') {
            rows = await conn.query(`
                SELECT 
                    profile_dj.user_id,
                    profile_dj.profile_url,
                    profile_dj.display_name,
                    profile_dj.profile_picture,
                    profile_dj.cover_photo,
                    profile_dj.genre,
                    profile_dj.location,
                    profile_dj.country
                FROM 
                    ${config.nodeserver.db_djfan}.profile_dj
                INNER JOIN
                    ${config.nodeserver.db_djfan}.user
                ON
                    profile_dj.user_id=user.id
                WHERE
                    CONCAT(profile_dj.profile_url,' ',profile_dj.display_name) LIKE ?
                        AND
                    user.active=1        
                        AND
                    profile_dj.active=1        
                ORDER BY 
                    profile_dj.user_id DESC  
                LIMIT ?,?
            `,['%'+params.query+'%',parseInt(params.start), parseInt(params.limit)]);      
        }
        if (params.type=='event') {

            let queryParams = [];
            let queryWhere = "";
            arrQuery = decodeURI(params.query).split(' '); 
            for (let a = 0; a < arrQuery.length; a++) {
                queryParams.push('%'+arrQuery[a].trim()+'%');
                queryWhere += " AND CONCAT(profile_dj.display_name,' ',events.event_name,' ',events.venue,' ',events.city) LIKE ? ";                
            }        
            if (params.startdate.length>0) {
                queryWhere += " AND event_date>=? ";                
                queryParams.push(params.startdate);
            }        
            if (params.enddate.length>0) {
                queryWhere += " AND event_date<=? ";                
                queryParams.push(params.enddate);
            }                        
            
            queryParams.push(parseInt(params.start));
            queryParams.push(parseInt(params.limit));

            rows = await conn.query(`
                SELECT 
                    profile_dj.user_id,
                    profile_dj.profile_url,
                    profile_dj.display_name,
                    profile_dj.profile_picture,
                    profile_dj.cover_photo,
                    events.event_name,
                    events.venue,
                    events.city,
                    events.event_date, 
                    events.start_time, 
                    events.end_time
                FROM 
                    ${config.nodeserver.db_djfan}.profile_dj
                INNER JOIN
                    ${config.nodeserver.db_djfan}.events                    
                ON
                    profile_dj.user_id=events.user_id
                INNER JOIN
                    ${config.nodeserver.db_djfan}.user
                ON
                    profile_dj.user_id=user.id                    
                WHERE
                    user.active=1        
                        AND
                    profile_dj.active=1    
                    ${queryWhere}
                ORDER BY 
                    event_date DESC  
                LIMIT ?,?
            `,queryParams);                  
        }         
        if (rows.length == 0) 
        { 
            callback([]);
        }
        else 
        {
            callback(rows);
        }
    } catch (error) {
        logger.log(error);
        callback(false);
    } finally {
        if (conn) conn.end();
    }      
}

module.exports = search;