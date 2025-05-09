const config = require("../../config");
const dbconnection = require("../dbconnection");
const logger = require("../logger");
const cache = {};

cache.getStats = function (module, callback) {
    const apiModule = require(`../api/${module}`);
    apiModule.getCache(function(serverCache){
        if(serverCache){
            callback(serverCache.getStats());
        } else {
            callback({"result":false});
        }        
    })
}

cache.flushAll = function (module, callback) {
    const apiModule = require(`../api/${module}`);
    apiModule.getCache(function(serverCache){
        if(serverCache){
            serverCache.flushAll();
            callback({"result":true});
        } else {
            callback({"result":false});
        }        
    })
}

cache.keys = function (module, callback) {
    const apiModule = require(`../api/${module}`);
    apiModule.getCache(function(serverCache){
        if(serverCache){
            callback(serverCache.keys());
        } else {
            callback({"result":false});
        }        
    })    
}

module.exports = cache;