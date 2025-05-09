const config = require("../../config");
const dbconnection = require("../dbconnection");
const sequelizeSubscriptionModel = require("../models/subscription");
const djprofile = require("./djprofile");
const cloudflare = require("../cloudflare");
const events = require("./events");
const stripeHandler = require("../stripe");
const logger = require("../logger");
const products = {};

// const formatter = (new Intl.NumberFormat('en-US', {style: 'currency',currency: 'USD',})).format(500/100);

products.get = async function (params, callback) {
    let conn;
    try {
        let arrQueryValues = [];
        let strQueryWhere = "";
        if (params.seach != undefined) {
            for (const [key, value] of Object.entries(params.seach)) {        
                if (key=='dj_name') { // Fix column name
                    try {
                        params.seach['user_id'] = await djprofile.getUserIdPromise(value);
                        delete params.seach[key];      
                    } catch (err) {      
                        callback(false);
                        return;
                    }                  
                }
            }
            for (const [key, value] of Object.entries(params.seach)) {     
                if (value!=0) {
                    if (key=='type') {
                        let tmpValue = value.toString().replace(/[^0-9,]/g, '');
                        strQueryWhere += ` AND type IN (${tmpValue}) `;
                    } else {
                        strQueryWhere += ` AND ${key} = ? `;
                        arrQueryValues.push(value);
                    }        
                }
            }    
        }
        arrQueryValues.push(parseInt(params.start));
        arrQueryValues.push(parseInt(params.limit));    
      conn = await dbconnection.pool.getConnection();  
      const rows = await conn.query(
        `SELECT 
            id, 
            created_at, 
            updated_at, 
            accesslevel_id, 
            user_id, 
            name, 
            active, 
            default_price,
            price,  
            description, 
            image_url, 
            sku,
            type,
            product_type,
            (
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'location',location, 
                    'artwork',IF(artwork_cache='',artwork,artwork_cache), 
                    'label',label, 
                    'artist',artist, 
                    'release_name',release_name,
                    'release_date',release_date, 
                    'genre',genre,
                    'sample',sample
                )) FROM ${config.nodeserver.db_djfan}.products_audio WHERE product_id=products.id
            ) AS audio,
            (
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'location',location, 
                    'artwork',IF(artwork_cache='',artwork,artwork_cache), 
                    'sample',sample
                )) FROM ${config.nodeserver.db_djfan}.products_video WHERE product_id=products.id
            ) AS video,
            (
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'location',location, 
                    'artwork',IF(artwork_cache='',artwork,artwork_cache)
                )) FROM ${config.nodeserver.db_djfan}.products_podcast WHERE product_id=products.id
            ) AS podcast,
            (
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'location',location, 
                    'artwork',IF(artwork_cache='',artwork,artwork_cache) 
                )) FROM ${config.nodeserver.db_djfan}.products_file WHERE product_id=products.id
            ) AS file,
            (SELECT IFNULL(1,0) FROM ${config.nodeserver.db_djfan}.user_products WHERE user_key='${params.user_key}' AND product_id=products.id LIMIT 0,1) AS purchased    
        FROM 
          ${config.nodeserver.db_djfan}.products 
        WHERE
            1=1
            ${strQueryWhere}
                AND
            default_price <> ''
                AND
            default_price IS NOT NULL
                AND
            active=1    
                AND
            remove = 0
                AND
            publish = 1
        ORDER BY 
            created_at DESC  
        LIMIT ?,?`,
        arrQueryValues
      );
      if (rows.length == 0) {
        callback([]);
        return;
      } else {
        for (let i = 0; i < rows.length; i++) {
            let row = rows[i];   
            if (row.default_price!=null && row.default_price!='') {           
                row.default_price = JSON.parse(row.default_price);
            }   
            let cloudflareParams;
            if (row.audio != null) {    
                for (let ii = 0; ii < row.audio.length; ii++) {
                    row.audio[ii].artwork = config.nodeserver.r2_s3_domain + row.audio[ii].artwork;

                    cloudflareParams={};
                    cloudflareParams.key = row.audio[ii].sample; 
                    cloudflareParams.bucket='djfan-products';                                 
                    row.audio[ii].sample = await cloudflare.getSignedUrl(cloudflareParams);

                    /*
                        if ((stimeNow + config.nodeserver.surl_time_margin > row.audio[ii].stime || row.audio[ii].surl == null) && row.audio[ii].location.length>0){                  
                            cloudflareParams.key = row.audio[ii].location;                                   
                            row.audio[ii].stime = stimeNow + 600;
                            mediaUpdate['audio'][row.audio[ii].id] = {"surl":row.audio[ii].surl,"stime":row.audio[ii].stime}; 
                        }
                        row.audio[ii].location = row.audio[ii].surl;
                        if (row.audio[ii].location.indexOf('://')==-1){
                            row.audio[ii].location = config.nodeserver.r2_s3_domain + row.audio[ii].location;
                        }
                    */

                }                
            }                                  
        }
        callback(rows);
        return;
      }
    } catch (error) {
      logger.log(error);
      callback(false);
      return;
    } finally {
      if (conn) conn.end();
    }    
};

