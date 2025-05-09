const config = require("../config");
const stripe = require("stripe")(config.nodeserver.stripe_secret);
const user = require("./api/user");
const logger = require("./logger");
const stripeHandler = {};

stripeHandler.getPaymentLink = async function(params, callback) { 
    try {        
        if (params.redirect_url=='') {
            if ( params.product_type=='message') {
                params.redirect_url = `messages?ch=${params.profile_url}`;
            } 
            if ( params.product_type=='audio') {
                params.redirect_url = `artists/${params.profile_url}/product/${params.product_id}`;
            } 
            if ( params.product_type=='subscription') {
                params.redirect_url = `artists/${params.profile_url}`;
            }
            params.redirect_url = config.nodeserver.app_url + params.redirect_url;
        }
        if (params.stripe_price_id == false || params.stripe_price_id == '' || params.stripe_price_id == null) {
            callback(false);
            return;
        }

        if ( params.product_type=='subscription') {
            var paymentLink = await stripe.paymentLinks.create({
                metadata: {
                    product_id: params.product_id, 
                    user_key: params.user_key,
                },
                line_items: [
                {
                    price: params.stripe_price_id,
                    quantity: 1,
                }],
                automatic_tax : {
                    enabled: true,
                },
                after_completion: {                
                    redirect: { 
                        url: params.redirect_url 
                    },
                    type: "redirect",
                },        
            }); 
        } else {
            var paymentLink = await stripe.paymentLinks.create({
                metadata: {
                    product_id: params.product_id, 
                    user_key: params.user_key,
                },
                line_items: [
                {
                    price: params.stripe_price_id,
                    quantity: 1,
                }],
                automatic_tax : {
                    enabled: true,
                },                
                after_completion: {                
                    redirect: { 
                        url: params.redirect_url 
                    },
                    type: "redirect",
                },
                customer_creation: "always", 
                invoice_creation: {
                    enabled: true,    
                },
            });              
        }          
        if (paymentLink) {
            callback(paymentLink['url']);
            return;
        } else {          
            callback(false);
            return;
        }  
    } catch (error) {
        console.log(error);
        logger.log(error);
        callback(false);
        return;
    }
}

stripeHandler.upgradeSubscription = async function(params,callback) { 
    const products = require("./api/products");
    try { 
        params.subscription = await products.getMyStripeSubscriptionKey(params);        
        if (params.subscription == false || params.subscription == '' || params.subscription == null) {
            callback({"result":false,"message":"no subscription found"});
            return;
        }    
        params.subscriptionDetails = await stripe.subscriptions.retrieve(params.subscription);
        if (params.subscriptionDetails == false || params.subscriptionDetails == '' || params.subscriptionDetails == null) {
            callback({"result":false,"message":"no subscriptionDetails found"});
            return;
        }        
        params.subscription_item_id = params.subscriptionDetails.items.data[0].id;
        products.getUpgradeProductVip(params, function(product) {
            if (product) {
                params.product_id = product.id;
                params.stripe_price_id = product.stripe_price_id;
                params.description = product.name;
                params.price = product.stripe_price_id;
                params.accesslevel_id = product.accesslevel_id; 
                params.dj_id = product.dj_id;
                stripeHandler.setUpgradeSubscription(params, function(result) {
                    if (result) {
                        callback({"result":true,"message":"upgrade succesfull"});
                        return;
                    } else {
                        callback({"result":false,"message":"failed to upgrade in stripe"});
                        return;
                    }
                });
            } else {
                callback({"result":false,"message":"no vip product found"});
                return;
            }
        });
    } catch(error) {
        logger.log(error);
        callback({"result":false,"message":"error"});
        return;
    }
}

stripeHandler.setUpgradeSubscription = async function(params,callback) { 
    const products = require("./api/products");
    try {
        const upgraded = await stripe.subscriptions.update(
            params.subscription,
            {
              items: [
                {
                  id: params.subscription_item_id,
                  price: params.stripe_price_id,
                },
              ],
            }
          );          
        if (upgraded) { 
            let subscriptionData = {};
            subscriptionData.subscription_id = params.subscription_id; 
            subscriptionData.user_key = params.user_key;         
            subscriptionData.amount = params.price;  
            subscriptionData.accesslevel = params.accesslevel_id;
            subscriptionData.description = params.name;
            subscriptionData.product_id = params.product_id;
            products.setSubscription(subscriptionData);
            
            let userRelations = {};
            userRelations.fanId = params.user_id;
            userRelations.djId = params.dj_id;
            userRelations.accesslevelId = params.accesslevel_id;
            user.updateConnect(userRelations,function (result){});
            callback(true);
            return;
        } else {
            callback(false);
            return;    
        }
    } 
    catch (error) { 
        logger.log(error);
        callback(false);
        return;    
    }  
};

stripeHandler.getProductStripeDetails = async function (params) {
    let conn;
    try {
      conn = await dbconnection.pool.getConnection();  
      const rows = await conn.query(
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
        `,
        [params.product_id]
      );
      if (rows.length == 0) {
        return false;
      } else {
        return rows[0];
      }
    } catch (error) {
      console.log(error);
      logger.log(error);
      return false;
    } finally {
      if (conn) conn.end();
    }    
};

stripeHandler.cancelSubscription = async function(params,callback) { 
    const products = require("./api/products");
    try {          
        params.subscription = await products.getMyStripeSubscriptionKey(params);        
        if (params.subscription == false || params.subscription == '' || params.subscription == null)
        {
            callback({"result":false,"status":0});
            return;
        }

        const subscription = await stripe.subscriptions.retrieve(params.subscription);        
        if (subscription.status=='canceled') {
            let subscriptionData = {};
            subscriptionData.subscription_id = params.subscription_id; 
            subscriptionData.user_key = params.user_key;         
            subscriptionData.status_id = 7;
            products.setSubscription(subscriptionData);
            callback({"result":true,"status":7});
            return;
        }

        const unsubscribed = await stripe.subscriptions.cancel(params.subscription);              
        if (unsubscribed) {
            let subscriptionData = {};
            subscriptionData.subscription_id = params.subscription_id; 
            subscriptionData.user_key = params.user_key;         
            subscriptionData.status_id = 7;
            products.setSubscription(subscriptionData);
            callback({"result":true,"status":7});
            return;
        } 
        else
        {
            let subscriptionData = {};
            subscriptionData.subscription_id = params.subscription_id; 
            subscriptionData.user_key = params.user_key;         
            subscriptionData.status_id = 6;
            products.setSubscription(subscriptionData);
            callback({"result":false,"status":6});
            return;    
        }
    } 
    catch (error) { 
        logger.log(error);
        let subscriptionData = {};
        subscriptionData.subscription_id = params.subscription_id; 
        subscriptionData.user_key = params.user_key;         
        subscriptionData.status_id = 6;
        products.setSubscription(subscriptionData);
        callback({"result":false,"status":6});
        return;
    }    
}
    
module.exports = stripeHandler;