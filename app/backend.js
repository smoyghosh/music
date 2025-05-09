const config = require("../config");
const backend = {};
const logger = require("./logger");

backend.doJob = async function (params) {
    fetch(config.nodeserver.webhook_backend, { 
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify(params),
    }).then((res) => {
    }).catch((error) => {
        logger.log(error);       
    });
}
module.exports = backend;