products.getMembershipProduct = async function (params, callback) {
    let conn;
    try {
      conn = await dbconnection.pool.getConnection();  
      const rows = await conn.query(
        `SELECT 
            products.id as product_id,
            products.stripe_price_id,
            products.product_type,
            products.type 
        FROM 
            ${config.nodeserver.db_djfan}.products 
        INNER JOIN
            ${config.nodeserver.db_djfan}.profile_dj 
        ON
            products.user_id = profile_dj.user_id
        WHERE
            profile_url=?
                AND
            accesslevel_id=?
                AND
            product_type = 'subscription'    
        LIMIT 
            0, 1    
        `,
        [params.djname,params.accesslevel_id]
      );
      if (rows.length == 0) {
        callback(false);
        return;
      } else {
        callback(rows[0]);
        return;
      }
    } catch (error) {
        logger.log(error);        
        callback(false);
    } finally {
      if (conn) conn.end();
    }    
};

products.getTrialProductByDjUserId = async function (userId, callback) {
    let conn;
    try {
      conn = await dbconnection.pool.getConnection();  
      const rows = await conn.query(
        `SELECT 
            products.id
        FROM 
            ${config.nodeserver.db_djfan}.products            
        INNER JOIN
            ${config.nodeserver.db_djfan}.profile_dj            
        ON 
            products.user_id=profile_dj.user_id
        WHERE
            profile_dj.user_id=?
                AND
            products.sku like '%TRIAL'    
        LIMIT 0,1    
        `,
        userId
      );
      if (rows.length == 0) {
        callback(false);
      } else {
        callback(rows[0]);
      }
    } catch (error) {
      logger.log(error);
      callback(false);
    } finally {
      if (conn) conn.end();
    }    
};

products.getProductStripeDetails = async function (params) {
    let conn;
    try {
      conn = await dbconnection.pool.getConnection();  
      const query = 
        `SELECT 
            products.product_type,
            products.stripe_price_id,
            profile_dj.profile_url
        FROM 
            ${config.nodeserver.db_djfan}.products            
        INNER JOIN
            ${config.nodeserver.db_djfan}.profile_dj            
        ON 
            products.user_id=profile_dj.user_id
        WHERE
            products.id=?
        LIMIT 0,1    
        `;
      const rows = await conn.query(query,[params.product_id]);
      if (rows.length == 0) {
        return false;
      } else {
        return rows[0];
      }
    } catch (error) {
      logger.log(error);
      return false;
    } finally {
      if (conn) conn.end();
    }    
};

products.getMyStripeSubscriptionKey = async function (params) {
    let conn;
    try {
      conn = await dbconnection.pool.getConnection();  
      const rows = await conn.query(
        `SELECT 
            subscription
        FROM 
            ${config.nodeserver.db_djfan}.subscriptions 
        WHERE
            id=?
                AND
            user_key=?    
        `,
        [parseInt(params.subscription_id),params.user_key]
      );
      if (rows.length == 0) {
        return false;
      } else {
        return rows[0]['subscription'];
      }
    } catch (error) {
      logger.log(error);
      return false;
    } finally {
      if (conn) conn.end();
    }    
};

products.setSubscription = async function (params) {
    try {
        if (params.subscription_id == undefined) {
            return false;        
        }
        if (params.user_key == undefined) {
            return false;        
        }
        let data = {};
        data.updated_at = new Date().toJSON().slice(0, 19).replace('T', ' '); 
        if (params.status_id != undefined) {
            data.status_id = params.status_id; 
        }
        products.putSubscription(params.subscription_id, params.user_key, data, function(result) {
            return result;        
        });      
    } catch(error) {
        logger.log(error);
        return false;
    }     
}

products.putSubscription = async function (id, user_key, data, callback) {
    try {
        let result = await sequelizeSubscriptionModel.update(
            data,{
                where: {
                    id: id,
                    user_key: user_key 
                }
            });
        if (result[0]==1){
            callback(true);
        } else {
            callback(false);
        }  
    } 
    catch (error) { 
        logger.log(error);
        callback(false);
    }      
};

