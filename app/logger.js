const winston = require("winston");
const config = require("../config");
const errorlog = require("./errorlog");

const logger = {};
logger.log = function (error) {
  try {
    const winstonLog = winston.createLogger({
      level: "info",
      format: winston.format.json(),
      defaultMeta: { service: "user-service" },
      transports: [
        new winston.transports.File({ filename: "error.log", level: "error" }),
        new winston.transports.File({ filename: "combined.log" }),
      ],
    });

    if (config.env !== "prod") {
      winstonLog.add(
        new winston.transports.Console({
          format: winston.format.simple(),
        })
      );
    }

    const regex = /(.*):(\d+):(\d+)$/;
    const match = regex.exec(error.stack.split("\n")[1]);
    const errorLocation = { file: match[1].split("/").pop(), line: match[2] };
    winstonLog.log({
      level: "error",
      message:
        "Time: " +
        new Date().toJSON().slice(0, -1).replace("T", " ") +
        "  - File: " +
        errorLocation.file +
        "  - Line: " +
        errorLocation.line +
        "  -  Message: " +
        error.message,
    });
  } catch (error) {
    errorlog.write(error);
  }
};

module.exports = logger;
