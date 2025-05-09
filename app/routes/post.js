const logger = require("../logger");
const posts = require("../api/posts");
const express = require("express");
const router = express.Router();
const middleware = require("./middleware/middleware");

/* Likes */
router.patch("/:id/like", middleware.requireUserKey, function (req, res) {
  try {
    posts.doLike(req.user_key, req.params.id, function (result) {
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

router.get(
  "/download/:post_id",
  middleware.requireUserKey,
  function (req, res) {
    try {
      let params = {};
      params.post_id = req.params.post_id;
      params.user_key = req.user_key;
      params.user_id = req.user_id;
      params.admin_access = req.admin_access || false;
      posts.getDownloadLink(params, function (result) {
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
  }
);

module.exports = router;
