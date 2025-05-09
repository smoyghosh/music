const logger = require("../logger");
const events = require("../api/events");
const middleware = require("./middleware/middleware");
const express = require("express");
const router = express.Router();

router.get("/user", middleware.requireUserKey, function (req, res) {
  try {
    let params = {};
    params.user_key = req.user_key;
    params.user_id = req.user_id;
    params.event_id = req.query["event_id"] || 0;
    events.getUserData(params, function (result) {
      if (result) {
        return res.status(200).json({ result: result });
      } else {
        return res.status(404).json({ result: false });
      }
    });
  } catch (error) {
    console.log("error-------:",error)
    logger.log(error);
    return res.status(500).json({ result: false, message: "error" });
  }
});

module.exports = router;
