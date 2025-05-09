const logger = require("../logger");
const products = require("../api/products");
const express = require("express");
const router = express.Router();
const middleware = require("./middleware/middleware");

const stripeHandler = require("../../app/stripe");

router.get("/", middleware.requireUserKey, function (req, res) {
  try {
    let params = {
      start: req.query["_start"] || 0,
      limit: req.query["_length"] || req.query["_limit"] || 10,
    };
    params.user_key = req.user_key;
    params.seach = {};
    if (req.query["product_id"] != undefined) {
      params.seach.id = req.query["product_id"];
    }
    if (req.query["_type"] != undefined) {
      params.seach.type = req.query["_type"];
    }
    if (
      req.query["_type"] == undefined &&
      req.query["product_id"] == undefined
    ) {
      params.seach.type = 1;
    }
    if (req.query["djname"] != undefined) {
      params.seach.dj_name = req.query["djname"];
    }
    if (req.query["dj_id"] != undefined) {
      params.seach.user_id = req.query["dj_id"];
    }
    products.get(params, function (result) {
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

router.get(
  "/payment_link/:product_id",
  middleware.requireUserKey,
  async function (req, res) {
    try {
      let params = {};
      params.product_id = req.params.product_id;
      params.user_key = req.user_key;
      const product = await products.getProductStripeDetails(params);
      if (!product) {
        return res.status(200).json({ result: false });
      } else {
        params.product_type = product.product_type;
        params.stripe_price_id = product.stripe_price_id;
        params.profile_url = product.profile_url;
        params.redirect_url = "";
        stripeHandler.getPaymentLink(params, function (result) {
          if (!result) {
            return res.status(200).json({ result: false });
          } else {
            return res.status(200).json({ result: result });
          }
        });
      }
    } catch (error) {
      console.log(error);
      logger.log(error);
      return res.status(500).json({ result: false, message: "error" });
    }
  }
);

router.get(
  "/download/:product_id",
  middleware.requireUserKey,
  function (req, res) {
    try {
      let params = {};
      params.product_id = req.params.product_id;
      params.user_key = req.user_key;
      products.getDownloadLink(params, function (result) {
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
