const config = require("../config");
const logger = require("./logger");
const reCaptcha = {};

reCaptcha.verifyToken = async function (recaptcha, callback) {
    callback({"result":true,"verified":true,"message":"verified and good"});
    return;

    const secret_key = config.nodeserver.google_recaptcha_secret;
    const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secret_key}&response=${recaptcha}`;    
    fetch(url, {
        method: 'post'
    })
    .then(response => {
        return response.json();
    })
    .then(data => {
        if (data.success===true) {
            callback({"result":true,"verified":true,"message":"verified and good","data":data});
        } else {
            callback({"result":true,"verified":false,"message":"verifcation invalid","data":data});
        } 
    })
    .catch(error => {
        logger.log(error);
        callback({"result":false,"verified":false,"message":error});
    });
}

module.exports = reCaptcha;