products.getUpgradeProductVip = async function (params, callback) {
    let conn;
    try {
      conn = await dbconnection.pool.getConnection();      
      const rows = await conn.query(
        `SELECT
            products.id, 
            products.created_at, 
            products.updated_at, 
            products.accesslevel_id, 
            products.user_id, 
            products.user_id AS dj_id, 
            products.name, 
            products.active, 
            products.default_price, 
            products.price, 
            products.description, 
            products.image_url, 
            products.sku,
            products.type,
            products.product_type,     
            products.stripe_id,     
            products.stripe_price_id     
        FROM 
            ${config.nodeserver.db_djfan}.products 
        INNER JOIN 
            ${config.nodeserver.db_djfan}.subscriptions
        ON
            products.user_id = subscriptions.dj_user_id
                AND
            products.sku=CONCAT('PASS-',products.user_id,'-VIP')    
        WHERE		
            subscriptions.subscription=?   
                AND
            subscriptions.user_key=?
        LIMIT 1    
        `,
        [params.subscription,params.user_key]
      );
      if (rows.length == 0) {
        callback(false);
      } else {
        callback(rows[0]);
      }
    } catch (error) {
        logger.log(error);
        callback(false);    
    } finally {
        if (conn) conn.end();
    }            
};

products.getDownloadLink = async function (params, callback) {
    let conn;
    try {
      conn = await dbconnection.pool.getConnection();  
      const rows = await conn.query(
        `SELECT 
            products_audio.release_name,
            products_audio.location
        FROM 
            ${config.nodeserver.db_djfan}.user_products
        INNER JOIN
            ${config.nodeserver.db_djfan}.products
        ON
            products.id = user_products.product_id
        LEFT JOIN 
            ${config.nodeserver.db_djfan}.products_audio    
        ON
            products.id = products_audio.product_id    
        WHERE
            user_products.product_id=?
                AND
            user_products.user_key=?
        `,
        [parseInt(params.product_id),params.user_key]
      );
      if (rows.length == 0) {
        callback(false);
      } else {
        cloudflareParams = {};
        cloudflareParams.bucket='djfan-products';
        cloudflareParams.key = rows[0]['location'];     
        cloudflareParams.fileName = rows[0]['release_name'];                                   
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

products.getMessageBundleProduct = async function(params, callback) {
    let conn;
    try {
        conn = await dbconnection.pool.getConnection();  
        const rows = await conn.query(
            `SELECT 
                products.id as product_id,
                products.stripe_price_id
            FROM 
                ${config.nodeserver.db_djfan}.products 
            INNER JOIN
                ${config.nodeserver.db_djfan}.profile_dj 
            ON
                products.user_id = profile_dj.user_id                
            INNER JOIN
                ${config.nodeserver.db_djfan}.user_relations
            ON
                user_relations.user_target = profile_dj.user_id
                    AND
                user_relations.user_source = ?
                    AND
                user_relations.accesslevel_id = 3    
            WHERE
                profile_dj.profile_url=?
                    AND
                product_type = 'message'    
            LIMIT 
                0, 1    
            `,
            [params.user_id,params.djname]
        );
        if (rows.length == 0) {
            callback(false);
        } else {
            callback(rows[0]);
        }
    } catch (error) {
        logger.log(error);
        callback(false);
    } finally {
        if (conn) conn.end();
    }        
}

products.purchase = async function(params, callback) {        
    try {
        if (params.type=='subscription') {
            if (params.level=='gold') {
                params.accesslevel_id=2;
            } 
            if (params.level=='vip') {
                params.accesslevel_id=3;
            }
            products.getMembershipProduct(params, async function (product) {          
                if (product) {      
                    product.user_key = params.user_key;
                    if (params.redirect=='event') { 
                        let eventUrl = await events.getEventUrlByIdPromise(params.event_id);
                        product.redirect_url = config.nodeserver.app_url;
                        if (params.djname) {
                            product.redirect_url += 'artists/'+params.djname+'/event/'+eventUrl;                        
                        }
                        if (params.venuename) {
                            product.redirect_url += 'venues/'+params.venuename+'/event/'+eventUrl;                        
                        }                        
                        stripeHandler.getPaymentLink(product, function (result) {
                            if (result) {
                                callback({'result':result});
                                return;
                            } else {      
                                callback({'result':false});
                                return;
                            }
                        });                                                      
                    } 

                    if (params.redirect=='video') { 
                    }
                    
                    if (params.redirect=='audio') { 
                    }
                }
            });      
        } else {
            callback({'result':false});
            return;
        }
    } catch (error) {
        logger.log(error);
        callback({result:false,message:error});
    }   
}

module.exports = products; 