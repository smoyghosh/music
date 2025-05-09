const config = require("../../config");
const logger = require("../logger");
const support = require("../api/support");
const express = require("express");
const router = express.Router();

const multer = require("multer");
const cloudflare = require("../../app/cloudflare");
const reCaptcha = require("../../app/reCaptcha");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "upload/");
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4() + "." + file.originalname.split(".").pop().toLowerCase());
  },
});
const upload = multer({
  dest: "upload/",
  limits: { fileSize: 10000000 },
  storage: storage,
}); // 10000000 = 10Mb

router.get("/token", function (req, res) {
  try {
    support.getToken(req, function (result) {
      return res.status(200).json(result);
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.post(
  ["/:token/upload"],
  [upload.single("file")],
  async function (req, res) {
    try {
      if (!req.file) {
        return res
          .status(200)
          .json({ result: false, message: "upload failed" });
      } else {
        support.checkToken(req.params.token, function (result) {
          if (result) {
            let params = {};
            params.token = req.params.token;
            params.original_name = req.file.originalname;
            params.extension = req.file.originalname
              .split(".")
              .pop()
              .toLowerCase();
            params.filename = req.file.filename;
            params.locationFile = __dirname + "/" + req.file.destination;
            params.location =
              config.nodeserver.r2_s3_uploads + req.file.filename;
            if (
              !config.nodeserver.allowed_file_extension_image
                .split(",")
                .includes(params.extension)
            ) {
              res.status(200).json({
                result: false,
                message:
                  "file extension not allowed, allowed are:[" +
                  config.nodeserver.allowed_file_extension_image +
                  "]",
              });
              return;
            }
            cloudflare.upload({
              filename: params.filename,
              filelocation: params.locationFile,
              bucket: "uploads",
            });
            support.setFileUpload(params, function (result) {
              if (result) {
                return res
                  .status(200)
                  .json({ result: true, message: "upload successful" });
              } else {
                return res
                  .status(500)
                  .json({ result: false, message: "upload failed" });
              }
            });
          } else {
            return res
              .status(500)
              .json({ result: false, message: "token not found" });
          }
        });
      }
    } catch (error) {
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

router.delete("/:token/upload", function (req, res) {
  try {
    let params = {
      token: req.params.token,
      original_name: req.body.filename,
    };
    support.deleteFileUpload(params, function (result) {
      return res.status(200).json(result);
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.post("/:token", function (req, res) {
  try {
    let params = req.body;
    reCaptcha.verifyToken(params.recaptcha, function (response) {
      if (response.verified) {
        params.user_key = req.user_key || "";
        params.user_id = req.user_id || 0;
        params.token = req.params.token;
        params.session_id = req.session.id;
        support.setTicket(params, function (result) {
          return res.status(200).json(result);
        });
      } else {
        return res
          .status(200)
          .json({ result: false, message: "reCaptcha not good" });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/test", (req, res) => {
  try {
    res.sendFile(__dirname + "/test/support.html");
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});
//-------------------------------------------------

module.exports = router;
