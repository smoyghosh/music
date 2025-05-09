// const config = require("../config");
// const mariadb = require("mariadb");
// const winston = require("winston");
// const { combine, timestamp, json } = winston.format;
const dbconnection = {};

// const logger = winston.createLogger({
//   level: "info",
//   format: combine(timestamp(), json()),
//   transports: [
//     new winston.transports.Console({
//       level: "error",
//     }),
//     new winston.transports.File({
//       filename: "mariadb.error.log",
//       filename: "log/mariadb.error.log",
//       level: "error",
//     }),
//     new winston.transports.File({
//       filename: "log/mariadb.info.log",
//       level: "info",
//     }),
//   ],
// });
// if (
//   config.nodeserver.environment == "dev" ||
//   config.nodeserver.environment == "stage" ||
//   config.nodeserver.environment == "test"
// ) {
//   dbconnection.pool = mariadb.createPool({
//     host: config.nodeserver.db_host,
//     user: config.nodeserver.db_user,
//     password: config.nodeserver.db_password,
//     connectionLimit: 10,
//     logger: {
//       query: (msg) => logger.info(msg),
//       error: (err) => logger.error(err),
//     },
//   });
//   dbconnection.updatePool = mariadb.createPool({
//     host: config.nodeserver.db_host,
//     user: config.nodeserver.db_user,
//     password: config.nodeserver.db_password,
//     connectionLimit: 5,
//     multipleStatements: true,
//     logger: {
//       query: (msg) => logger.info(msg),
//       error: (err) => logger.error(err),
//     },
//   });
// } else {
//   var clusterConfig = {
//     canRetry: true,
//     removeNodeErrorCount: 5,
//     restoreNodeTimeout: 1000,
//     /* defaultSelector: 'ORDER', */
//   };

//   let hosts = config.nodeserver.db_host.split(",");
//   dbconnection.pool = mariadb.createPoolCluster(clusterConfig);
//   for (let i = 0; i < hosts.length; i++) {
//     dbconnection.pool.add("server-" + i, {
//       host: hosts[i],
//       user: config.nodeserver.db_user,
//       password: config.nodeserver.db_password,
//       connectionLimit: 10,
//       maxIdle: 0,
//       idleTimeout: 60000,
//       enableKeepAlive: true,
//       leakDetectionTimeout: 55000,
//       logger: {
//         // query: (msg) => logger.info(msg),
//         error: (err) => logger.error("x1:", err),
//       },
//     });
//   }

//   dbconnection.updatePool = mariadb.createPoolCluster(clusterConfig);
//   for (let i = 0; i < hosts.length; i++) {
//     dbconnection.updatePool.add("server-" + i, {
//       host: hosts[i],
//       user: config.nodeserver.db_user,
//       password: config.nodeserver.db_password,
//       connectionLimit: 5,
//       multipleStatements: true,
//       maxIdle: 0,
//       idleTimeout: 60000,
//       enableKeepAlive: true,
//       leakDetectionTimeout: 55000,
//       logger: {
//         // query: (msg) => logger.info(msg),
//         error: (err) => logger.error("x2:", err),
//       },
//     });
//   }
// }

module.exports = dbconnection;
