const config = require("../../config");
const logger = require("../logger");
const middleware = require("./middleware/middleware");
const posts = require("../api/posts");
const user = require("../api/user");
const stripeHandler = require("../../app/stripe");
const cloudflare = require("../../app/cloudflare");
const backend = require("../../app/backend");
const userPassword = require("../api/userPassword");
const userEmail = require("../api/userEmail");
const stream = require("../../app/stream");
const multer = require("multer");
const express = require("express");
const router = express.Router();

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

/* ME Path */
router.get("/", middleware.requireUserKey, function (req, res) {
  try {
    user.getUser(req.user_key, function (result) {
      if (!result) {
        return res.status(200).json({ result: false });
      } else {
        return res.status(200).json({ result: result });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.post(
  ["/profile_picture"],
  [middleware.requireUserKey, upload.single("file")],
  function (req, res) {
    try {
      if (!req.file) {
        return res
          .status(200)
          .json({ result: false, message: "upload failed" });
      } else {
        let params = {};
        params.extension = req.file.originalname.split(".").pop().toLowerCase();
        params.filename = req.file.filename;
        params.locationFile = __dirname + "/" + req.file.destination;
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
        params.filename = params.filename;
        cloudflare.upload({
          filename: params.filename,
          filelocation: params.locationFile,
          bucket: "uploads",
        });
        let data = {};
        data.avatar = config.nodeserver.r2_s3_uploads + params.filename;
        user.putUser(req.user_key, data, function (result) {
          // fs.unlink(params.locationFile+params.filename);
          if (result) {
            backend.doJob({ job: "doCacheAvatar", id: req.user_id });
            return res
              .status(200)
              .json({ result: true, message: "upload succesfully." });
          } else {
            return res
              .status(200)
              .json({ result: true, message: "upload failed." });
          }
        });
      }
    } catch (error) {
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

router.post("/", middleware.requireUserKey, function (req, res) {
  try {
    user.putUser(req.user_key, req.body, function (result) {
      if (!result) {
        return res.status(200).json({ result: false });
      } else {
        return res.status(200).json({ result: result });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.post("/username", middleware.requireUserKey, function (req, res) {
  try {
    user.putUserName(req.user_key, req.body, function (result) {
      if (!result) {
        return res.status(200).json({ result: false });
      } else {
        return res.status(200).json({ result: result });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/reset_password", middleware.requireUserKey, function (req, res) {
  try {
    userPassword.doPasswordReset(req.user_key);
    return res.status(200).json({ result: true });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.post("/reset_password", middleware.requireUserKey, function (req, res) {
  try {
    userPassword.setPassword(req.user_key, req.body, function (result) {
      if (result.result) {
        return res.status(200).json(result);
      } else {
        return res.status(200).json(result);
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/change_email", middleware.requireUserKey, function (req, res) {
  try {
    userEmail.doChangeEmail(req.user_key);
    return res.status(200).json({ result: true });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.post("/change_email", middleware.requireUserKey, function (req, res) {
  try {
    userEmail.setChangeEmail(req.user_key, req.body, function (result) {
      if (result.result) {
        return res.status(200).json({ result: true, message: result.message });
      } else {
        return res.status(404).json({ result: false, message: result.message });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get(
  "/confirm_email/:verify_hash",
  middleware.requireUserKey,
  function (req, res) {
    try {
      userEmail.updateEmail(
        req.user_key,
        req.params.verify_hash,
        function (result) {
          if (result) {
            return res.status(200).json({ result: true });
          } else {
            return res.status(202).json({ result: false });
          }
        }
      );
    } catch (error) {
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

router.get("/connections", middleware.requireUserKey, function (req, res) {
  try {
    let params = {
      type: req.query["_type"] || "",
      start: req.query["_start"] || 0,
      limit: req.query["_length"] || req.query["_limit"] || 1000,
    };
    user.getConnections(req.user_key, params, function (result) {
      if (!result) {
        return res.status(200).json({ result: false });
      } else {
        return res.status(200).json({ result: result });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/myconnections", middleware.requireUserKey, function (req, res) {
  try {
    let params = {
      type: req.query["_type"] || "",
      start: req.query["_start"] || 0,
      limit: 100,
    };
    params.user_key = req.user_key;
    params.user_id = req.user_id;
    user.myConnections(params, function (result) {
      return res.status(200).json(result);
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/feed", middleware.requireUserKey, function (req, res) {
  try {
    let params = {
      select: req.query["_select"] || "all",
      start: req.query["_start"] || 0,
      limit: req.query["_length"] || req.query["_limit"] || 10,
      type: req.query["_type"] || 0,
    };
    posts.getFeed(req.user_id, params, function (result) {
      if (!result) {
        return res.status(200).json({ result: false });
      } else {
        return res.status(200).json({ result: result });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/posts/likes/", middleware.requireUserKey, function (req, res) {
  try {
    posts.getMyLikes(
      req.user_key,
      req.query["postids"] || "0",
      function (result) {
        if (result) {
          return res.status(200).json({ result: result });
        } else {
          return res.status(404).json({ result: false });
        }
      }
    );
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/subscriptions", middleware.requireUserKey, function (req, res) {
  try {
    let params = {
      start: req.query["_start"] || 0,
      limit: req.query["_length"] || req.query["_limit"] || 10,
    };
    user.getSubscriptionDetails(req.user_key, params, function (result) {
      if (result) {
        return res.status(200).json({ result: result });
      } else {
        return res.status(200).json({ result: false });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/purchases", middleware.requireUserKey, function (req, res) {
  try {
    let params = {
      start: req.query["_start"] || 0,
      limit: req.query["_length"] || req.query["_limit"] || 10,
    };
    user.getPurchaseDetails(req.user_key, params, function (result) {
      if (result) {
        return res.status(200).json({ result: result });
      } else {
        return res.status(200).json({ result: false });
      }
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.patch(
  "/subscription/:subscription_id/cancel",
  middleware.requireUserKey,
  function (req, res) {
    try {
      let params = {};
      params.subscription_id = req.params.subscription_id;
      params.user_key = req.user_key;
      params.user_id = req.user_id;
      stripeHandler.cancelSubscription(params, function (result) {
        return res.status(200).json(result);
      });
    } catch (error) {
      console.log(error);
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

router.patch(
  "/subscription/:subscription_id/upgrade",
  middleware.requireUserKey,
  function (req, res) {
    try {
      let params = {};
      params.subscription_id = req.params.subscription_id;
      params.user_key = req.user_key;
      params.user_id = req.user_id;
      stripeHandler.upgradeSubscription(params, function (result) {
        return res.status(200).json(result);
      });
    } catch (error) {
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

router.get("/stream/token", middleware.requireUserKey, function (req, res) {
  try {
    let params = {};
    params.user_id = req.user_id;
    params.user_key = req.user_key;
    stream.getUserToken(params, function (result) {
      return res.status(200).json(result);
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get("/stream/channels", middleware.requireUserKey, function (req, res) {
  try {
    user.getDirectMessageChannels(req.user_id, function (result) {
      return res.status(200).json(result);
    });
  } catch (error) {
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

router.get(
  "/stream/channels/unread-messages",
  middleware.requireUserKey,
  function (req, res) {
    try {
      let params = { fan_id: req.user_id };
      stream.unreadMessages(params, function (result) {
        return res.status(200).json(result);
      });
    } catch (error) {
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

module.exports = router;
