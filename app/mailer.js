const { QueryInterface } = require("sequelize");
const config = require("../config");
const SparkPost = require('sparkpost'); 
const client = new SparkPost( config.nodeserver.sparkpost_api_key , { 
    endpoint:'https://api.eu.sparkpost.com:443',
    /* debug: false, */
}); 
const fs = require("fs");
const logger = require("./logger");

const mailer = {};

mailer.email = {
    from: "",
    to: "",
    subject: "",
    html: ""
  }

mailer.send = function(email,callback) {
    client.transmissions.send({
        options: {
            /* sandbox: false */
        },
        content: {
            from: email.from,
            subject: email.subject,
            html: email.html
        },
        recipients: [
            {address: email.to}
        ]
    })
    .then(data => {
        callback(true);
    })
    .catch(error => {
        logger.log(error);
        callback(false);
    });
}

mailer.setHtml = function (variables, callback) {
    try {
        let template = fs.readFileSync("./app/emailtemplates/"+variables.template).toString();    
        const el = [...template.matchAll(/\${(.*?)}/g)];
        for (i in el) {
            if (typeof variables[el[i][1]] != undefined) {
                template = template.replaceAll(el[i][0],variables[el[i][1]]);
            }
        }
        callback(template);
    } catch(error) {
        logger.log(error);
        callback('');
    }    
} 

module.exports = mailer;